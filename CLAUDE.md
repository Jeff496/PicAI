# CLAUDE.md - PicAI Main Project Guide

**Last Updated:** February 8, 2026
**Status:** Phase 5 Complete - Groups, Invites & UI Refresh

This file provides guidance to Claude Code when working in the PicAI repository.

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
- Zustand 5.0.8 for client state (auth + theme with localStorage persistence)
- TanStack Query 5.90.9 for server state
- Axios 1.13.2 for API calls (with token refresh interceptors)
- React Router DOM 7.9.6 for routing
- Lucide React for icons
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
- **@aws-sdk/client-rekognition** for face detection and collections
- **@aws-sdk/credential-providers** for IAM Roles Anywhere authentication
- Zod 4.1.12 for validation (14x faster parsing)
- @sendgrid/mail for group email invitations

**Infrastructure:**
- Cloudflare Tunnel 2025.8.1 (UDP proxy rearchitecture)
- Azure Computer Vision API 2023-10-01 GA (F0 Free tier)
- AWS Rekognition API (Face detection and collections with IAM Roles Anywhere)
- Local file storage on Pi (originals + thumbnails)

**Communication:**
- Frontend calls backend via Cloudflare Tunnel: `https://piclyai.net/api/*`
- Backend calls Azure Computer Vision API when photos uploaded (auto-tagging)
- Backend calls AWS Rekognition API on manual face detection trigger
- All communication over HTTPS

---

## Core Data Models

### Database Schema (PostgreSQL 18 with Prisma 6)

**Primary Tables:**
1. **users** - User accounts (id, email, password_hash, name, profile_picture_url)
2. **groups** - Photo sharing groups (id, name, description, created_by)
3. **group_memberships** - User-group relationships (id, group_id, user_id, role)
4. **group_invites** - Invite links with optional expiry/max uses (id, group_id, token, expires_at, max_uses, use_count, created_by)
5. **photos** - Photo metadata (id, user_id, group_id, filename, file_path, thumbnail_path, uploaded_at, taken_at)
6. **ai_tags** - AI-generated labels (id, photo_id, tag, confidence, category)
7. **albums** - Photo collections (id, name, user_id, group_id, is_auto_generated, generation_criteria)
8. **album_photos** - Many-to-many album-photo relationship
9. **share_links** - Public album sharing (id, album_id, token, expires_at)
10. **face_collections** - AWS Rekognition collection per user (1:1 with user)
11. **people** - Named individuals for face tagging (id, name, collection_id)
12. **faces** - Detected faces with bounding boxes (id, photo_id, person_id, aws_face_id, bounding_box, confidence)

