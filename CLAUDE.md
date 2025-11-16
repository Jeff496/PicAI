# CLAUDE.md - PicAI Main Project Guide

**Last Updated:** November 15, 2025
**Status:** Ready for Development

This file provides guidance to Claude Code when working in the PicAI repository.

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
- React 19.2 with TypeScript 5.9
- Hosted on Azure Static Web Apps (Free tier)
- TailwindCSS 4.1 for styling
- Vite 7.2 for build tooling
- Axios for API calls
- React Query 5.90 for server state
- JWT authentication stored in localStorage

**Backend:**
- Node.js 24.11.1 + Express 5.1 on Raspberry Pi 5
- TypeScript 5.9.3
- PostgreSQL 15 database
- Prisma 6.19 ORM for database access
- Multer 2.0 for file uploads
- Sharp 0.34 for image processing (thumbnails)
- JWT authentication (jsonwebtoken 9.0)
- Zod 4.1 for validation

**Infrastructure:**
- Cloudflare Tunnel exposes Pi backend securely
- Azure Computer Vision API (F0 Free tier) for image analysis
- Local file storage on Pi (originals + thumbnails)

**Communication:**
- Frontend calls backend via Cloudflare Tunnel: `https://piclyai.net/api/*`
- Backend calls Azure Computer Vision API when photos uploaded
- All communication over HTTPS

---

## Core Data Models

### Database Schema (PostgreSQL with Prisma)

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
│   │   │   ├── express.d.ts   # Express type extensions
│   │   │   └── api.types.ts   # API response types
│   │   ├── routes/            # API route handlers
│   │   ├── controllers/       # Business logic
│   │   ├── services/          # AI service, file service, album service
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── utils/             # Helpers, logger
│   │   └── prisma/            # Database schema & migrations
│   ├── storage/               # DO NOT COMMIT - local photos
│   │   ├── originals/
│   │   └── thumbnails/
│   ├── logs/                  # Application logs
│   ├── tests/
│   ├── .env                   # DO NOT COMMIT
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── CLAUDE.md              # Backend-specific guidance
├── frontend/                   # React app
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page-level components
│   │   ├── context/           # React Context for global state
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API client
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Helper functions
│   ├── public/
│   ├── .env                   # DO NOT COMMIT
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── CLAUDE.md              # Frontend-specific guidance
├── docs/                       # Documentation
│   ├── architecture.md
│   ├── azure-setup.md
│   └── (other setup guides)
├── .github/
│   └── workflows/             # CI/CD pipelines (auto-created by Azure)
├── CLAUDE.md                   # This file
├── PRD.md                      # Product requirements
├── README.md
└── .gitignore
```

---

## Development Conventions

### Code Style
- **Language:** TypeScript 5.9 everywhere
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
- **Authentication:** JWT in Authorization header: `Bearer <token>`

### Database Best Practices
- **Always use Prisma ORM** - Never write raw SQL unless absolutely necessary
- **Migrations:** Create migration for every schema change
- **Transactions:** Use for multi-step operations (e.g., creating album + adding photos)
- **Indexes:** Ensure indexes on foreign keys and frequently queried fields
- **UUIDs:** Use for all primary keys
- **Timestamps:** Always include `created_at` and `updated_at` where relevant

---

## Security Requirements

### Critical Security Rules
1. **Never commit secrets** - Use environment variables for all sensitive data
2. **Validate all inputs** - Use Zod for request validation
3. **Sanitize file uploads** - Check MIME type, file size, and extension
4. **Use parameterized queries** - Prisma handles this automatically
5. **HTTPS only** - No unencrypted communication
6. **Rate limiting** - Implement on all public endpoints (100 req/min per IP)
7. **Password hashing** - Always use bcrypt with salt rounds = 10
8. **JWT expiration** - 7 days default, 30 days with "remember me"

### File Upload Security
- **Allowed types:** JPEG, PNG, HEIC only
- **Max size:** 25MB per file
- **Filename sanitization:** Remove special chars, generate unique names (UUID)
- **Storage location:** Outside web root, serve via controlled endpoint
- **Virus scanning:** Consider ClamAV integration if storage allows (post-MVP)

---

## AI Integration Guidelines

### Azure Computer Vision Usage

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

**Caching Strategy:**
- Store AI results in database - don't re-analyze same photo
- Only re-analyze if user explicitly requests it

**Rate Limit Handling:**
- Azure free tier: 5,000/month, 20/minute
- Implement request queue if approaching limits
- Show user feedback: "Processing... this may take a minute"
- Retry with exponential backoff on rate limit errors

**Error Handling:**
- If Azure API fails, store photo without tags
- Allow manual retry later
- Log errors for debugging

### Album Generation Logic

**Time-Based Albums:**
- Query photos by date ranges
- Group by day, month, or year
- Auto-generate titles: "November 15, 2025", "November 2025", "2025"

**Content-Based Albums:**
- Search AI tags for matching criteria
- Use fuzzy matching (e.g., "dog" matches "puppy", "canine")
- Support multiple tags: "beach AND sunset"
- Require minimum 3 photos to create album

**Smart Suggestions:**
- Detect patterns (e.g., 20+ photos in one day → "Event Album?")
- Suggest based on high-frequency tags ("Lots of food photos → Recipe Collection?")

---

## Performance Optimization

### Raspberry Pi Constraints
- **Limited RAM:** Keep processes lightweight, avoid loading large files in memory
- **Disk I/O:** Use SSDs over microSD for better performance
- **CPU:** Use streams for file operations, async/await for I/O

### Image Handling
- **Thumbnails:** Always generate 200x200px for grid views
- **Lazy loading:** Frontend loads thumbnails first, full images on demand
- **Streaming:** Stream photo files, don't load entire file in memory
- **Compression:** Use Sharp with quality=80 for thumbnails

### Database Optimization
- **Indexes:** Ensure indexes on `user_id`, `group_id`, `uploaded_at`, `tag`
- **Pagination:** Always paginate large queries (50 items per page)
- **Connection pooling:** Configure Prisma connection pool (default max=10 is fine)
- **Query optimization:** Use `select` to only fetch needed fields

### API Performance
- **Caching:** Use in-memory cache for frequent queries (Redis post-MVP)
- **Compression:** Enable gzip compression on API responses
- **Batch operations:** Support bulk upload/tagging where possible

---

## Environment Variables

### Backend (.env)
```bash
# Server
NODE_ENV=development
PORT=3001
FRONTEND_URL=https://your-azure-static-web-app.azurestaticapps.net

