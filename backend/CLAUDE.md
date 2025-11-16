# Backend CLAUDE.md - PicAI Express API

**Technology:** Node.js 24.11.1 + TypeScript 5.9.3 + Express 5.1.0 + Prisma 6.19.0

Backend-specific guidance for the PicAI Express.js API with November 2025 technology stack.

**See main `CLAUDE.md` in project root for overall architecture and conventions.**

---

## Technology Stack (November 2025)

- **Language:** TypeScript 5.9.3 with ES modules
- **Runtime:** Node.js 24.11.1 LTS (Krypton)
- **Framework:** Express 5.1.0 (finally stable after 10 years!)
- **Database:** PostgreSQL 18.1 with Prisma 6.19.0 ORM
- **Authentication:** JWT using **jose 5.3.0** (Node.js 24 compatible, replaces jsonwebtoken)
- **File Upload:** Multer 2.0.2 (CVE-2025-47935 and CVE-2025-47944 patches)
- **Image Processing:** Sharp 0.34.5 (libvips 8.17.3)
- **Validation:** Zod 4.1.12 (14x faster, 57% smaller)
- **Logging:** Winston 3.18.3
- **Process Manager:** PM2 6.0.13 (Bun support added)

---

## Critical Updates for November 2025

### 1. JWT with jose (NOT jsonwebtoken)
**Issue:** jsonwebtoken doesn't support Node.js 24
**Solution:** Using jose for all JWT operations

```typescript
// ❌ OLD - Won't work with Node.js 24
import jwt from 'jsonwebtoken';

// ✅ NEW - Works with Node.js 24
import { SignJWT, jwtVerify } from 'jose';
```

### 2. Prisma 6 Rust-Free Architecture
```prisma
generator client {
  provider = "prisma-client"  // ← Changed from "prisma-client-js"
}
```
- 90% smaller bundles (14MB → 1.6MB)
- 3.4x faster queries
- No more binary targets configuration

### 3. Express 5 Automatic Error Handling
```typescript
// No try-catch needed for async routes!
app.get('/photos', async (req, res) => {
  const photos = await prisma.photo.findMany();
  res.json(photos);
});
```

### 4. PostgreSQL 18 Async I/O
```sql
-- Enable for 3x performance
ALTER SYSTEM SET io_method = 'io_uring';
SELECT pg_reload_conf();
```

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                      # Entry point
│   ├── types/                        # TypeScript types/interfaces
│   │   ├── express.d.ts             # Express type extensions (req.user)
│   │   └── api.types.ts             # API response types
│   ├── routes/
│   │   ├── auth.routes.ts           # POST /auth/login, /auth/register
│   │   ├── users.routes.ts          # GET/PUT /users/:id
│   │   ├── groups.routes.ts         # CRUD /groups
│   │   ├── photos.routes.ts         # POST /photos/upload, GET /photos
│   │   └── albums.routes.ts         # Album generation and management
│   ├── controllers/
│   │   ├── auth.controller.ts       # Uses jose for JWT
│   │   ├── photos.controller.ts
│   │   └── albums.controller.ts
│   ├── services/
│   │   ├── aiService.ts             # Azure Computer Vision 2023-10-01 GA
│   │   ├── fileService.ts           # Photo storage, thumbnails with Sharp
│   │   ├── albumService.ts          # Album generation logic
│   │   └── authService.ts           # JWT with jose, bcrypt hashing
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT verification using jose
│   │   ├── validate.middleware.ts   # Zod validation
│   │   ├── upload.middleware.ts     # Multer 2.0.2 config
│   │   └── error.middleware.ts      # Global error handler
│   ├── utils/
│   │   ├── logger.ts                # Winston logger setup
│   │   ├── asyncHandler.ts          # Async route wrapper
│   │   └── constants.ts             # App constants
│   ├── config/
│   │   └── env.ts                   # Environment validation with Zod
│   └── prisma/
│       ├── schema.prisma            # Database schema (Prisma 6)
│       └── migrations/              # Database migrations
├── storage/                          # DO NOT COMMIT
│   ├── originals/
│   └── thumbnails/
├── logs/                             # DO NOT COMMIT
├── dist/                             # Compiled JS (gitignored)
├── tests/
├── .env                              # DO NOT COMMIT
├── .env.example
├── tsconfig.json
├── package.json                      # With jose, not jsonwebtoken
└── CLAUDE.md                         # This file
```

---

## Critical TypeScript Conventions

### 1. Import Extensions - ALWAYS Use .js

**CRITICAL:** TypeScript with ES modules requires `.js` extension in imports:

```typescript
// ✅ Correct - always use .js extension
import { fileService } from './services/fileService.js';
import { env } from './config/env.js';
import type { Photo } from '@prisma/client';

