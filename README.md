# PicAI

Privacy-focused photo management platform with AI-powered organization and automatic album generation.

**Production:** https://piclyai.net

## Overview

PicAI is a web application that helps you organize and share photos using AI. Photos are stored locally on your Raspberry Pi for privacy, while Azure Computer Vision automatically tags and categorizes them. AWS Rekognition provides face detection and recognition for people-based organization. A RAG-powered chatbot lets you search and ask questions about your photo library using natural language. The system creates smart albums based on time periods or content, and allows group photo sharing.

### Key Features

- **Authentication** - JWT with access + refresh tokens, login/register
- **Photo Management** - Drag-and-drop upload with iPhone HEIC support, gallery view
- **AI Tagging** - Automatic tagging using Azure Computer Vision (objects, scenes, text, people)
- **Face Detection** - AWS Rekognition for face detection, tagging, and recognition
- **People** - Tag faces to organize photos by person, people browser
- **Tag Management** - Add, remove, and filter photos by tags
- **Bulk Operations** - Bulk analyze, detect faces, and delete with real-time SSE progress
- **Groups** - Create groups, invite members (link or email), role-based access (owner/admin/member)
- **Group Photos** - Upload photos to groups, group-scoped viewing and operations
- **AI Chatbot** - RAG-powered chatbot to search and ask questions about your photos in natural language
- **Smart Upload** - Two-phase upload with real-time SSE progress for AI tagging
- **Landing Page** - Public landing page with feature showcase
- **Theme** - Light/dark mode with persistent preference
- **Privacy-first** - Photos stored locally on Raspberry Pi, not in the cloud

## Technology Stack

### Backend
- Node.js 24.11.1 with TypeScript 5.9.3
- Express 5.1.0
- PostgreSQL 18.1 with Prisma 6.19.0 ORM
- jose 6.1.2 for JWT authentication (Node.js 24 compatible)
- Bcrypt 6.0.0 for password hashing (12 salt rounds)
- Multer 2.0.2 for file uploads
- Sharp 0.34.5 for image processing
- heic-convert for iPhone HEIC photo support
- Zod 4.1.12 for validation
- @aws-sdk/client-rekognition for face detection
- @aws-sdk/credential-providers for IAM Roles Anywhere auth
- @sendgrid/mail for group email invitations
- express-rate-limit for per-endpoint rate limiting

### Frontend
- React 19.2.0 with TypeScript 5.9.3
- Vite 7.2.2
- TailwindCSS 4.1.17
- React Router DOM 7.9.6
- TanStack Query 5.90.9
- Zustand 5.0.8 for client state (auth + theme)
- Axios 1.13.2
- Lucide React for icons
- Sonner 2.0.3 for toast notifications

### AWS Serverless (Chat / RAG)
- AWS CDK (TypeScript IaC)
- AWS Lambda (chat handler + ingest handler)
- Amazon Bedrock - Claude Haiku 4.5 (LLM responses)
- Amazon Bedrock - Titan Embeddings V2 (text vectorization)
- Amazon OpenSearch (k-NN vector search)
- Amazon DynamoDB (chat session history)
- Amazon API Gateway (REST API)

### Infrastructure
- Raspberry Pi 5 (backend hosting)
- Azure Static Web Apps (frontend hosting)
- Azure Computer Vision API (image tagging)
- AWS Rekognition (face detection/recognition with IAM Roles Anywhere)
- AWS Bedrock + OpenSearch + DynamoDB (RAG chatbot)
- Cloudflare Tunnel (secure connectivity)
- PostgreSQL 18.1 (database)

## Architecture

```
React Frontend (Azure) → Cloudflare Tunnel → Express API (Pi) → PostgreSQL
                    │                               ↓
                    │                    Azure Computer Vision (tags)
                    │                               ↓
                    │                    AWS Rekognition (faces)
                    │
                    └──→ API Gateway → Lambda (chat-handler) → Bedrock Claude (LLM)
                                                             → OpenSearch (vector search)
                                                             → DynamoDB (chat history)
                         API Gateway → Lambda (ingest-handler) → Bedrock Titan (embeddings)
                                                               → OpenSearch (store vectors)
```

Photos are stored locally on the Raspberry Pi. The frontend is served from Azure's CDN for fast global access. Cloudflare Tunnel provides secure HTTPS connectivity without exposing the Pi directly to the internet. The RAG chatbot runs entirely on AWS serverless infrastructure for low-latency chat without round-tripping through the Pi.

## Prerequisites

