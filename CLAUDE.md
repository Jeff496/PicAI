# CLAUDE.md - PicAI Main Project Guide

**Last Updated:** November 29, 2025
**Status:** Phase 2 Complete - Production Live on Azure SWA

This file provides guidance to Claude Code when working in the PicAI repository with the November 2025 technology stack.

**Production:** https://piclyai.net

---

## Project Overview

PicAI is a collaborative photo management platform with AI-powered organization. Users upload photos to personal or group libraries, and Azure Computer Vision automatically tags and sorts them into meaningful albums.

**Key Philosophy:** Privacy-focused hybrid architecture - photos stored locally on Raspberry Pi, AI processing via Azure, frontend on Azure Static Web Apps.

---

## Architecture

### System Design

```
Frontend (React) → Cloudflare Tunnel → Backend (Express/Pi) → PostgreSQL
                                                            ↓
                                                Azure Computer Vision API
```

**Frontend:**
- React 19.2.0 with TypeScript 5.9.3
- Hosted on Azure Static Web Apps (Free tier)
- TailwindCSS 4.1.17 for styling (CSS-first configuration)
- Vite 7.2.2 for build tooling
- Zustand 5.0.8 for client state (with localStorage persistence)
- TanStack Query 5.90.9 for server state
- Axios 1.13.2 for API calls (with token refresh interceptors)
- React Router DOM 7.9.6 for routing
- Zod 4.1.12 for validation

**Backend:**
- Node.js 24.11.1 LTS (Krypton) + Express 5.1.0 on Raspberry Pi 5
- TypeScript 5.9.3 with ES modules
- PostgreSQL 18.1 database (3x faster I/O with async subsystem)
- Prisma 6.19.0 ORM (Rust-free, 90% smaller bundles)
- Multer 2.0.2 for file uploads (critical security patches applied)
- Sharp 0.34.5 for image processing (thumbnails)
- **heic-convert** for HEIC→JPEG conversion (iPhone photo support)
- **jose 6.1.2 for JWT authentication** (Node.js 24 compatible, replaces jsonwebtoken)
- Zod 4.1.12 for validation (14x faster parsing)

**Infrastructure:**
- Cloudflare Tunnel 2025.8.1 (UDP proxy rearchitecture)
- Azure Computer Vision API 2023-10-01 GA (F0 Free tier)
- Local file storage on Pi (originals + thumbnails)

**Communication:**
- Frontend calls backend via Cloudflare Tunnel: `https://piclyai.net/api/*`
- Backend calls Azure Computer Vision API when photos uploaded
- All communication over HTTPS

---

## Core Data Models

### Database Schema (PostgreSQL 18 with Prisma 6)

**Primary Tables:**
1. **users** - User accounts (id, email, password_hash, name, profile_picture_url)
2. **groups** - Photo sharing groups (id, name, description, created_by)
3. **group_memberships** - User-group relationships (id, group_id, user_id, role)
4. **photos** - Photo metadata (id, user_id, group_id, filename, file_path, thumbnail_path, uploaded_at, taken_at)
5. **ai_tags** - AI-generated labels (id, photo_id, tag, confidence, category)
6. **albums** - Photo collections (id, name, user_id, group_id, is_auto_generated, generation_criteria)
7. **album_photos** - Many-to-many album-photo relationship
8. **share_links** - Public album sharing (id, album_id, token, expires_at)

**Key Relationships:**
- Users can belong to multiple groups
- Photos belong to one user and optionally one group
- Photos can have multiple AI tags
- Albums can contain multiple photos, photos can be in multiple albums
- Share links are tied to specific albums