# Database
DATABASE_URL=postgresql://picai_user:password@localhost:5432/picai

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRATION=7d

# Azure Computer Vision
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

## Technology Stack Summary

### Backend
- Node.js 24.11.1
- TypeScript 5.9.3
- Express 5.1.0
- Prisma 6.19.0
- PostgreSQL 15
- Bcrypt 6.0.0
- Zod 4.1.12
- Sharp 0.34.5
- Winston 3.18.3

### Frontend
- React 19.2.0
- TypeScript 5.9.3
- Vite 7.2.2
- TailwindCSS 4.1.17
- React Router 7.9.6
- React Query 5.90.9
- Axios 1.13.2
- Zod 4.1.12

### Infrastructure
- Raspberry Pi 5
- PostgreSQL 15
- Cloudflare Tunnel (free)
- Azure Computer Vision API (F0 free tier)
- Azure Static Web Apps (free tier)

---

## Common Patterns

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
// Always wrap async routes with try-catch or asyncHandler
import { asyncHandler } from '../utils/asyncHandler.js';

export const getPhotos = asyncHandler(async (req, res) => {
  const photos = await prisma.photo.findMany();
  res.json({ success: true, data: photos });
});
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
- [ ] Database migrations run
- [ ] Frontend build successful
- [ ] API endpoints tested
- [ ] Azure API keys valid
- [ ] Cloudflare Tunnel configured
- [ ] HTTPS enforced
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] Backup strategy in place

---

## Monitoring & Maintenance

### What to Monitor

- **Disk usage:** Alert at 80% full
- **Database size:** Monitor growth rate
- **API response times:** Alert if > 2 seconds
- **Error rates:** Alert if > 5% of requests fail
- **Azure API usage:** Track monthly quota (5,000/month free tier)
- **Cloudflare Tunnel status:** Auto-restart if down

### Logs

- **Backend:** Use Winston for structured logging
- **Rotate logs:** Daily rotation, keep 7 days
- **Log levels:** ERROR, WARN, INFO, DEBUG
- **Never log:** Passwords, JWT tokens, API keys

### Backups

- **Database:** Daily automated backups, keep 7 days
- **Photos:** Weekly backup to external drive
- **Restoration:** Test backup restoration monthly

---

## Resources & Documentation

- **Full PRD:** See `PRD.md` in project root
- **Architecture Details:** See `docs/architecture.md`
- **Azure Setup Guide:** See `docs/azure-setup.md`
- **Backend Patterns:** See `backend/CLAUDE.md`
- **Frontend Patterns:** See `frontend/CLAUDE.md`

---

## Important Reminders

1. **Privacy First:** Never store or log personal photo content
2. **Cost Awareness:** Monitor Azure usage to stay in free tier
3. **Security:** All user data encrypted, all API calls authenticated
4. **Performance:** Optimize for Raspberry Pi constraints
5. **User Experience:** Always show loading states, clear error messages
6. **Testing:** Write tests before deploying new features
7. **Documentation:** Update CLAUDE.md when patterns change
8. **TypeScript:** Use strict mode, leverage Prisma-generated types
9. **Validation:** Always use Zod for input validation
10. **Import Extensions:** Always use `.js` in TypeScript imports

---

**Last Updated:** November 15, 2025
**Project Status:** Ready for Phase 1 Development
**Current Phase:** Authentication + Basic API Setup