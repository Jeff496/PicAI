# TypeScript Backend Setup Guide

Complete guide for setting up the PicAI backend with TypeScript.

---

## Why TypeScript for PicAI?

✅ **Type Safety**: Catch errors at compile time, not runtime
✅ **Better IDE Support**: Autocomplete for everything
✅ **Prisma Integration**: Auto-generated types from database schema
✅ **Easier Refactoring**: Rename safely across entire codebase
✅ **Self-Documenting**: Types serve as inline documentation

---

## Updated Package.json

Replace the JavaScript version with this TypeScript version:

```json
{
  "name": "picai-backend",
  "version": "1.0.0",
  "description": "PicAI backend API with TypeScript",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "test": "jest",
    "type-check": "tsc --noEmit"
  },
  "keywords": ["photo", "ai", "album", "typescript"],
  "author": "Jeffrey",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "@prisma/client": "^5.7.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.0",
    "axios": "^1.6.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4",
    "winston": "^3.11.0",
    "archiver": "^6.0.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/multer": "^1.4.11",
    "@types/cors": "^2.8.17",
    "@types/archiver": "^6.0.2",
    "prisma": "^5.7.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "nodemon": "^3.0.2",
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1"
  },
  "engines": {
    "node": "20.x"
  }
}
```

---

## TypeScript Configuration

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    // Language & Environment
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    
    // Emit
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "removeComments": true,
    
    // Type Checking
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    
    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    
    // Skip Lib Check (faster builds)
    "skipLibCheck": true,
    
    // Prisma
    "types": ["node", "jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

## Project Structure (TypeScript)

```
backend/
├── src/
│   ├── index.ts                      # Entry point
│   ├── types/                        # TypeScript types/interfaces
│   │   ├── express.d.ts             # Express type extensions
│   │   ├── auth.types.ts
│   │   └── api.types.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── users.routes.ts
│   │   ├── groups.routes.ts
│   │   ├── photos.routes.ts
│   │   └── albums.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── photos.controller.ts
│   │   └── albums.controller.ts
│   ├── services/
│   │   ├── aiService.ts
│   │   ├── fileService.ts
│   │   ├── albumService.ts
│   │   └── authService.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── validate.middleware.ts
│   │   ├── upload.middleware.ts
│   │   └── error.middleware.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── asyncHandler.ts
│   │   └── constants.ts
│   ├── config/
│   │   └── env.ts                   # Environment variables with validation
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
├── dist/                             # Compiled JS (gitignored)
├── tests/
├── .env
├── .env.example
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

---

## Environment Variables with Type Safety

Create `src/config/env.ts`:

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  FRONTEND_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('7d'),

  // Azure Computer Vision
  AZURE_VISION_KEY: z.string().min(32),
  AZURE_VISION_ENDPOINT: z.string().url(),

  // File Storage
  UPLOAD_DIR: z.string(),
  THUMBNAIL_DIR: z.string(),
  MAX_FILE_SIZE: z.string().transform(Number).default('26214400'),
});

export type Env = z.infer<typeof envSchema>;

// Validate and export
export const env = envSchema.parse(process.env);
```

Usage:
```typescript
import { env } from './config/env.js';

console.log(env.PORT); // Type-safe, guaranteed to be a number
console.log(env.AZURE_VISION_KEY); // Guaranteed to exist
```

---

## TypeScript Patterns

### 1. Express Request Type Extension

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

Now `req.user` is fully typed throughout your app!

### 2. API Response Types

Create `src/types/api.types.ts`:

```typescript
// Success response
export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  message?: string;
}

// Error response
export interface ApiError {
  success: false;
  error: string;
  code: string;
  details?: string[];
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// File upload response
export interface UploadedPhoto {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl: string;
  uploadedAt: Date;
}
```

### 3. Controller with Types

```typescript
// src/controllers/photos.controller.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fileService } from '../services/fileService.js';
import { ApiSuccess, UploadedPhoto } from '../types/api.types.js';

// Validation schema
const uploadSchema = z.object({
  groupId: z.string().uuid().optional(),
});

export const uploadPhotos = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id; // ! because auth middleware guarantees it
  const { groupId } = uploadSchema.parse(req.body);
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No files uploaded',
      code: 'NO_FILES'
    });
  }

  const savedPhotos = await Promise.all(
    files.map(file => fileService.savePhoto(file, userId, groupId))
  );

  const response: ApiSuccess<UploadedPhoto[]> = {
    success: true,
    data: savedPhotos.map(photo => ({
      id: photo.id,
      filename: photo.filename,
      url: `/api/photos/${photo.id}/file`,
      thumbnailUrl: `/api/photos/${photo.id}/thumbnail`,
      uploadedAt: photo.uploadedAt,
    })),
    message: `${savedPhotos.length} photos uploaded successfully`
  };

  res.status(201).json(response);
});
```

### 4. Service with Types

```typescript
// src/services/fileService.ts
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client.js';
import { Photo } from '@prisma/client';
import { env } from '../config/env.js';

interface SavePhotoParams {
  file: Express.Multer.File;
  userId: string;
  groupId?: string;
}

class FileService {
  async savePhoto(
    file: Express.Multer.File,
    userId: string,
    groupId?: string
  ): Promise<Photo> {
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    
    const originalPath = path.join(env.UPLOAD_DIR, fileName);
    const thumbnailPath = path.join(env.THUMBNAIL_DIR, fileName);

    // Save original
    await fs.writeFile(originalPath, file.buffer);

    // Generate thumbnail
    await sharp(file.buffer)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    // Get metadata
    const metadata = await sharp(file.buffer).metadata();

    // Save to database
    const photo = await prisma.photo.create({
      data: {
        userId,
        groupId: groupId ?? null,
        filename: file.originalname,
        filePath: originalPath,
        thumbnailPath,
        fileSize: file.size,
        mimeType: file.mimetype,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
      },
    });

    return photo;
  }

  async deletePhoto(photoId: string): Promise<void> {
    const photo = await prisma.photo.findUnique({ 
      where: { id: photoId } 
    });
    
    if (!photo) {
      throw new Error('Photo not found');
    }

    await fs.unlink(photo.filePath);
    await fs.unlink(photo.thumbnailPath);
    await prisma.photo.delete({ where: { id: photoId } });
  }
}

export const fileService = new FileService();
```

### 5. Middleware with Types

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../prisma/client.js';
import { env } from '../config/env.js';

interface JwtPayload {
  userId: string;
  email: string;
}

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

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'INVALID_TOKEN'
      });
    }

    req.user = user; // Now fully typed thanks to express.d.ts
    next();
  }
);
```

### 6. Validation with Zod (Better than Joi for TypeScript)

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
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  name: z.string().min(2).max(100)
});

router.post('/register', validateRequest(registerSchema), authController.register);
```