// ❌ Wrong - will cause "Cannot find module" errors
import { fileService } from './services/fileService';
import { env } from './config/env';
```

### 2. Express Type Extensions

Create `src/types/express.d.ts`:

```typescript
import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
```

### 3. Environment Validation with Zod

`src/config/env.ts`:

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('7d'),
  AZURE_VISION_KEY: z.string().min(32),
  AZURE_VISION_ENDPOINT: z.string().url(),
  UPLOAD_DIR: z.string(),
  THUMBNAIL_DIR: z.string(),
  MAX_FILE_SIZE: z.coerce.number().default(26214400),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
```

---

## JWT Authentication with jose (Node.js 24)

### AuthService Implementation

```typescript
// src/services/authService.ts
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

class AuthService {
  private secret: Uint8Array;

  constructor() {
    // Convert JWT secret to Uint8Array for jose
    this.secret = new TextEncoder().encode(env.JWT_SECRET);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generateToken(userId: string, email: string): Promise<string> {
    const jwt = await new SignJWT({ userId, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(env.JWT_EXPIRATION || '7d')
      .setSubject(userId)
      .sign(this.secret);
    
    return jwt;
  }

  async verifyToken(token: string): Promise<{ userId: string; email: string }> {
    const { payload } = await jwtVerify(token, this.secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string
    };
  }
}

export const authService = new AuthService();
```

### JWT Middleware

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authService } from '../services/authService.js';
import prisma from '../prisma/client.js';

export const authenticateJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = await authService.verifyToken(token);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'INVALID_TOKEN'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          return res.status(401).json({
            success: false,
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        }
      }
      
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  }
);
```

---

## Express 5 Specific Features

### Automatic Promise Rejection Handling

```typescript
// Express 5 catches promise rejections automatically
app.get('/photos', async (req, res) => {
  const photos = await prisma.photo.findMany();
  res.json({ success: true, data: photos });
});

// No need for try-catch or asyncHandler wrapper!
```

### Breaking Changes from Express 4

1. **req.param() removed** - Use req.params, req.body, or req.query
2. **res.send(body, status) removed** - Chain: res.status(200).send(body)
3. **app.del() removed** - Use app.delete()
4. **res.json(obj, status) removed** - Chain: res.status(200).json(obj)

### Error Handler Must Have 4 Parameters

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction // ← REQUIRED in Express 5
) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: err.message
  });
};

// In index.ts - must be LAST middleware
app.use(errorHandler);
```

---

## Prisma 6 Patterns (Rust-Free)

### Schema Configuration

```prisma
// schema.prisma
generator client {
  provider = "prisma-client"  // ← Not "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Install PostgreSQL Adapter

```bash
npm install @prisma/adapter-pg
```

### Always Use Generated Types

```typescript
import { Photo, Album, User } from '@prisma/client';
import prisma from '../prisma/client.js';

// Types are auto-generated from schema.prisma
const user: User = await prisma.user.findUnique({
  where: { id: userId }
});

// With relations
const photoWithTags = await prisma.photo.findUnique({
  where: { id: photoId },
  include: { aiTags: true }
});
// TypeScript knows photoWithTags.aiTags is AiTag[]
```

---

## Validation with Zod 4 (14x Faster)

```typescript
// src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validateRequest = <T extends z.ZodType>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => err.message)
        });
      }
      next(error);
    }
  };
};

// Usage in routes
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100)
});

router.post(
  '/register',
  validateRequest(registerSchema),
  authController.register
);
```

---

## File Upload with Multer 2.0.2 (Security Patched)

```typescript
// src/middleware/upload.middleware.ts
import multer from 'multer';
import { env } from '../config/env.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error('Invalid file type'));
    return;
  }
  cb(null, true);
};

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: 50
  }
});

// Usage
router.post(
  '/upload',
  uploadMiddleware.array('photos', 50),
  uploadController.handleUpload
);
```

---

## Azure Computer Vision Integration (2023-10-01 GA)

```typescript
// src/services/aiService.ts
import axios from 'axios';
import fs from 'fs/promises';
import { env } from '../config/env.js';
import prisma from '../prisma/client.js';
import logger from '../utils/logger.js';

