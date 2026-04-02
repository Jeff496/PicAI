# Backend CLAUDE.md - PicAI Express API

**Last Updated:** February 8, 2026
**Status:** Phase 5 Complete - Groups, Invites & UI Refresh

**Technology:** Node.js 24.11.1 + TypeScript 5.9.3 + Express 5.1.0 + Prisma 6.19.0 + @supabase/supabase-js

Backend-specific guidance for the PicAI Express.js API.

**See main `CLAUDE.md` in project root for:** architecture, conventions, security requirements, environment variables, and deployment checklist.

**📁 Additional Context Files (in `/.claude/context/`):**
- `backend/common-mistakes.md` - Backend-specific pitfalls
- `backend/file-structure.md` - Detailed backend file structure
- `backend/component-examples.md` - Working backend code examples
- `shared/conventions.md` - Shared coding standards

---

## Project Structure

### Current Files (Implemented)

```
backend/
├── src/
│   ├── index.ts                      # Express server entry point
│   ├── config/
│   │   ├── env.ts                    # Environment validation with Zod
│   │   └── supabase.ts               # Supabase client instance
│   ├── types/
│   │   └── express.d.ts              # Express type extensions (req.user, req.id)
│   ├── routes/
│   │   ├── auth.routes.ts            # POST /auth/login, /register, /refresh, /logout, GET /me
│   │   ├── photos.routes.ts          # Photo upload, list, get, delete, thumbnails, tags, faces
│   │   ├── ai.routes.ts              # AI analysis endpoints
│   │   ├── faces.routes.ts           # Face tagging endpoints
│   │   ├── people.routes.ts          # Person management endpoints
│   │   ├── groups.routes.ts          # Group CRUD, membership, photos, invites
│   │   └── invites.routes.ts         # Public invite link handling
│   ├── controllers/
│   │   ├── auth.controller.ts        # Authentication logic
│   │   ├── photos.controller.ts      # Photo CRUD operations
│   │   ├── ai.controller.ts          # AI analysis controllers
│   │   ├── faces.controller.ts       # Face detection and tagging
│   │   ├── people.controller.ts      # Person CRUD operations
│   │   └── groups.controller.ts      # Group, membership, invite logic
│   ├── services/
│   │   ├── fileService.ts            # Photo storage, thumbnails, HEIC, AWS cleanup
│   │   ├── aiService.ts              # Azure Computer Vision integration
│   │   ├── rekognitionService.ts     # AWS Rekognition face collections
│   │   ├── groupService.ts           # Group operations and membership
│   │   └── emailService.ts           # SendGrid email invitations
│   ├── middleware/
│   │   ├── auth.middleware.ts        # Supabase JWT verification
│   │   ├── validate.middleware.ts    # Zod validation
│   │   ├── error.middleware.ts       # Global error handler
│   │   └── upload.middleware.ts      # Multer configuration for photo uploads
│   ├── schemas/
│   │   ├── photo.schema.ts           # Zod schemas for photo endpoints
│   │   ├── ai.schema.ts              # Zod schemas for AI endpoints
│   │   ├── face.schema.ts            # Zod schemas for face endpoints
│   │   ├── people.schema.ts          # Zod schemas for people endpoints
│   │   └── groups.schema.ts          # Zod schemas for group endpoints
│   ├── utils/
│   │   └── logger.ts                 # Winston logger setup
│   ├── prisma/
│   │   └── client.ts                 # Prisma client instance
│   └── generated/prisma/             # Prisma generated types (auto-generated)
├── prisma/
│   ├── schema.prisma                 # Database schema (includes Face, Person, FaceCollection)
│   └── migrations/                   # Database migrations
├── pki/                              # PKI for AWS IAM Roles Anywhere (see pki/README.md)
│   ├── ca/                           # Certificate Authority files
│   │   ├── ca.key                    # CA private key (DO NOT COMMIT)
│   │   ├── ca.crt                    # CA certificate (uploaded to AWS)
│   │   └── openssl-ca.cnf            # OpenSSL configuration
│   └── certs/                        # Issued certificates
│       ├── picai-backend.key         # Backend private key (DO NOT COMMIT)
│       └── picai-backend.crt         # Backend certificate
├── storage/                          # DO NOT COMMIT
│   ├── originals/
│   └── thumbnails/
├── logs/                             # DO NOT COMMIT
├── tests/
├── scripts/
│   └── (scripts as needed)
├── .env                              # DO NOT COMMIT
├── .env.example
├── package.json
├── tsconfig.json
└── CLAUDE.md                         # This file
```

