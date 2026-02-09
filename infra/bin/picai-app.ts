#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ChatStack } from '../lib/chat-stack';

const app = new cdk.App();

new ChatStack(app, 'PicAI-ChatStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  description: 'PicAI RAG chatbot - OpenSearch, Lambda, API Gateway, DynamoDB',
});