class AIService {
  async analyzePhoto(photoId: string): Promise<void> {
    try {
      const photo = await prisma.photo.findUnique({ 
        where: { id: photoId } 
      });
      
      if (!photo) throw new Error('Photo not found');

      const imageBuffer = await fs.readFile(photo.filePath);

      // Using 2023-10-01 GA API
      const response = await axios.post(
        `${env.AZURE_VISION_ENDPOINT}/computervision/imageanalysis:analyze?api-version=2023-10-01`,
        imageBuffer,
        {
          params: {
            features: 'tags,objects,caption,denseCaptions,read,people'
          },
          headers: {
            'Ocp-Apim-Subscription-Key': env.AZURE_VISION_KEY,
            'Content-Type': 'application/octet-stream'
          }
        }
      );

      await this.storeTags(photoId, response.data);
    } catch (error) {
      logger.error('Azure Vision API error:', error);
      
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        logger.warn('Rate limit hit - implementing retry');
        // TODO: Implement retry queue
      }
      
      throw error;
    }
  }

  private async storeTags(photoId: string, analysis: any): Promise<void> {
    const tags = [];

    if (analysis.tags) {
      for (const tag of analysis.tags) {
        if (tag.confidence > 0.5) {
          tags.push({
            photoId,
            tag: tag.name,
            confidence: tag.confidence,
            category: 'tag'
          });
        }
      }
    }

    if (tags.length > 0) {
      await prisma.aiTag.createMany({ data: tags });
    }
  }
}

export const aiService = new AIService();
```

---

## Package.json for November 2025

```json
{
  "name": "picai-backend",
  "version": "1.0.0",
  "description": "PicAI backend API - November 2025 Stack",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "test": "jest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^6.19.0",
    "@prisma/adapter-pg": "^6.19.0",
    "archiver": "^7.0.1",
    "axios": "^1.13.2",
    "bcrypt": "^6.0.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0",
    "jose": "^5.3.0",
    "multer": "^2.0.2",
    "prisma": "^6.19.0",
    "sharp": "^0.34.5",
    "winston": "^3.18.3",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@types/archiver": "^7.0.0",
    "@types/bcrypt": "^6.0.0",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.5",
    "@types/jest": "^30.0.0",
    "@types/multer": "^2.0.0",
    "@types/node": "^24.10.1",
    "jest": "^30.2.0",
    "nodemon": "^3.1.11",
    "ts-jest": "^29.4.5",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  },
  "engines": {
    "node": ">=24.11.1"
  }
}
```

---

## Testing Patterns

```typescript
// tests/services/authService.test.ts
import { authService } from '../../src/services/authService';

describe('AuthService with jose', () => {
  describe('JWT operations', () => {
    it('should generate and verify token', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';
      
      const token = await authService.generateToken(userId, email);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = await authService.verifyToken(token);
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(authService.verifyToken(invalidToken))
        .rejects
        .toThrow();
    });
  });

  describe('Password operations', () => {
    it('should hash and compare password', async () => {
      const password = 'MySecurePass123!';
      
      const hash = await authService.hashPassword(password);
      expect(hash).not.toBe(password);
      
      const isValid = await authService.comparePassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await authService.comparePassword('wrong', hash);
      expect(isInvalid).toBe(false);
    });
  });
});
```

---

## Development Workflow

### Running Development Server

```bash
npm run dev
# Uses tsx watch - auto-restarts on file changes
# Express 5 with automatic error handling
```

### Database Workflow with Prisma 6

```bash
# Create migration after schema changes
npx prisma migrate dev --name add_albums_table

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma client (after schema changes)
npx prisma generate
```

### Testing JWT with jose

```bash
# Quick test
node -e "import('jose').then(({SignJWT}) => console.log('jose works!'))"

# Run test file
node tests/test-jose.js
```

---

## Important Reminders

1. **Always use jose not jsonwebtoken** - Required for Node.js 24
2. **Use `.js` in imports** - TypeScript requirement with ES modules
3. **Prisma 6 generator** - Use "prisma-client" not "prisma-client-js"
4. **Express 5 async** - No try-catch needed in async routes
5. **PostgreSQL 18 I/O** - Enable io_uring for 3x performance
6. **Validate environment variables** - Use Zod in src/config/env.ts
7. **Handle nulls** - Prisma returns `Type | null`, always check
8. **Multer security** - Version 2.0.2 has critical patches
9. **Azure Vision GA** - Use 2023-10-01, not preview versions
10. **Rate limit Azure API** - 20 calls/minute, 5,000/month

---

**Last Updated:** November 16, 2025
**Node.js:** 24.11.1 LTS
**Key Change:** Using jose for JWT (jsonwebtoken incompatible)
**Ready for development!**