# PicAI

Privacy-focused photo management platform with AI-powered organization and automatic album generation.

## Overview

PicAI is a web application that helps you organize and share photos using AI. Photos are stored locally on your Raspberry Pi for privacy, while Azure Computer Vision automatically tags and categorizes them. The system creates smart albums based on time periods or content, and allows group photo sharing.

### Key Features

- Secure user authentication with JWT
- Drag-and-drop photo upload
- Automatic AI tagging using Azure Computer Vision
- Smart album generation by date or content
- Group photo sharing
- Album download and public sharing
- Privacy-first architecture with local storage

## Technology Stack

### Backend
- Node.js 24.11.1 with TypeScript 5.9.3
- Express 5.1.0
- PostgreSQL 15 with Prisma 6.19.0 ORM
- Bcrypt 6.0.0 for password hashing
- Multer 2.0.2 for file uploads
- Sharp 0.34.5 for image processing
- Zod 4.1.12 for validation

### Frontend
- React 19.2.0 with TypeScript 5.9.3
- Vite 7.2.2
- TailwindCSS 4.1.17
- React Router 7.9.6
- React Query 5.90.9
- Axios 1.13.2

### Infrastructure
- Raspberry Pi 5 (backend hosting)
- Azure Static Web Apps (frontend hosting)
- Azure Computer Vision API (image analysis)
- Cloudflare Tunnel (secure connectivity)
- PostgreSQL 15 (database)

## Architecture

```
React Frontend (Azure) → Cloudflare Tunnel → Express API (Pi) → PostgreSQL
                                                    ↓
                                         Azure Computer Vision
```

Photos are stored locally on the Raspberry Pi. The frontend is served from Azure's CDN for fast global access. Cloudflare Tunnel provides secure HTTPS connectivity without exposing the Pi directly to the internet.

## Prerequisites

- Raspberry Pi 5 (or Pi 4 with 4GB+ RAM)
- Node.js 24.11.1 LTS
- PostgreSQL 15
- Cloudflare account (free tier)
- Azure account (free tier)
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
JWT_EXPIRATION=7d

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
```

For production, configure `VITE_API_URL` in Azure Static Web Apps settings.

## Database Setup

### PostgreSQL Installation

```bash
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
3. Add environment variable in Azure configuration:
   - `VITE_API_URL=https://api.yourdomain.com/api`
4. Push to main branch to deploy

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

## Project Structure

```
PicAI/
├── backend/
│   ├── src/
│   │   ├── config/            # Environment configuration
│   │   ├── routes/            # API routes
│   │   ├── controllers/       # Request handlers
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/             # Utilities
│   │   └── prisma/            # Database schema
│   ├── storage/               # Photo storage (gitignored)
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── context/           # React Context
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # API client
│   │   └── types/             # TypeScript types
│   ├── public/
│   └── package.json
├── docs/
├── CLAUDE.md
├── PRD.md
└── README.md
```

## Database Schema

- **users** - User accounts and authentication
- **groups** - Photo sharing groups
- **group_memberships** - User-group relationships
- **photos** - Photo metadata and file paths
- **ai_tags** - AI-generated image tags
- **albums** - Photo collections
- **album_photos** - Album-photo relationships
- **share_links** - Public sharing tokens

See `backend/prisma/schema.prisma` for complete schema.

## Security

- JWT authentication with 7-day expiration
- Password hashing with bcrypt (10 salt rounds)
- Input validation using Zod schemas
- File upload type and size validation
- HTTPS enforced via Cloudflare Tunnel
- CORS restricted to frontend domain
- Rate limiting (100 requests/minute per IP)
- SQL injection protection via Prisma ORM

## Costs

All services use free tiers:

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Azure Computer Vision | F0 | $0 |
| Azure Static Web Apps | Free | $0 |
| Cloudflare Tunnel | Free | $0 |
| Raspberry Pi | Self-hosted | ~$5 (electricity) |
| **Total** | | **~$5/month** |

**Service Limits:**
- Azure Computer Vision: 5,000 calls/month, 20/minute
- Azure Static Web Apps: 100GB bandwidth/month

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
- [docs/architecture.md](./docs/architecture.md) - Architecture details
- [docs/azure-setup.md](./docs/azure-setup.md) - Azure configuration

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