**Prisma 6 Configuration:**
```prisma
generator client {
  provider = "prisma-client"  // Changed from "prisma-client-js" in v6
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## File Structure

```
PicAI/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── config/
│   │   │   └── env.ts         # Environment validation with Zod
│   │   ├── types/
│   │   │   └── express.d.ts   # Express type extensions (req.user, req.id)
│   │   ├── routes/
│   │   │   └── auth.routes.ts # Auth endpoints (implemented)
│   │   ├── controllers/
│   │   │   └── auth.controller.ts
│   │   ├── services/
│   │   │   └── authService.ts # JWT with jose (implemented)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validate.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── schemas/
│   │   │   └── auth.schema.ts # Zod schemas
│   │   ├── utils/
│   │   │   └── logger.ts      # Winston logger
│   │   ├── prisma/
│   │   │   └── client.ts      # Prisma client instance
│   │   └── generated/prisma/  # Auto-generated Prisma types
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/
│   ├── storage/               # DO NOT COMMIT
│   │   ├── originals/
│   │   └── thumbnails/
│   ├── logs/                  # DO NOT COMMIT
│   ├── tests/
│   ├── scripts/
│   ├── .env                   # DO NOT COMMIT
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── CLAUDE.md              # Backend-specific guidance
├── frontend/                   # React app (Phase 2 Complete)
│   ├── src/
│   │   ├── main.tsx           # Entry point with React Query
│   │   ├── App.tsx            # Router configuration
│   │   ├── index.css          # TailwindCSS 4 config
│   │   ├── stores/
│   │   │   └── authStore.ts   # Zustand auth state
│   │   ├── services/
│   │   │   ├── api.ts         # Axios with JWT interceptors
│   │   │   ├── auth.ts        # Auth API service
│   │   │   └── photos.ts      # Photo API service
│   │   ├── hooks/
│   │   │   └── usePhotos.ts   # TanStack Query hooks
│   │   ├── types/
│   │   │   └── api.ts         # TypeScript interfaces
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── PhotosPage.tsx
│   │   └── components/
│   │       ├── layout/
│   │       │   └── ProtectedRoute.tsx
│   │       └── photos/
│   │           ├── PhotoCard.tsx
│   │           ├── PhotoGrid.tsx
│   │           ├── UploadForm.tsx
│   │           └── PhotoViewer.tsx
│   ├── public/
│   ├── .env                   # DO NOT COMMIT
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── CLAUDE.md              # Frontend-specific guidance
├── .claude/
│   └── context/               # AI context documentation
│       ├── README.md          # Index of all context files
│       ├── backend/           # Backend-specific docs
│       │   ├── file-structure.md
│       │   ├── component-examples.md
│       │   └── common-mistakes.md
│       ├── frontend/          # Frontend-specific docs
│       │   ├── file-structure.md
│       │   ├── component-examples.md
│       │   └── common-mistakes.md
│       └── shared/            # Shared docs
│           └── conventions.md
├── .github/
│   └── workflows/             # CI/CD pipelines
├── CLAUDE.md                   # This file
├── PRD.md                      # Product requirements
├── README.md
└── .gitignore
```

---

## Development Conventions

### Code Style
- **Language:** TypeScript 5.9.3 everywhere
- **Indentation:** 2 spaces
- **Quotes:** Single quotes for TS, double for JSX attributes
- **Semicolons:** Always use
- **Naming:**
  - Variables/functions: camelCase
  - Components: PascalCase
  - Constants: UPPER_SNAKE_CASE
  - Database tables: snake_case
  - API routes: kebab-case

### Git Workflow
- **Branch naming:** `feature/album-download`, `fix/upload-error`, `chore/update-deps`
- **Commits:** Conventional commits (feat, fix, chore, docs, test, refactor)
- **Never commit:**
  - `.env` files
  - `node_modules/`
  - `storage/` directory
  - `dist/` build output
  - API keys or secrets

### API Design
- **REST conventions:** Use proper HTTP methods (GET, POST, PUT, DELETE)
- **Status codes:** 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Server Error
- **Response format:** Always JSON with consistent structure:
  ```json
  {
    "success": true,
    "data": {...},
    "message": "Optional message"
  }
  ```
- **Error format:**
  ```json
  {
    "success": false,
    "error": "Descriptive error message",
    "code": "ERROR_CODE"
  }
  ```
- **Authentication:** JWT in Authorization header: `Bearer <token>` (using jose)

### Database Best Practices
- **Always use Prisma 6 ORM** - Never write raw SQL unless absolutely necessary
- **Migrations:** Create migration for every schema change
- **Transactions:** Use for multi-step operations (e.g., creating album + adding photos)
- **Indexes:** Ensure indexes on foreign keys and frequently queried fields
- **UUIDs:** Use for all primary keys
- **Timestamps:** Always include `created_at` and `updated_at` where relevant
- **PostgreSQL 18:** Enable async I/O with `io_method = 'io_uring'` for 3x performance

---

## Security Requirements

### Critical Security Rules
1. **Never commit secrets** - Use environment variables for all sensitive data
2. **Validate all inputs** - Use Zod for request validation
3. **Sanitize file uploads** - Check MIME type, file size, and extension
4. **Use parameterized queries** - Prisma handles this automatically
5. **HTTPS only** - No unencrypted communication
6. **Rate limiting** - Implement on all public endpoints (100 req/min per IP)
7. **Password hashing** - Always use bcrypt 6.0.0 with salt rounds = 12
8. **JWT with jose** - Access tokens 15min, refresh tokens 7 days (Node.js 24 compatible)

### File Upload Security
- **Allowed types:** JPEG, PNG, HEIC only
- **Max size:** 25MB per file
- **Filename sanitization:** Remove special chars, generate unique names (UUID)
- **Storage location:** Outside web root, serve via controlled endpoint
- **Multer 2.0.2:** Critical security patches CVE-2025-47935 and CVE-2025-47944 applied

---

## AI Integration Guidelines

### Azure Computer Vision Usage (2023-10-01 GA API)

**When to Call:**
- Immediately after photo upload (async)
- Can also be triggered manually via `/api/photos/:id/analyze`

**What to Extract:**
- Objects (e.g., "dog", "car", "tree")
- Scenes (e.g., "beach", "mountain", "indoor")
- Activities (e.g., "swimming", "hiking")
- Colors (dominant colors)
- Text (OCR for signs, documents)
- Faces (count and location, NOT identification)

**How to Store:**
- Save each tag as separate record in `ai_tags` table
- Include confidence score (0.00 to 1.00)
- Include category ("object", "scene", "activity", etc.)
- Use confidence threshold: Only store tags with confidence > 0.5

**API Version:**
- Use 2023-10-01 GA version (preview versions retiring March 31, 2025)
- SDK: `@azure-rest/ai-vision-image-analysis` 1.0.0-beta.3

**Rate Limit Handling:**
- Azure free tier: 5,000/month, 20/minute
- Implement request queue if approaching limits
- Show user feedback: "Processing... this may take a minute"
- Retry with exponential backoff on rate limit errors

---

## Performance Optimization

### November 2025 Stack Improvements
- **Node.js 24:** 30% faster HTTP requests with Undici 7
- **Express 5:** Automatic async error handling, HTTP/2 support
- **Prisma 6:** 90% smaller bundles, 3.4x faster queries
- **PostgreSQL 18:** 3x faster I/O with async subsystem
- **TailwindCSS 4:** 3.5-5x faster builds, 8x faster incremental
- **Zod 4:** 14x faster string parsing, 57% smaller bundles
- **React 19:** Automatic batching, improved Suspense
- **Vite 7:** Rolldown integration for faster builds

### Raspberry Pi Constraints
- **Limited RAM:** Keep processes lightweight, avoid loading large files in memory
- **Disk I/O:** Use SSDs over microSD for better performance
- **CPU:** Use streams for file operations, async/await for I/O

### Image Handling
- **HEIC Conversion:** Convert HEIC/HEIF to JPEG on upload using `heic-convert` (iPhone support)
- **Thumbnails:** Always generate 200x200px for grid views (Sharp 0.34.5)
- **Lazy loading:** Frontend loads thumbnails first, full images on demand
- **Streaming:** Stream photo files, don't load entire file in memory
- **Compression:** Use Sharp with quality=80 for thumbnails

### Database Optimization
- **PostgreSQL 18:** Enable async I/O: `ALTER SYSTEM SET io_method = 'io_uring'`
- **Indexes:** Ensure indexes on `user_id`, `group_id`, `uploaded_at`, `tag`
- **Pagination:** Always paginate large queries (50 items per page)
- **Connection pooling:** Configure Prisma connection pool (default max=10 is fine)
- **Query optimization:** Use `select` to only fetch needed fields

---

## Environment Variables

### Backend (.env)
```bash
# Server
NODE_ENV=development
PORT=3001
FRONTEND_URL=https://your-azure-static-web-app.azurestaticapps.net

