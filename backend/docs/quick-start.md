# Quick Start Guide - PicAI Backend

This guide will help you get the PicAI backend server running on your local machine.

## Prerequisites

1. **Node.js 24.11.1 or higher** - Check with `node --version`
2. **PostgreSQL 18.1** - Database server
3. **Git** - For cloning the repository

## Installation Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

This installs all required packages:
- Express 5.1.0 (web framework)
- Prisma 6.19.0 (database ORM)
- Jose 6.1.2 (JWT authentication)
- Winston 3.18.3 (logging)
- Zod 4.1.12 (validation)
- And more...

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```bash
# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173  # Vite default port

# Database
DATABASE_URL=postgresql://picai_user:password@localhost:5432/picai

# JWT Authentication
JWT_SECRET=your-super-secret-key-min-32-characters-long
JWT_EXPIRATION=7d

# Azure Computer Vision (get from Azure Portal)
AZURE_VISION_KEY=your-azure-vision-key-here
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/

# File Storage
UPLOAD_DIR=/home/yourusername/PicAI/backend/storage/originals
THUMBNAIL_DIR=/home/yourusername/PicAI/backend/storage/thumbnails
MAX_FILE_SIZE=26214400  # 25MB
```

**Important:**
- Change `JWT_SECRET` to a random 32+ character string
- Update `DATABASE_URL` with your PostgreSQL credentials
- Update file paths to your actual system paths

### 3. Set Up Database

Create the PostgreSQL database:

```bash
# Log into PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE picai;
CREATE USER picai_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE picai TO picai_user;
\q
```

Run Prisma migrations to create tables:

```bash
npx prisma migrate dev
```

This creates all tables:
- users
- groups
- group_memberships
- photos
- ai_tags
- albums
- album_photos
- share_links

### 4. Generate Prisma Client

Generate the TypeScript types:

```bash
npx prisma generate
```

This creates type-safe database access in `src/generated/prisma/`

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

**What this does:**
- Starts server with `tsx watch` (TypeScript execution with hot reload)
- Watches for file changes and automatically restarts
- Runs on port 3001 (default)
- Logs to console with colors

**You should see:**
```
==============================================
🚀 PicAI Backend Server Started
==============================================
Environment: development
Port: 3001
Frontend URL: http://localhost:5173
Health Check: http://localhost:3001/health
API Base: http://localhost:3001/api
==============================================
Available Routes:
  POST   /api/auth/register
  POST   /api/auth/login
  POST   /api/auth/refresh
  POST   /api/auth/logout
  GET    /api/auth/me
==============================================
```

### Production Mode

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

**What this does:**
- Compiles TypeScript → JavaScript in `dist/` folder
- Runs compiled code with `node dist/index.js`
- No hot reload (restart manually for changes)
- Production-optimized logging

### Using PM2 (Production Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name picai-backend

# View logs
pm2 logs picai-backend

# Monitor
pm2 monit

# Restart
pm2 restart picai-backend

# Stop
pm2 stop picai-backend
```

## Verify Server is Running

### 1. Health Check

```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "PicAI Backend is running",
  "timestamp": "2025-11-18T01:43:30.632Z",
  "environment": "development"
}
```

### 2. Test Registration

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "profilePictureUrl": null
  }
}
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch src/index.ts` | Development mode with hot reload |
| `build` | `tsc` | Compile TypeScript to JavaScript |
| `start` | `node dist/index.js` | Run production build |
| `type-check` | `tsc --noEmit` | Check TypeScript types without compiling |
| `lint` | `eslint .` | Check code quality with ESLint |
| `format` | `prettier --write "src/**/*.{ts,js,json}"` | Format code with Prettier |
| `format:check` | `prettier --check "src/**/*.{ts,js,json}"` | Check if code is formatted |
| `db:migrate` | `prisma migrate dev` | Create and apply database migrations |
| `db:deploy` | `prisma migrate deploy` | Apply migrations in production |
| `db:studio` | `prisma studio` | Open Prisma Studio (database GUI) |
| `db:generate` | `prisma generate` | Generate Prisma Client types |

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Create new user account | No |
| POST | `/api/auth/login` | Login with email/password | No |
| POST | `/api/auth/refresh` | Refresh access token | No |
| POST | `/api/auth/logout` | Logout user | Yes |
| GET | `/api/auth/me` | Get current user profile | Yes |

### System

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Server health check | No |

## Troubleshooting

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3002
```

### Database Connection Failed

**Error:** `Error: Can't reach database server at localhost:5432`

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Verify connection
psql -U picai_user -d picai -h localhost
```

### Prisma Client Not Generated

**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
# Generate Prisma Client
npx prisma generate

# Verify generated files
ls src/generated/prisma/
```

### Environment Variables Not Loaded

**Error:** `Environment variable validation failed`

**Solution:**
1. Verify `.env` file exists in `backend/` directory
2. Check all required variables are set
3. No quotes around values (unless value contains spaces)
4. Restart server after changing `.env`

### TypeScript Errors

**Error:** `Cannot find module './config/env.js'`

**Solution:**
```bash
# Check import uses .js extension (not .ts)
import { env } from './config/env.js';  // ✅ Correct

# Run type check
npm run type-check
```

## Next Steps

1. **Test Authentication** - Follow `tests/auth-integration-test.md`
2. **Explore Database** - Run `npx prisma studio`
3. **View Logs** - Check `logs/combined-YYYY-MM-DD.log`
4. **Add Photos Routes** - Coming next!

## Useful Resources

- [Express 5 Documentation](https://expressjs.com/en/5x/api.html)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Winston Logger Guide](./logging-guide.md)
- [Auth Integration Tests](../tests/auth-integration-test.md)

---

**Last Updated:** November 17, 2025
**Server Version:** 1.0.0
**Node.js:** 24.11.1