---

## Critical Backend Conventions

### 1. Import Extensions - ALWAYS Use .js

TypeScript with ES modules requires `.js` extension in imports:

```typescript
// ✅ Correct
import { authService } from './services/authService.js';
import { env } from './config/env.js';

// ❌ Wrong - will cause "Cannot find module" errors
import { authService } from './services/authService';
```

### 2. Express 5 - No asyncHandler Needed

Express 5 automatically catches promise rejections:

```typescript
// ✅ Express 5 - just use async directly
app.get('/photos', async (req, res) => {
  const photos = await prisma.photo.findMany();
  res.json({ success: true, data: photos });
});

// ❌ No longer needed
import { asyncHandler } from './utils/asyncHandler.js';
app.get('/photos', asyncHandler(async (req, res) => { ... }));
```

### 3. Error Handler Must Have 4 Parameters

```typescript
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction // ← REQUIRED even if unused
) => {
  res.status(500).json({ success: false, error: err.message });
};
```

---

## Authentication (Supabase Auth)

Authentication is handled by Supabase Auth. The frontend uses the Supabase JS client for login/register/OAuth. The backend verifies tokens via `supabase.auth.getUser(token)`.

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/auth/logout` | Yes | Logout (invalidate session) |

---

## Database (Prisma 6)

### Key Differences from Prisma 5

```prisma
generator client {
  provider = "prisma-client"  // ← Not "prisma-client-js"
  output   = "../src/generated/prisma"
}
```

### Import Types

```typescript
// Import from generated location
import { User, Photo, Album } from '../generated/prisma/index.js';

// Or use Prisma namespace
import type { User } from '@prisma/client';
```

### Common Commands

```bash
npm run db:migrate      # Create migration
npm run db:generate     # Regenerate client
npm run db:studio       # Open Prisma Studio
```

---

## Validation (Zod)

Schemas are in `src/schemas/`. Example:

```typescript
// src/schemas/auth.schema.ts
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
});

// Usage in route
router.post('/register', validateRequest(registerSchema), authController.register);
```

---

## Photo Endpoints (Implemented)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/photos/upload` | Yes | Upload photos (max 50, 25MB each) |
| GET | `/api/photos` | Yes | List user's photos with pagination |
| GET | `/api/photos/:id` | Yes | Get single photo details |
| GET | `/api/photos/:id/file` | Yes | Get original image file |
| GET | `/api/photos/:id/thumbnail` | Yes | Get thumbnail (200x200) |
| DELETE | `/api/photos/:id` | Yes | Delete photo |

### File Upload Configuration

```typescript
// src/middleware/upload.middleware.ts
import multer from 'multer';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: env.MAX_FILE_SIZE, // 25MB
    files: 50
  }
});
```

---

## HEIC to JPEG Conversion

HEIC/HEIF files (iPhone default format) are converted to JPEG on upload using `heic-convert`.

**Why heic-convert instead of Sharp?**
- Sharp's prebuilt binaries don't include HEIC support (patent licensing)
- Building libvips from source with HEIC requires maintenance on every Sharp update
- `heic-convert` is a pure npm solution with no system dependencies

**Installation:**
```bash
npm install heic-convert
npm install -D @types/heic-convert  # if types exist
```

**Usage in fileService.ts:**
```typescript
import heicConvert from 'heic-convert';

async savePhoto(buffer: Buffer, originalName: string, userId: string) {
  let processedBuffer = buffer;
  const ext = path.extname(originalName).toLowerCase();

  // Convert HEIC/HEIF to JPEG
  if (ext === '.heic' || ext === '.heif') {
    processedBuffer = Buffer.from(
      await heicConvert({
        buffer: buffer,
        format: 'JPEG',
        quality: 0.9,
      })
    );
  }

  // Now use Sharp for thumbnails, metadata, etc.
  const metadata = await sharp(processedBuffer).metadata();
  // ... rest of save logic
}
```

