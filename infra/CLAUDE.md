# Infrastructure CLAUDE.md - PicAI AWS CDK

**Last Updated:** March 22, 2026

CDK infrastructure guidance for the PicAI RAG chatbot stack.

---

## Common Commands

CDK is installed **locally** (not globally). Always run from the `infra/` directory using `npx`:

```bash
cd ~/PicAI/infra

# REQUIRED: Source Supabase credentials before any deploy/diff/synth
source .env.cdk

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

### Supabase Credentials

The CDK stack requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables at deploy time. These are baked into the Lambda environment configuration during CloudFormation synthesis.

- **Credentials file:** `infra/.env.cdk` (gitignored, never committed)
- **When needed:** Before any `cdk deploy`, `cdk diff`, or `cdk synth`
- **How to use:** `source .env.cdk` before running CDK commands
- **Validation:** The stack will throw an error if these vars are missing, preventing silent empty-string deploys

---

## Stack Overview

**Stack name:** `PicaiChatStack`
**Region:** us-east-1
**API Gateway URL:** `https://eh874zrdv2.execute-api.us-east-1.amazonaws.com/v1/`

### Resources

| Resource | Type | Purpose |
|----------|------|---------|
| Supabase pgvector | External (Free tier) | Vector DB for photo embeddings (cosine similarity) |
| DynamoDB `picai-chat-history` | PAY_PER_REQUEST | Chat session storage (90-day TTL) |
| Lambda `picai-ingest` | NodejsFunction | Embed photo metadata via Titan, store in Supabase |
| Lambda `picai-chat` | NodejsFunction | RAG flow: embed query, search, Bedrock Claude, history |
| API Gateway | REST | POST /chat, GET /chat/history, POST /ingest |
| IAM Role | Lambda execution | Bedrock, DynamoDB permissions |

---

## Project Structure

```
infra/
├── bin/
│   └── picai-app.ts              # CDK app entry point
├── lib/
│   └── chat-stack.ts             # All resources defined here
├── lambda/
│   ├── shared/
│   │   └── supabase.ts           # Shared Supabase client
│   ├── chat-handler/             # Chat Lambda source
│   │   ├── index.ts              # Handler: POST /chat, GET /chat/history
│   │   ├── bedrock.ts            # Bedrock Claude client
│   │   ├── search.ts             # Supabase pgvector search
│   │   ├── history.ts            # DynamoDB session read/write
│   │   └── tracing.ts            # OTel tracing setup
│   └── ingest-handler/           # Ingest Lambda source
│       ├── index.ts              # Handler: POST /ingest
│       ├── embeddings.ts         # Bedrock Titan Embeddings
│       └── supabase-store.ts     # Supabase pgvector upsert/delete
├── .env.cdk                      # Supabase credentials (GITIGNORED)
├── cdk.json
├── package.json
└── tsconfig.json
```

---

## Key Patterns

- **Lambda bundling:** Uses `NodejsFunction` with esbuild. Set `externalModules: []` to bundle all AWS SDK deps (Lambda runtime doesn't include @smithy).
- **Supabase auth:** Lambda connects via `@supabase/supabase-js` using the service role (secret) key, which bypasses RLS. The key is set as a Lambda env var during CDK deploy.
- **Score transformation:** pgvector returns raw cosine similarity [0,1]. Scores are transformed to match OpenSearch's nmslib formula `1/(2 - similarity)` so the tuned minScore/relativeCutoff thresholds remain valid.
- **DynamoDB marshalling:** `removeUndefinedValues: true` so optional fields like `photos` and `photoIds` are omitted when undefined.
- **Chat messages:** Store `photos?: ChatPhotoMatch[]` on assistant messages in DynamoDB so photo metadata persists across session reloads.