---

## Prisma with TypeScript

Your Prisma schema stays the same, but now you get auto-generated types:

```typescript
import { PrismaClient, User, Photo, Album } from '@prisma/client';

const prisma = new PrismaClient();

// Full type safety
const user: User = await prisma.user.findUnique({
  where: { id: 'some-id' }
}); // TypeScript knows all User fields!

// With relations
const userWithPhotos = await prisma.user.findUnique({
  where: { id: 'some-id' },
  include: { photos: true }
});
// TypeScript knows userWithPhotos.photos is Photo[]
```

---

## Running TypeScript Backend

### Development (with hot reload)

```bash
npm run dev
# Uses tsx watch - automatically restarts on file changes
```

### Production

```bash
# Build TypeScript to JavaScript
npm run build

# Run compiled JavaScript
npm start

# Or with PM2
pm2 start dist/index.js --name picai-backend
```

---

## Testing with TypeScript

Create `jest.config.js`:

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
};
```

Example test:

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
});
```

---

## Entry Point (index.ts)

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

// Error handling
app.use(errorHandler);

// Start server
app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

export default app;
```

---

## Updated .gitignore

```
# Dependencies
node_modules/

# TypeScript
dist/
*.tsbuildinfo

# Environment
.env
.env.local

# Storage
storage/

# Logs
logs/
*.log

# OS
.DS_Store

# IDE
.vscode/
.idea/

# Prisma
prisma/migrations/*.sql

# PM2
.pm2/

# Testing
coverage/
```

---

## Installation Steps

```bash
# Navigate to backend
cd ~/picai/backend

# Install dependencies
npm install

# Generate Prisma client (with TypeScript types!)
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init

# Start development server
npm run dev
```

---

## Type Safety Benefits Examples

### Before (JavaScript):
```javascript
// Might crash at runtime if photo is null
const photo = await prisma.photo.findUnique({ where: { id } });
console.log(photo.filename); // ❌ Runtime error if photo is null
```

### After (TypeScript):
```typescript
// TypeScript forces you to handle null
const photo = await prisma.photo.findUnique({ where: { id } });
if (photo) {
  console.log(photo.filename); // ✅ Safe!
}
// TypeScript error if you forget the null check
```

### Before (JavaScript):
```javascript
// Typo not caught until runtime
const user = await prisma.user.findUnique({ where: { id } });
console.log(user.emai); // ❌ Typo! Returns undefined
```

### After (TypeScript):
```typescript
// Typo caught immediately
const user = await prisma.user.findUnique({ where: { id } });
console.log(user.email); // ✅ Autocomplete prevents typos
// console.log(user.emai); // ❌ TypeScript error: Property 'emai' does not exist
```

---

## Claude Code Tips for TypeScript

When using Claude Code with TypeScript:

1. **Let Claude know you're using TypeScript** in your prompts
2. **Request strict type checking** when generating code
3. **Ask for Zod schemas** instead of Joi (better TypeScript integration)
4. **Leverage Prisma types** - they're auto-generated!

Example prompt:
```
"Build the photo upload endpoint in TypeScript with:
- Strict type checking
- Zod validation schema
- Prisma-generated types
- Proper error handling with typed responses"
```

---

## Common TypeScript Pitfalls (and Solutions)

### Pitfall 1: Module Resolution

**Problem:** `Cannot find module './file.js'`

**Solution:** Always use `.js` extension in imports (even for `.ts` files)
```typescript
// ✅ Correct
import { fileService } from './services/fileService.js';

// ❌ Wrong
import { fileService } from './services/fileService';
```

### Pitfall 2: Prisma Optional Fields

**Problem:** TypeScript errors on optional fields

**Solution:** Use nullish coalescing
```typescript
const photo = await prisma.photo.create({
  data: {
    groupId: groupId ?? null, // ✅ Handles undefined
  }
});
```

### Pitfall 3: Express Request User

**Problem:** `Property 'user' does not exist on type 'Request'`

**Solution:** Create `src/types/express.d.ts` (shown above)

---

## Summary

**TypeScript adds:**
- ~15% more initial setup time
- 100% less runtime type errors
- Much better developer experience
- Easier refactoring and scaling

**For PicAI specifically:**
- Prisma auto-generates all database types
- Zod validates AND provides types
- Express types catch route handler errors
- Better collaboration if you add team members later

**Totally worth it!** ✅