**Note:** Conversion happens server-side. Frontend receives JPEGs regardless of original format.

---

## Azure Computer Vision (Implemented)

```typescript
// Using 2023-10-01 GA API - see src/services/aiService.ts
const response = await axios.post(
  `${env.AZURE_VISION_ENDPOINT}/computervision/imageanalysis:analyze?api-version=2023-10-01`,
  imageBuffer,
  {
    params: { features: 'tags,objects,read,people' },
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_VISION_KEY,
      'Content-Type': 'application/octet-stream'
    }
  }
);
```

**Features Used:** `tags`, `objects`, `read` (OCR), `people`

> **Note:** `caption` and `denseCaptions` are NOT used due to region restrictions. These features only work in: East US, France Central, Korea Central, North Europe, Southeast Asia, West Europe, West US.

**Rate Limits:** 20 calls/minute, 5,000/month (free tier) - handled by built-in rate limiter

---

## AWS Rekognition (Implemented)

Face detection and recognition for photo organization using IAM Roles Anywhere.

### Authentication

Uses X.509 certificates instead of static AWS credentials:

```typescript
// src/services/rekognitionService.ts
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { fromProcess } from '@aws-sdk/credential-providers';

const client = new RekognitionClient({
  region: env.AWS_REGION,
  credentials: fromProcess({ profile: env.AWS_PROFILE }),
});
```

### PKI Infrastructure

Certificates located in `backend/pki/`:
- `ca/ca.crt` - CA certificate (uploaded to AWS trust anchor)
- `certs/picai-backend.crt` - Backend certificate
- `certs/picai-backend.key` - Backend private key (**DO NOT COMMIT**)

See `pki/README.md` for certificate renewal procedures.

### Face Detection Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/photos/:id/detect-faces` | Yes | Detect faces in photo (manual trigger) |
| GET | `/api/photos/:id/faces` | Yes | Get detected faces in photo |
| POST | `/api/faces/:id/tag` | Yes | Tag face → link to person, index to AWS |
| DELETE | `/api/faces/:id/tag` | Yes | Remove face tag |

### People Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/people` | Yes | List people in user's collection |
| GET | `/api/people/:id` | Yes | Get person details |
| PUT | `/api/people/:id` | Yes | Update person name |
| DELETE | `/api/people/:id` | Yes | Delete person (cleanup AWS) |
| GET | `/api/people/:id/photos` | Yes | Get photos containing person |

### Key Design Decisions

- **Manual face detection:** Users trigger detection via button (conserves 5,000/month API limit)
- **Personal collections only:** Each user has one face collection (no album-level collections)
- **Lazy collection creation:** AWS collection created only when first face is indexed
- **AWS cleanup on deletion:** Photo/person deletion removes indexed faces from AWS

### Configuration Constants (rekognitionService.ts)

```typescript
FACE_DETECTION_THRESHOLD = 90  // Min confidence for face detection
FACE_MATCH_THRESHOLD = 80      // Min similarity for face matching
MAX_FACES_TO_DETECT = 10       // Max faces per photo
```

### Rate Limits

- Face detection: 50 requests/15min per IP
- AWS Free Tier: 5,000 DetectFaces/month, 1,000 IndexFaces/month

**Documentation:** `docs/AWS_REKOGNITION_SETUP.md`

---

## Groups & Invites (Phase 5 - Implemented)

### Group Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/groups` | Yes | Create group (creator becomes owner) |
| GET | `/api/groups` | Yes | List user's groups (paginated) |
| GET | `/api/groups/:id` | Yes | Get group details (members only) |
| PUT | `/api/groups/:id` | Yes | Update name/description (owner only) |
| DELETE | `/api/groups/:id` | Yes | Delete group (owner only, cascade) |
| GET | `/api/groups/:id/photos` | Yes | List photos in group (paginated) |
| GET | `/api/groups/:id/members` | Yes | List members with roles |
| PUT | `/api/groups/:id/members/:userId` | Yes | Update member role (owner only) |
| DELETE | `/api/groups/:id/members/:userId` | Yes | Remove member (owner/admin) |
| DELETE | `/api/groups/:id/leave` | Yes | Leave group (non-owner) |
| POST | `/api/groups/:id/invites` | Yes | Create invite link (owner/admin) |
| GET | `/api/groups/:id/invites` | Yes | List invites (owner/admin) |
| DELETE | `/api/groups/:id/invites/:inviteId` | Yes | Revoke invite (owner/admin) |
| POST | `/api/groups/:id/invite-email` | Yes | Send email invite via SendGrid (owner/admin) |