- Raspberry Pi 5 (or Pi 4 with 4GB+ RAM)
- Node.js 24.11.1 LTS (22.12+ for frontend Vite 7)
- PostgreSQL 18.1
- Cloudflare account (free tier)
- Azure account (free tier)
- AWS account (free tier for 12 months)
- AWS CLI configured with `picai-cdk` profile (for CDK deployments)
- GitHub account

## Installation

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
nano .env

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
nano .env

# Start development server
npm run dev
```

## Configuration

### Backend Environment Variables

Create `backend/.env`:

```bash
NODE_ENV=development
PORT=3001
FRONTEND_URL=https://your-app.azurestaticapps.net

DATABASE_URL=postgresql://picai_user:password@localhost:5432/picai

JWT_SECRET=your-secret-key-min-32-characters
ACCESS_TOKEN_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d

AZURE_VISION_KEY=your-azure-key
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/

UPLOAD_DIR=/home/jeffreykeem/PicAI/backend/storage/originals
THUMBNAIL_DIR=/home/jeffreykeem/PicAI/backend/storage/thumbnails
MAX_FILE_SIZE=26214400
```

### Frontend Environment Variables

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3001/api
VITE_CHAT_API_URL=https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/v1
```

For production, configure both `VITE_API_URL` and `VITE_CHAT_API_URL` in Azure Static Web Apps settings. These are baked in at build time by Vite, so a rebuild/redeploy is required after changing them.

## Database Setup

### PostgreSQL 18.1 Installation

```bash
# Add PostgreSQL APT repository for version 18
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database and User

```bash
sudo -u postgres psql

CREATE DATABASE picai;
CREATE USER picai_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE picai TO picai_user;
\c picai
GRANT ALL ON SCHEMA public TO picai_user;
\q
```

### Run Migrations

```bash
cd backend
npx prisma migrate deploy
```

## Deployment

### Backend (Raspberry Pi)

```bash
cd backend
npm run build

# Start with PM2
pm2 start dist/index.js --name picai-backend
pm2 save
pm2 startup
```

### Frontend (Azure Static Web Apps)

1. Connect GitHub repository in Azure Portal
2. Configure build settings:
   - App location: `/frontend`
   - Output location: `dist`
3. Add environment variables in Azure configuration:
   - `VITE_API_URL=https://api.yourdomain.com/api`
   - `VITE_CHAT_API_URL=https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/v1`
4. Push to main branch to deploy

### AWS Infrastructure (CDK)

```bash
cd infra

# Install dependencies
npm install

# Preview changes
npx cdk diff --profile picai-cdk

# Deploy stack (OpenSearch, Lambda, API Gateway, DynamoDB)
npx cdk deploy --profile picai-cdk

# Type-check CDK + Lambda code
npm run type-check
```

### Cloudflare Tunnel

```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
chmod +x cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared

# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create picai

# Configure tunnel
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Add configuration:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/jeffreykeem/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

```bash
# Setup DNS and start service
cloudflared tunnel route dns picai api.yourdomain.com
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

## Development

### Backend Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run type-check       # Check TypeScript types
npm test                 # Run tests
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Create new migration
```

### Frontend Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Lint code
```

### CDK / Infrastructure Commands

```bash
cd infra
npx cdk diff --profile picai-cdk      # Preview changes
npx cdk deploy --profile picai-cdk    # Deploy to AWS
npx cdk synth --profile picai-cdk     # Generate CloudFormation template
npm run type-check                     # Type-check CDK + Lambda code
```

## Project Structure

```
PicAI/
├── backend/
│   ├── src/
│   │   ├── config/            # Environment configuration
│   │   ├── routes/            # API routes
│   │   ├── controllers/       # Request handlers
│   │   ├── services/          # Business logic (incl. ingestService for RAG)
│   │   ├── middleware/        # Express middleware
│   │   ├── schemas/           # Zod validation schemas
│   │   ├── utils/             # Utilities
│   │   └── prisma/            # Prisma client
│   ├── prisma/                # Database schema & migrations
│   ├── scripts/               # Utility scripts (backfill-ingest.ts)
│   ├── pki/                   # PKI certificates for AWS (gitignored keys)
│   ├── storage/               # Photo storage (gitignored)
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # AppLayout, ProtectedRoute
│   │   │   ├── photos/        # Photo grid, viewer, upload, bulk ops
│   │   │   ├── faces/         # Face overlay, tagging popup
│   │   │   ├── people/        # Person cards and grid
│   │   │   └── groups/        # Group cards, member list, invite modals
│   │   ├── pages/             # Landing, Login, Register, Photos, People, Groups, Chat, Invite
│   │   ├── stores/            # Zustand stores (auth, theme)
│   │   ├── hooks/             # Custom hooks (photos, faces, groups, chat, bulk progress)
│   │   ├── services/          # API services (auth, photos, faces, groups, chat)
│   │   ├── utils/             # Utility functions
│   │   └── types/             # TypeScript interfaces
│   ├── public/
│   └── package.json
├── infra/                     # AWS CDK infrastructure (TypeScript)
│   ├── bin/                   # CDK app entry point
│   ├── lib/                   # Stack definitions (ChatStack)
│   ├── lambda/
│   │   ├── chat-handler/      # RAG chat Lambda (Bedrock Claude + OpenSearch + DynamoDB)
│   │   └── ingest-handler/    # Photo ingestion Lambda (Titan Embeddings + OpenSearch)
│   ├── cdk.json
│   └── package.json
├── docs/
├── CLAUDE.md
├── PRD.md
└── README.md
```