**Key Relationships:**
- Users can belong to multiple groups (via group_memberships with role: owner/admin/member)
- Photos belong to one user and optionally one group
- Photos can have multiple AI tags and detected faces
- Faces can be linked to a Person for recognition
- Each user has one FaceCollection (created lazily)
- Albums can contain multiple photos, photos can be in multiple albums
- Share links are tied to specific albums
- Group invites support expiration and use limits

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
│   │   │   ├── auth.routes.ts # Auth endpoints
│   │   │   ├── photos.routes.ts # Photo CRUD + tag management
│   │   │   ├── ai.routes.ts   # AI analysis endpoints
│   │   │   ├── faces.routes.ts # Face tagging endpoints
│   │   │   ├── people.routes.ts # Person management endpoints
│   │   │   ├── groups.routes.ts # Group CRUD, membership, invites
│   │   │   └── invites.routes.ts # Public invite link handling
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── photos.controller.ts
│   │   │   ├── ai.controller.ts
│   │   │   ├── faces.controller.ts
│   │   │   ├── people.controller.ts
│   │   │   └── groups.controller.ts
│   │   ├── services/
│   │   │   ├── authService.ts # JWT with jose
│   │   │   ├── fileService.ts # Photo storage, thumbnails, HEIC conversion
│   │   │   ├── aiService.ts   # Azure Computer Vision integration
│   │   │   ├── rekognitionService.ts # AWS Rekognition face collections
│   │   │   ├── groupService.ts # Group operations and membership
│   │   │   └── emailService.ts # SendGrid email invitations
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validate.middleware.ts
│   │   │   ├── upload.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── schemas/
│   │   │   ├── auth.schema.ts # Zod schemas
│   │   │   ├── photo.schema.ts
│   │   │   ├── ai.schema.ts
│   │   │   ├── face.schema.ts
│   │   │   ├── people.schema.ts
│   │   │   └── groups.schema.ts
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
├── frontend/                   # React app (Phase 5 Complete)
│   ├── src/
│   │   ├── main.tsx           # Entry point with React Query + Sonner
│   │   ├── App.tsx            # Router configuration
│   │   ├── index.css          # TailwindCSS 4 config
│   │   ├── stores/
│   │   │   ├── authStore.ts   # Zustand auth state
│   │   │   └── themeStore.ts  # Zustand theme state (light/dark)
│   │   ├── services/
│   │   │   ├── api.ts         # Axios with JWT interceptors
│   │   │   ├── auth.ts        # Auth API service
│   │   │   ├── photos.ts      # Photo API service + AI methods
│   │   │   ├── faces.ts       # Face detection & people management API
│   │   │   └── groups.ts      # Group CRUD, membership, invites API
│   │   ├── utils/
│   │   │   └── toast.ts       # Toast utilities for bulk operation feedback
│   │   ├── hooks/
│   │   │   ├── usePhotos.ts   # TanStack Query hooks + AI mutations
│   │   │   ├── useFaces.ts    # Face detection & people management hooks
│   │   │   ├── useGroups.ts   # Group CRUD, membership, invite hooks
│   │   │   ├── useBulkProgress.ts # SSE-based bulk operation progress tracking
│   │   │   └── usePhotoSelection.ts # Selection mode state management
│   │   ├── types/
│   │   │   └── api.ts         # TypeScript interfaces
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx    # Public landing page with hero + features
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── PhotosPage.tsx     # Gallery with tag/group filter
│   │   │   ├── PeoplePage.tsx     # People browser
│   │   │   ├── PersonPhotosPage.tsx # Photos of specific person
│   │   │   ├── GroupsPage.tsx     # Group list
│   │   │   ├── GroupDetailPage.tsx # Group photos + members + invites
│   │   │   └── InvitePage.tsx     # Public invite acceptance
│   │   └── components/
│   │       ├── layout/
│   │       │   ├── AppLayout.tsx      # Header, nav, theme toggle, logout
│   │       │   └── ProtectedRoute.tsx
│   │       ├── photos/
│   │       │   ├── index.ts       # Barrel export
│   │       │   ├── PhotoCard.tsx
│   │       │   ├── PhotoGrid.tsx
│   │       │   ├── UploadForm.tsx
│   │       │   ├── PhotoViewer.tsx # Full-screen modal + TagManagement
│   │       │   ├── TagFilter.tsx
│   │       │   ├── TagManagement.tsx
│   │       │   ├── BulkActionBar.tsx
│   │       │   └── BulkProgressModal.tsx
│   │       ├── faces/
│   │       │   ├── index.ts
│   │       │   ├── FaceOverlay.tsx
│   │       │   ├── FaceTagPopup.tsx
│   │       │   └── DetectFacesButton.tsx
│   │       ├── people/
│   │       │   ├── index.ts
│   │       │   ├── PersonCard.tsx
│   │       │   └── PersonGrid.tsx
│   │       └── groups/
│   │           ├── GroupCard.tsx
│   │           ├── GroupMemberList.tsx
│   │           ├── CreateGroupModal.tsx
│   │           ├── InviteLinkModal.tsx
│   │           └── EmailInviteModal.tsx
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
  - PKI private keys (`backend/pki/**/*.key`)

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
- Tags/Scenes (e.g., "beach", "mountain", "indoor")
- Text (OCR for signs, documents)
- People (count, NOT identification)

> **Note:** Caption features (`caption`, `denseCaptions`) are NOT used due to region restrictions. These features are only available in: East US, France Central, Korea Central, North Europe, Southeast Asia, West Europe, West US.

**How to Store:**
- Save each tag as separate record in `ai_tags` table
- Include confidence score (0.00 to 1.00)
- Include category ("tag", "object", "text", "people", "manual")
- Use confidence threshold: Only store tags with confidence > 0.5

**API Version:**
- Use 2023-10-01 GA version (preview versions retiring March 31, 2025)
- SDK: `@azure-rest/ai-vision-image-analysis` 1.0.0-beta.3

**Rate Limit Handling:**
- Azure free tier: 5,000/month, 20/minute
- Implement request queue if approaching limits
- Show user feedback: "Processing... this may take a minute"
- Retry with exponential backoff on rate limit errors

### AWS Rekognition (Face Collections) - Implemented

