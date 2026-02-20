import * as cdk from 'aws-cdk-lib';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export class ChatStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─────────────────────────────────────────────
    // OpenSearch Domain (vector store for RAG)
    // ─────────────────────────────────────────────
    const openSearchDomain = new opensearch.Domain(this, 'PhotoVectorStore', {
      domainName: 'picai-vectors',
      version: opensearch.EngineVersion.OPENSEARCH_2_17,
      capacity: {
        dataNodeInstanceType: 't3.small.search',
        dataNodes: 1,
        multiAzWithStandbyEnabled: false,
      },
      ebs: {
        volumeSize: 10, // GB - plenty for embeddings
        volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: { enabled: true },
      enforceHttps: true,
      // IAM-based access only (no fine-grained access control master user)
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      logging: {
        slowSearchLogEnabled: false,
        slowIndexLogEnabled: false,
        appLogEnabled: false,
      },
    });

    // ─────────────────────────────────────────────
    // DynamoDB Table (chat history)
    // ─────────────────────────────────────────────
    const chatHistoryTable = new dynamodb.Table(this, 'ChatHistory', {
      tableName: 'picai-chat-history',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Free tier: 25 WRU/RRU on-demand
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl', // Auto-expire old conversations
    });

    // GSI for listing sessions by user sorted by time
    chatHistoryTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─────────────────────────────────────────────
    // IAM Role for Lambda functions
    // ─────────────────────────────────────────────
    const lambdaRole = new iam.Role(this, 'ChatLambdaRole', {
      roleName: 'picai-chat-lambda-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Bedrock permissions (Claude via inference profile + Titan Embeddings)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        // Claude Haiku 4.5 requires cross-region inference profile (not direct model ID)
        `arn:aws:bedrock:us-east-1:${this.account}:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0`,
        `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0`,
        `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0`,
        // Cross-region profile may route to any US region
        `arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0`,
      ],
    }));

    // AWS Marketplace permissions (required for Bedrock cross-region inference profiles)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aws-marketplace:ViewSubscriptions',
        'aws-marketplace:Subscribe',
      ],
      resources: ['*'],
    }));

    // OpenSearch permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'es:ESHttpGet',
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpDelete',
        'es:ESHttpHead',
      ],
      resources: [
        openSearchDomain.domainArn,
        `${openSearchDomain.domainArn}/*`,
      ],
    }));

    // DynamoDB permissions
    chatHistoryTable.grantReadWriteData(lambdaRole);

    // ─────────────────────────────────────────────
    // Lambda: Ingest Handler
    // ─────────────────────────────────────────────
    const ingestLogGroup = new logs.LogGroup(this, 'IngestHandlerLogs', {
      logGroupName: '/aws/lambda/picai-ingest-handler',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const ingestHandler = new NodejsFunction(this, 'IngestHandler', {
      functionName: 'picai-ingest-handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/ingest-handler/index.ts'),
      handler: 'handler',
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        OPENSEARCH_ENDPOINT: openSearchDomain.domainEndpoint,
        OPENSEARCH_INDEX: 'photo-vectors',
        EMBEDDING_MODEL_ID: 'amazon.titan-embed-text-v2:0',
      },
      logGroup: ingestLogGroup,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node22',
        externalModules: [], // Bundle all deps (AWS SDK needed for Bedrock + SigV4)
      },
    });

    // ─────────────────────────────────────────────
    // Lambda: Chat Handler
    // ─────────────────────────────────────────────
    const chatLogGroup = new logs.LogGroup(this, 'ChatHandlerLogs', {
      logGroupName: '/aws/lambda/picai-chat-handler',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const chatHandler = new NodejsFunction(this, 'ChatHandler', {
      functionName: 'picai-chat-handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/chat-handler/index.ts'),
      handler: 'handler',
      role: lambdaRole,
      timeout: cdk.Duration.seconds(60), // LLM calls can be slow
      memorySize: 512,
      environment: {
        OPENSEARCH_ENDPOINT: openSearchDomain.domainEndpoint,
        OPENSEARCH_INDEX: 'photo-vectors',
        CHAT_HISTORY_TABLE: chatHistoryTable.tableName,
        EMBEDDING_MODEL_ID: 'amazon.titan-embed-text-v2:0',
        LLM_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://44.208.136.228:6006',
        // Search tuning defaults — optimized via Phase 4 sweep (F1: 0.646 → 0.697)
        MIN_SEARCH_SCORE: '0.3',
        RELATIVE_SCORE_CUTOFF: '0.5',
        SEARCH_K: '30',
      },
      logGroup: chatLogGroup,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node22',
        externalModules: [], // Bundle all deps (AWS SDK needed for Bedrock + SigV4)
      },
    });

    // ─────────────────────────────────────────────
    // API Gateway (REST)
    // ─────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'ChatApi', {
      restApiName: 'picai-chat-api',
      description: 'PicAI RAG Chatbot API',
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 50,
        throttlingBurstLimit: 25,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Tighten in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // POST /chat - Send chat message
    const chatResource = api.root.addResource('chat');
    chatResource.addMethod('POST', new apigateway.LambdaIntegration(chatHandler, {
      proxy: true,
    }));

    // GET /chat/history - Get chat sessions
    // DELETE /chat/history - Delete a chat session
    const historyResource = chatResource.addResource('history');
    historyResource.addMethod('GET', new apigateway.LambdaIntegration(chatHandler, {
      proxy: true,
    }));
    historyResource.addMethod('DELETE', new apigateway.LambdaIntegration(chatHandler, {
      proxy: true,
    }));

    // POST /ingest - Ingest photo metadata
    const ingestResource = api.root.addResource('ingest');
    ingestResource.addMethod('POST', new apigateway.LambdaIntegration(ingestHandler, {
      proxy: true,
    }));

    // ─────────────────────────────────────────────
    // OpenSearch access policy (allow Lambda role)
    // ─────────────────────────────────────────────
    openSearchDomain.addAccessPolicies(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ArnPrincipal(lambdaRole.roleArn)],
      actions: ['es:ESHttp*'],
      resources: [`${openSearchDomain.domainArn}/*`],
    }));

    // ─────────────────────────────────────────────
    // Outputs
    // ─────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'Chat API Gateway URL',
    });

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
      value: openSearchDomain.domainEndpoint,
      description: 'OpenSearch domain endpoint',
    });

    new cdk.CfnOutput(this, 'ChatHistoryTableName', {
      value: chatHistoryTable.tableName,
      description: 'DynamoDB chat history table name',
    });

    new cdk.CfnOutput(this, 'IngestFunctionArn', {
      value: ingestHandler.functionArn,
      description: 'Ingest Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'ChatFunctionArn', {
      value: chatHandler.functionArn,
      description: 'Chat Lambda function ARN',
    });
  }
}