## Database Schema

- **users** - User accounts and authentication
- **groups** - Photo sharing groups (name, description, creator)
- **group_memberships** - User-group relationships with roles (owner/admin/member)
- **group_invites** - Invite links with optional expiration and max-use limits
- **photos** - Photo metadata and file paths (optionally linked to group)
- **ai_tags** - AI-generated image tags with confidence scores
- **albums** - Photo collections (auto-generated or manual)
- **album_photos** - Album-photo relationships
- **share_links** - Public sharing tokens
- **face_collections** - AWS Rekognition collection per user (1:1)
- **people** - Named individuals for face tagging
- **faces** - Detected faces with bounding boxes and AWS face IDs

See `backend/prisma/schema.prisma` for complete schema.

## Security

- JWT authentication with jose (15min access tokens, 7-day refresh tokens)
- Password hashing with bcrypt (12 salt rounds)
- Input validation using Zod schemas on all endpoints
- File upload type and size validation (JPEG, PNG, HEIC only, 25MB max)
- HTTPS enforced via Cloudflare Tunnel
- CORS restricted to frontend domain
- Per-endpoint rate limiting (login, register, upload, face detection, invites)
- Role-based group access control (owner/admin/member permissions)
- SQL injection protection via Prisma ORM
- AWS IAM Roles Anywhere (certificate-based auth, no static credentials)

## Costs

All services use free tiers:

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Azure Computer Vision | F0 | $0 |
| Azure Static Web Apps | Free | $0 |
| AWS Rekognition | Free (12 mo) | $0 |
| AWS OpenSearch | Free (12 mo) | $0 |
| AWS Lambda | Free tier | $0 |
| AWS API Gateway | Free tier | $0 |
| AWS DynamoDB | Free tier | $0 |
| AWS Bedrock (Claude + Titan) | Pay-per-token | ~$1 |
| Cloudflare Tunnel | Free | $0 |
| SendGrid | Free | $0 |
| Raspberry Pi | Self-hosted | ~$5 (electricity) |
| **Total** | | **~$6/month** |

**Service Limits:**
- Azure Computer Vision: 5,000 calls/month, 20/minute
- AWS Rekognition: 5,000 DetectFaces/month, 1,000 IndexFaces/month (first 12 months)
- AWS OpenSearch: t3.small.search free for 12 months
- AWS Lambda: 1M requests/month free
- AWS API Gateway: 1M calls/month free
- AWS DynamoDB: 25GB free
- Azure Static Web Apps: 100GB bandwidth/month
- SendGrid: 100 emails/day (free tier)

## Troubleshooting

### Backend Issues

**Server won't start:**
```bash
sudo systemctl status postgresql
cd backend && npx prisma generate
cat .env
```

**Database connection failed:**
```bash
psql -U picai_user -d picai -h localhost
```

### Frontend Issues

**Can't connect to API:**
```bash
curl http://localhost:3001/health
cat backend/.env | grep FRONTEND_URL
```

### Storage Issues

**Photos not uploading:**
```bash
ls -la backend/storage/
chmod -R 755 backend/storage/
```

### Azure API Issues

**Quota exceeded:**
- Free tier limit: 5,000 calls/month
- Monitor usage in Azure Portal
- Upgrade to S1 tier if needed ($1/1,000 calls)

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide
- [PRD.md](./PRD.md) - Product requirements
- [infra/CLAUDE.md](./infra/CLAUDE.md) - CDK infrastructure guide
- [docs/architecture.md](./docs/architecture.md) - Architecture details
- [docs/azure-setup.md](./docs/azure-setup.md) - Azure configuration
- [docs/AWS_REKOGNITION_SETUP.md](./docs/AWS_REKOGNITION_SETUP.md) - AWS Rekognition & IAM Roles Anywhere

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/name`)
3. Commit changes using conventional commits (`feat:`, `fix:`, etc.)
4. Push to branch (`git push origin feature/name`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

---

Built with TypeScript, React, and Express