### Public Invite Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/invites/:token` | No | Get invite info (group name, inviter) |
| POST | `/api/invites/:token/join` | Yes | Accept invite and join group |

### Key Design Decisions

- **Role-based access:** owner > admin > member with specific permission gates
- **Invite links:** Token-based with optional expiration and max-use limits
- **Email invites:** Via SendGrid with invite link in email body
- **Cascade delete:** Deleting a group removes memberships, invites (photos set to null)
- **Rate limiting:** Group invites limited to 50/hour per IP

---

## SSE Progress Streaming (Phase 4.7)

Server-Sent Events endpoints for bulk operations with real-time progress.

### SSE Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/photos/bulk-detect-faces-progress` | Yes | Bulk face detection with SSE progress |
| POST | `/api/ai/analyze-bulk-progress` | Yes | Bulk AI analysis with SSE progress |

### SSE Response Format

```typescript
// Set SSE headers
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no');  // Disable nginx buffering
res.flushHeaders();

// Send events
const sendEvent = (data: object) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// Event types
sendEvent({ type: 'start', total: photoIds.length });
sendEvent({ type: 'progress', current: i + 1, total, photoId, success: true, facesDetected: 3 });
sendEvent({ type: 'complete', summary: { total, succeeded, failed, totalFacesDetected } });

res.end();
```

### Key Implementation Details

1. **Sequential processing** - Photos processed one at a time for predictable progress
2. **Error isolation** - One photo's failure doesn't stop the entire operation
3. **AWS cleanup on re-detection** - Indexed faces removed from AWS before new detection
4. **Nginx compatibility** - `X-Accel-Buffering: no` header prevents proxy buffering

### Controller Pattern

```typescript
// src/controllers/faces.controller.ts
export const bulkDetectFacesWithProgress = async (req: Request, res: Response): Promise<void> => {
  // Validation
  const { photoIds } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: 'start', total: photoIds.length });

  let succeeded = 0, failed = 0, totalFaces = 0;

  for (let i = 0; i < photoIds.length; i++) {
    const photoId = photoIds[i]!;
    try {
      const result = await rekognitionService.detectFacesForPhoto(photoId);
      succeeded++;
      totalFaces += result.faces.length;
      sendEvent({ type: 'progress', current: i + 1, total: photoIds.length, photoId, success: true, facesDetected: result.faces.length });
    } catch (error) {
      failed++;
      sendEvent({ type: 'progress', current: i + 1, total: photoIds.length, photoId, success: false, error: error.message });
    }
  }

  sendEvent({ type: 'complete', summary: { total: photoIds.length, succeeded, failed, totalFacesDetected: totalFaces } });
  res.end();
};
```

---

## Development Commands

```bash
npm run dev           # Start with hot reload (tsx watch)
npm run build         # Compile TypeScript
npm run type-check    # Check types without building
npm run test          # Run tests
npm run test:auth     # Run auth tests only
npm run verify:auth   # Run auth verification script
npm run lint          # ESLint
npm run format        # Prettier
```

---

## Quick Reminders

1. **Supabase Auth** - Tokens verified via `supabase.auth.getUser()`
2. **`.js` in imports** - TypeScript ES modules requirement
3. **Express 5** - No try-catch or asyncHandler needed
4. **Prisma 6** - Use `"prisma-client"` generator
5. **Zod validation** - All request bodies validated
6. **Environment** - See `src/config/env.ts` for all required vars
7. **PKI Security** - Never commit `pki/**/*.key` files
8. **AWS Auth** - Use IAM Roles Anywhere, not static credentials

---

**Last Updated:** February 8, 2026
**Status:** Phase 5 Complete - Groups, Invites & UI Refresh
**New in Phase 5:** Group CRUD with role-based membership (owner/admin/member), invite links with expiration/max-use, email invites via SendGrid, group-scoped photo management
