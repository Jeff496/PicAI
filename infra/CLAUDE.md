# Infrastructure CLAUDE.md - PicAI AWS CDK

**Last Updated:** February 9, 2026

CDK infrastructure guidance for the PicAI RAG chatbot stack.

---

## Common Commands

CDK is installed **locally** (not globally). Always run from the `infra/` directory using `npx`:

```bash
cd ~/PicAI/infra

# Preview changes before deploying
npx cdk diff --profile picai-cdk

# Deploy stack
npx cdk deploy --profile picai-cdk

# Synthesize CloudFormation template (dry run)
npx cdk synth --profile picai-cdk

# Destroy stack (use with caution)
npx cdk destroy --profile picai-cdk

# Type-check CDK + Lambda code
npm run type-check
```

The `--profile picai-cdk` flag uses IAM Roles Anywhere credentials configured locally.

You can also use the npm scripts in `package.json`, but they don't include the `--profile` flag:

```bash
npx cdk deploy --profile picai-cdk   # preferred
npm run deploy -- --profile picai-cdk # alternative
```

---

## Stack Overview

**Stack name:** `PicaiChatStack`
**Region:** us-east-1
**API Gateway URL:** `https://eh874zrdv2.execute-api.us-east-1.amazonaws.com/v1/`

### Resources

| Resource | Type | Purpose |
|----------|------|---------|
| OpenSearch `picai-vectors` | t3.small.search | Vector DB for photo embeddings (k-NN) |
| DynamoDB `picai-chat-history` | PAY_PER_REQUEST | Chat session storage (90-day TTL) |
| Lambda `picai-ingest` | NodejsFunction | Embed photo metadata via Titan, store in OpenSearch |
| Lambda `picai-chat` | NodejsFunction | RAG flow: embed query, search, Bedrock Claude, history |
| API Gateway | REST | POST /chat, GET /chat/history, POST /ingest |
| IAM Role | Lambda execution | Bedrock, OpenSearch, DynamoDB permissions |

---

## Project Structure

```
infra/
├── bin/
│   └── picai-app.ts              # CDK app entry point
├── lib/
│   └── chat-stack.ts             # All resources defined here
├── lambda/
│   ├── chat-handler/             # Chat Lambda source
│   │   ├── index.ts              # Handler: POST /chat, GET /chat/history
│   │   ├── bedrock.ts            # Bedrock Claude client
│   │   ├── search.ts             # OpenSearch k-NN query
│   │   └── history.ts            # DynamoDB session read/write
│   └── ingest-handler/           # Ingest Lambda source
│       ├── index.ts              # Handler: POST /ingest
│       ├── embeddings.ts         # Bedrock Titan Embeddings
│       └── opensearch.ts         # OpenSearch index/store
├── cdk.json
├── package.json
└── tsconfig.json
```

---

## Key Patterns

- **Lambda bundling:** Uses `NodejsFunction` with esbuild. Set `externalModules: []` to bundle all AWS SDK deps (Lambda runtime doesn't include @smithy/@aws-crypto).
- **OpenSearch auth:** SigV4-signed HTTP requests via `@smithy/signature-v4` (not the OpenSearch client SDK).
- **DynamoDB marshalling:** `removeUndefinedValues: true` so optional fields like `photos` and `photoIds` are omitted when undefined.
- **Chat messages:** Store `photos?: ChatPhotoMatch[]` on assistant messages in DynamoDB so photo metadata persists across session reloads.
