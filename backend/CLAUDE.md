# Backend CLAUDE.md - PicAI Express API

**Technology:** Node.js 24.11.1 + TypeScript 5.9.3 + Express 5.1.0 + Prisma 6.19.0

Backend-specific guidance for the PicAI Express.js API.

**See main `CLAUDE.md` in project root for:** architecture, conventions, security requirements, environment variables, and deployment checklist.

**📁 Additional Context Files (in `backend/.claude/context/`):**
- `common-ai-mistakes.md` - Common pitfalls and how to avoid them
- `file-structure.md` - Detailed file structure reference
- `conventions-and-standards.md` - Coding standards and best practices
- `component-examples.md` - Working code examples and patterns

---

## Project Structure

### Current Files (Implemented)

```
backend/
├── src/
│   ├── index.ts                      # Express server entry point
│   ├── config/
│   │   └── env.ts                    # Environment validation with Zod
│   ├── types/
│   │   └── express.d.ts              # Express type extensions (req.user, req.id)
│   ├── routes/
│   │   └── auth.routes.ts            # POST /auth/login, /register, /refresh, /logout, GET /me
│   ├── controllers/
│   │   └── auth.controller.ts        # Authentication logic
│   ├── services/
│   │   └── authService.ts            # JWT with jose, bcrypt hashing
│   ├── middleware/
│   │   ├── auth.middleware.ts        # JWT verification
│   │   ├── validate.middleware.ts    # Zod validation
│   │   └── error.middleware.ts       # Global error handler
│   ├── schemas/
│   │   └── auth.schema.ts            # Zod schemas for auth endpoints
│   ├── utils/
│   │   └── logger.ts                 # Winston logger setup
│   ├── prisma/
│   │   └── client.ts                 # Prisma client instance
│   └── generated/prisma/             # Prisma generated types (auto-generated)
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── migrations/                   # Database migrations
├── storage/                          # DO NOT COMMIT
│   ├── originals/
│   └── thumbnails/
├── logs/                             # DO NOT COMMIT
├── tests/
├── scripts/
│   └── verify-auth.sh                # Auth verification script
├── .env                              # DO NOT COMMIT
├── .env.example
├── package.json
├── tsconfig.json
└── CLAUDE.md                         # This file
```

### Planned Files (To Be Implemented)

```
src/
├── routes/
│   ├── photos.routes.ts              # Photo upload, list, delete
│   ├── albums.routes.ts              # Album CRUD, auto-generation
│   ├── groups.routes.ts              # Group CRUD, membership
│   └── users.routes.ts               # User profile management
├── controllers/
│   ├── photos.controller.ts
│   ├── albums.controller.ts
│   ├── groups.controller.ts
│   └── users.controller.ts
├── services/
│   ├── fileService.ts                # Photo storage, thumbnails with Sharp
│   ├── aiService.ts                  # Azure Computer Vision integration
│   └── albumService.ts               # Album generation logic
├── middleware/
│   └── upload.middleware.ts          # Multer configuration
└── types/
    └── api.types.ts                  # API response types
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

## Authentication (Implemented)

### JWT Error Types

The authService exports custom error types for granular error handling:

- `TokenExpiredError` - Token has expired (client should refresh)
- `TokenInvalidError` - Token signature invalid
- `TokenMalformedError` - Token structure invalid

### Token Flow

1. **Login** → Returns `accessToken` (15min) + `refreshToken` (7d)
2. **API Requests** → Use `Authorization: Bearer <accessToken>`
3. **Token Expired** → Call `/auth/refresh` with refresh token
4. **Refresh Expired** → User must login again

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create new user |
| POST | `/api/auth/login` | No | Login, get tokens |
| POST | `/api/auth/refresh` | No | Refresh access token |
| POST | `/api/auth/logout` | Yes | Logout (invalidate session) |
| GET | `/api/auth/me` | Yes | Get current user |

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

## File Upload (Planned)

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

## Azure Computer Vision (Planned)

```typescript
// Using 2023-10-01 GA API
const response = await axios.post(
  `${env.AZURE_VISION_ENDPOINT}/computervision/imageanalysis:analyze?api-version=2023-10-01`,
  imageBuffer,
  {
    params: { features: 'tags,objects,caption,denseCaptions,read,people' },
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_VISION_KEY,
      'Content-Type': 'application/octet-stream'
    }
  }
);
```

**Rate Limits:** 20 calls/minute, 5,000/month (free tier)

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

1. **jose for JWT** - NOT jsonwebtoken (Node.js 24 requirement)
2. **`.js` in imports** - TypeScript ES modules requirement
3. **Express 5** - No try-catch or asyncHandler needed
4. **Prisma 6** - Use `"prisma-client"` generator
5. **Zod validation** - All request bodies validated
6. **Environment** - See `src/config/env.ts` for all required vars

---

**Last Updated:** November 25, 2025