**Purpose:** Face detection and recognition for photo organization
**Authentication:** IAM Roles Anywhere with X.509 certificates (no static credentials)
**Region:** us-east-1
**Status:** ✅ Complete (December 9, 2025)

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/photos/:id/detect-faces` | Manual trigger for face detection |
| GET | `/api/photos/:id/faces` | Get detected faces with bounding boxes |
| POST | `/api/faces/:id/tag` | Tag face → create/link Person, index to AWS |
| DELETE | `/api/faces/:id/tag` | Remove face tag, cleanup AWS |
| GET | `/api/people` | List people in user's collection |
| GET | `/api/people/:id` | Get person details |
| PUT | `/api/people/:id` | Update person name |
| DELETE | `/api/people/:id` | Delete person (cleanup AWS) |
| GET | `/api/people/:id/photos` | Get photos containing person |

**How Face Collections Work:**
- Each user gets ONE personal face collection (created lazily on first face index)
- Manual face detection trigger (conserves API quota)
- Faces indexed to AWS only when user explicitly tags them
- AWS cleanup on photo/person deletion

**Database Models:**
- `FaceCollection`: Links user to AWS collection ID
- `Person`: Known person with user-assigned name
- `Face`: Individual face detected in a photo (with bounding box)

**Rate Limits (Free Tier - First 12 Months):**
- DetectFaces: 5,000/month (rate limited: 50 req/15min per IP)
- IndexFaces: 1,000/month
- SearchFaces: Unlimited on indexed faces
- Face Storage: 1,000 faces/month

**Security:**
- Uses PKI infrastructure in `backend/pki/`
- CA certificate uploaded to AWS IAM Roles Anywhere trust anchor
- Backend certificate used by AWS signing helper for authentication
- No static AWS credentials stored

**Documentation:**
- Setup guide: `docs/AWS_REKOGNITION_SETUP.md`
- PKI details: `backend/pki/README.md`

### Groups & Invites (Phase 5) - Implemented

**Purpose:** Collaborative photo sharing with role-based membership
**Status:** ✅ Complete (February 2026)

**Group Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups` | Create group |
| GET | `/api/groups` | List user's groups (paginated) |
| GET | `/api/groups/:id` | Get group details |
| PUT | `/api/groups/:id` | Update group (owner only) |
| DELETE | `/api/groups/:id` | Delete group (owner only) |
| GET | `/api/groups/:id/photos` | List photos in group |
| GET | `/api/groups/:id/members` | List members |
| PUT | `/api/groups/:id/members/:userId` | Update member role (owner only) |
| DELETE | `/api/groups/:id/members/:userId` | Remove member |
| DELETE | `/api/groups/:id/leave` | Leave group |
| POST | `/api/groups/:id/invites` | Create invite link (owner/admin) |
| GET | `/api/groups/:id/invites` | List invites (owner/admin) |
| DELETE | `/api/groups/:id/invites/:inviteId` | Revoke invite (owner/admin) |
| POST | `/api/groups/:id/invite-email` | Send email invite (owner/admin) |

**Public Invite Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invites/:token` | Get invite info (public, no auth) |
| POST | `/api/invites/:token/join` | Join via invite link (auth required) |

**Key Features:**
- Role-based membership: owner, admin, member
- Invite links with optional expiration and max-use limits
- Email invitations via SendGrid
- Group-scoped photo upload, viewing, and bulk operations
- Owner can edit/delete group and manage member roles
- Members can leave, admins can invite

### Bulk Operations with SSE Progress Streaming (Phase 4.7)

**Purpose:** Real-time progress feedback for bulk photo operations
**Status:** ✅ Complete (December 13, 2025)

**SSE Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/photos/bulk-detect-faces-progress` | Bulk face detection with SSE progress |
| POST | `/api/ai/analyze-bulk-progress` | Bulk AI analysis with SSE progress |

**How SSE Progress Works:**
1. Frontend sends POST request with `Accept: text/event-stream` header
2. Backend streams progress events as each photo is processed
3. Frontend parses SSE events using fetch readable streams (not EventSource)
4. Progress modal shows real-time per-photo status

**Event Types:**
```typescript
// Start event - sent when processing begins
{ type: 'start', total: number }

// Progress event - sent after each photo is processed
{ type: 'progress', current: number, total: number, photoId: string, success: boolean, facesDetected?: number, error?: string }

// Complete event - sent when all photos are done
{ type: 'complete', summary: { total: number, succeeded: number, failed: number, totalFacesDetected?: number } }
```

**Frontend Components:**
- `useBulkProgress` hook - SSE connection management with abort support
- `BulkProgressModal` - Real-time progress bar and per-photo results
- `BulkActionBar` - Toolbar with select mode and bulk action buttons
- `showBulkOperationToast()` - Success/warning/error toast notifications (Sonner)

**Why SSE over WebSocket?**
- Simpler implementation (no bidirectional communication needed)
- Works with standard HTTP (no upgrade needed)
- Automatic reconnection handled by browser
- Better for one-way server-to-client updates

**Why fetch instead of EventSource?**
- EventSource only supports GET requests
- Bulk operations require POST with photoIds array
- fetch with readable streams allows full control over request/response

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
- **@sendgrid/mail** (email invitations)
- **express-rate-limit** (per-endpoint rate limiting)
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
- Zustand 5.0.8 (auth + theme state with persistence)
- Axios 1.13.2
- Lucide React (icons)
- Zod 4.1.12
- **Sonner 2.0.3** (toast notifications for bulk operations)

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
7. **Cost Awareness:** Monitor Azure and AWS usage to stay in free tier
8. **Security:** All user data encrypted, all API calls authenticated
9. **TypeScript:** Use strict mode, leverage Prisma-generated types
10. **Import Extensions:** Always use `.js` in TypeScript imports
11. **PKI Security:** Never commit `*.key` files from `backend/pki/`
12. **AWS Auth:** Use IAM Roles Anywhere (certificate-based), not static credentials

---

**Last Updated:** February 8, 2026
**Project Status:** Phase 5 Complete - Groups, Invites & UI Refresh
**Production URL:** https://piclyai.net
**Key Decisions:** Zustand for state (not Context), jose for JWT (Node.js 24), Prisma 6 Rust-free, heic-convert for iPhone photos, Azure Vision caption feature disabled (region restriction), AWS Rekognition with IAM Roles Anywhere, SendGrid for email invites, Lucide React for icons, light/dark theme support