# Database (PostgreSQL 18)
DATABASE_URL=postgresql://picai_user:password@localhost:5432/picai

# JWT (using jose for Node.js 24 compatibility)
JWT_SECRET=your-super-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d

# Azure Computer Vision (2023-10-01 GA)
AZURE_VISION_KEY=your-azure-key
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/

# File Storage
UPLOAD_DIR=/home/jeffreykeem/PicAI/backend/storage/originals
THUMBNAIL_DIR=/home/jeffreykeem/PicAI/backend/storage/thumbnails
MAX_FILE_SIZE=26214400  # 25MB in bytes
```

### Frontend (.env)
```bash
# Development
VITE_API_URL=http://localhost:3001/api

# Production (set in Azure Static Web Apps configuration)
VITE_API_URL=https://your-cloudflare-tunnel.com/api
```

**NEVER commit .env files to git!**

---

## Technology Stack Summary (November 2025)

### Backend
- Node.js 24.11.1 LTS (Krypton)
- TypeScript 5.9.3
- Express 5.1.0 (finally stable!)
- Prisma 6.19.0 (Rust-free, 90% smaller)
- PostgreSQL 18.1 (3x faster I/O)
- Bcrypt 6.0.0
- **jose 6.1.2** (JWT library, Node.js 24 compatible)
- Zod 4.1.12 (14x faster)
- Sharp 0.34.5
- **heic-convert** (HEIC→JPEG for iPhone photos)
- Winston 3.18.3
- Multer 2.0.2 (security patched)
- PM2 6.0.13

### Frontend
- React 19.2.0
- TypeScript 5.9.3
- Vite 7.2.2
- TailwindCSS 4.1.17 (CSS-first config)
- React Router DOM 7.9.6
- TanStack Query 5.90.9
- Zustand 5.0.8 (client state with persistence)
- Axios 1.13.2
- Zod 4.1.12

### Infrastructure
- Raspberry Pi 5
- PostgreSQL 18.1
- Cloudflare Tunnel 2025.8.1
- Azure Computer Vision API 2023-10-01 GA
- Azure Static Web Apps (free tier)

---

## Common Patterns

### JWT Authentication with jose (Node.js 24)

```typescript
// src/services/authService.ts
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcrypt';

