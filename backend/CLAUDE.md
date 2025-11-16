# Backend CLAUDE.md - PicAI Express API

**Technology:** Node.js 24.11.1 + TypeScript 5.9.3 + Express 5.1.0 + Prisma 6.19.0

Backend-specific guidance for the PicAI Express.js API.

**See main `CLAUDE.md` in project root for overall architecture and conventions.**

---

## Technology Stack

- **Language:** TypeScript 5.9.3
- **Runtime:** Node.js 24.11.1
- **Framework:** Express 5.1.0
- **Database:** PostgreSQL 15 with Prisma 6.19.0 ORM
- **Authentication:** JWT (jsonwebtoken 9.0.2)
- **File Upload:** Multer 2.0.2
- **Image Processing:** Sharp 0.34.5
- **Validation:** Zod 4.1.12
- **Logging:** Winston 3.18.3
- **Process Manager:** PM2 (for production)

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                      # Entry point, Express app setup
│   ├── config/
│   │   └── env.ts                   # Environment variables with Zod validation
│   ├── types/
│   │   ├── express.d.ts             # Express type extensions (req.user)
│   │   └── api.types.ts             # API response types
│   ├── routes/
│   │   ├── auth.routes.ts           # POST /auth/login, /auth/register
│   │   ├── users.routes.ts          # GET/PUT /users/:id
│   │   ├── groups.routes.ts         # CRUD /groups
│   │   ├── photos.routes.ts         # POST /photos/upload, GET /photos
│   │   └── albums.routes.ts         # Album generation and management
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── photos.controller.ts
│   │   └── albums.controller.ts
│   ├── services/
│   │   ├── aiService.ts             # Azure Computer Vision integration
│   │   ├── fileService.ts           # Photo storage, thumbnails
│   │   ├── albumService.ts          # Album generation logic
│   │   └── authService.ts           # JWT generation, password hashing
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT verification
│   │   ├── validate.middleware.ts   # Zod validation
│   │   ├── upload.middleware.ts     # Multer config
│   │   └── error.middleware.ts      # Global error handler
│   ├── utils/
│   │   ├── logger.ts                # Winston logger setup
│   │   ├── asyncHandler.ts          # Async route wrapper
│   │   └── constants.ts             # App constants
│   └── prisma/
│       ├── schema.prisma            # Database schema
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
├── package.json
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

Now `req.user` is properly typed everywhere!

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

Usage:
```typescript
import { env } from './config/env.js';

console.log(env.PORT); // Type-safe number
console.log(env.AZURE_VISION_KEY); // Guaranteed to exist
```

---

## Express 5 Specifics

### Async Error Handling

Express 5 automatically catches promise rejections, but still use asyncHandler for clarity:

```typescript
// src/utils/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage in routes
export const uploadPhotos = asyncHandler(async (req: Request, res: Response) => {
  const photos = await fileService.savePhotos(req.files);
  res.status(201).json({ success: true, data: photos });
});
```

### Error Handler - Must Have 4 Parameters

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

## Validation with Zod 4

Zod 4 has improved TypeScript inference. Prefer it over Joi:

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

## Prisma Patterns

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

### Handling Nulls

```typescript
// Prisma can return null - always handle it
const photo = await prisma.photo.findUnique({ where: { id } });

if (!photo) {
  return res.status(404).json({
    success: false,
    error: 'Photo not found'
  });
}

// Now photo is safely typed as Photo (not Photo | null)
console.log(photo.filename);
```

### Transactions for Multi-Step Operations

```typescript
// Create album and add photos atomically
const album = await prisma.$transaction(async (tx) => {
  const newAlbum = await tx.album.create({
    data: { name, userId }
  });

  await tx.albumPhoto.createMany({
    data: photoIds.map(photoId => ({
      albumId: newAlbum.id,
      photoId
    }))
  });

  return newAlbum;
});
```

---

## File Upload with Multer 2

Multer 2 has better TypeScript support:

```typescript
// src/middleware/upload.middleware.ts
import multer from 'multer';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];
const MAX_FILE_SIZE = 26214400; // 25MB

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
    fileSize: MAX_FILE_SIZE,
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

## Authentication Pattern

### Password Hashing with Bcrypt 6

```typescript
// src/services/authService.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRATION }
    );
  }

  verifyToken(token: string): { userId: string; email: string } {
    return jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };
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
    const decoded = authService.verifyToken(token);
    
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

    req.user = user; // Now typed thanks to express.d.ts!
    next();
  }
);
```

---

## Azure Computer Vision Integration

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

      const response = await axios.post(
        `${env.AZURE_VISION_ENDPOINT}/vision/v3.2/analyze`,
        imageBuffer,
        {
          params: {
            visualFeatures: 'Categories,Tags,Description,Objects,Faces,Color'
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
        logger.warn('Rate limit hit');
        // TODO: Implement retry queue
      }
      
      throw error;
    }
  }

  private async storeTags(photoId: string, analysis: any): Promise<void> {
    const tags = [];

    if (analysis.tags) {
      analysis.tags.forEach((tag: any) => {
        if (tag.confidence > 0.5) {
          tags.push({
            photoId,
            tag: tag.name,
            confidence: tag.confidence,
            category: 'tag'
          });
        }
      });
    }

    if (tags.length > 0) {
      await prisma.aiTag.createMany({ data: tags });
    }
  }
}

export const aiService = new AIService();
```

---

## Logging with Winston

```typescript
// src/utils/logger.ts
import winston from 'winston';
import path from 'path';
import { env } from '../config/env.js';

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

export default logger;
```

---

## Entry Point Structure

```typescript
// src/index.ts
import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/error.middleware.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import photosRoutes from './routes/photos.routes.js';
import albumsRoutes from './routes/albums.routes.js';

const app: Express = express();

// Middleware
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/albums', albumsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

// Error handling (must be last!)
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

export default app;
```

---

## Testing Patterns

```typescript
// tests/services/authService.test.ts
import { authService } from '../../src/services/authService';

describe('AuthService', () => {
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'MySecurePass123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'MySecurePass123!';
      const hash = await authService.hashPassword(password);
      
      const isMatch = await authService.comparePassword(password, hash);
      expect(isMatch).toBe(true);
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
```

### Database Workflow

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

### Type Checking

```bash
npm run type-check
# Checks types without compiling
```

### Building for Production

```bash
npm run build
# Creates dist/ folder with compiled JavaScript
```

---

## Important Reminders

1. **Always use `.js` in imports** - TypeScript requirement with ES modules
2. **Validate environment variables** - Use Zod in src/config/env.ts
3. **Use Prisma-generated types** - Never create manual database types
4. **Handle nulls** - Prisma returns `Type | null`, always check
5. **Express 5 error handlers** - Must have 4 parameters
6. **Use asyncHandler** - Wrap all async route handlers
7. **Never log secrets** - JWT tokens, passwords, API keys
8. **Zod for validation** - Better TypeScript support than Joi
9. **Rate limit Azure API** - 20 calls/minute, 5,000/month
10. **Stream large files** - Don't load entire files in memory

---

**Ready for development!** Follow the implementation phases in docs/architecture.md.