class AuthService {
  private secret: Uint8Array;

  constructor() {
    this.secret = new TextEncoder().encode(env.JWT_SECRET);
  }

  async generateToken(userId: string, email: string): Promise<string> {
    return new SignJWT({ userId, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.secret);
  }

  async verifyToken(token: string): Promise<{ userId: string; email: string }> {
    const { payload } = await jwtVerify(token, this.secret);
    return payload as { userId: string; email: string };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export const authService = new AuthService();
```

### Express 5 Async Error Handling

```typescript
// Express 5 automatically catches promise rejections
app.get('/photos', async (req, res) => {
  const photos = await prisma.photo.findMany();
  res.json({ success: true, data: photos });
  // No try-catch needed!
});
```

### TypeScript Import Extensions
**CRITICAL:** Always use `.js` extension in imports, even for `.ts` files:

```typescript
// ✅ Correct
import { fileService } from './services/fileService.js';

// ❌ Wrong - will cause module resolution errors
import { fileService } from './services/fileService';
```

### Error Handling
```typescript
// Express 5 handles async errors automatically
export const getPhotos = async (req: Request, res: Response) => {
  const photos = await prisma.photo.findMany();
  res.json({ success: true, data: photos });
};
```

### Environment Validation
```typescript
// src/config/env.ts - validate all env vars with Zod
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  // ... all other env vars
});

export const env = envSchema.parse(process.env);
```

---

## Deployment Checklist

### Before Deploying

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations run (Prisma 6)
- [ ] Frontend build successful
- [ ] API endpoints tested
- [ ] Azure API keys valid (2023-10-01 GA)
- [ ] Cloudflare Tunnel configured (2025.8.1)
- [ ] HTTPS enforced
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] jose JWT authentication working
- [ ] PostgreSQL 18 async I/O enabled
- [ ] Backup strategy in place

---

## Important Reminders

1. **jose for JWT:** Always use jose, NOT jsonwebtoken (Node.js 24 requirement)
2. **Prisma 6 Generator:** Use "prisma-client" not "prisma-client-js"
3. **PostgreSQL 18:** Enable io_uring for 3x performance boost
4. **Express 5:** No try-catch needed for async routes
5. **React 19 Compatibility:** Check dependencies before upgrading
6. **Privacy First:** Never store or log personal photo content
7. **Cost Awareness:** Monitor Azure usage to stay in free tier
8. **Security:** All user data encrypted, all API calls authenticated
9. **TypeScript:** Use strict mode, leverage Prisma-generated types
10. **Import Extensions:** Always use `.js` in TypeScript imports

---

**Last Updated:** November 29, 2025
**Project Status:** Phase 2 Complete - Production Live
**Production URL:** https://piclyai.net
**Critical Changes:** Zustand for state (not Context), jose for JWT (Node.js 24), Prisma 6 Rust-free, heic-convert for iPhone photos