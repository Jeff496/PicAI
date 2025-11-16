# TypeScript Setup Additions

**Use this AFTER completing the main setup-checklist.md**

This adds TypeScript configuration to your PicAI backend.

---

## Additional TypeScript Setup Steps

### Step 1: Create TypeScript Config

- [ ] **Create backend/tsconfig.json**
  ```bash
  cd ~/picai/backend
  nano tsconfig.json
  ```

  **Add this:**
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2022"],
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "outDir": "./dist",
      "rootDir": "./src",
      "sourceMap": true,
      "removeComments": true,
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noImplicitReturns": true,
      "noFallthroughCasesInSwitch": true,
      "noUncheckedIndexedAccess": true,
      "esModuleInterop": true,
      "allowSyntheticDefaultImports": true,
      "resolveJsonModule": true,
      "forceConsistentCasingInFileNames": true,
      "skipLibCheck": true,
      "types": ["node", "jest"]
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "**/*.test.ts"]
  }
  ```

### Step 2: Update package.json

- [ ] **Replace package.json scripts section**
  ```json
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "test": "jest",
    "type-check": "tsc --noEmit"
  }
  ```

- [ ] **Add TypeScript dependencies**
  ```bash
  npm install --save-dev typescript @types/node @types/express @types/bcrypt @types/jsonwebtoken @types/multer @types/cors tsx ts-jest @types/jest
  ```

### Step 3: Rename Files to .ts

- [ ] **Rename all .js files to .ts**
  ```bash
  # This will be done by Claude Code, but if doing manually:
  find src -name "*.js" -exec rename 's/\.js$/.ts/' {} +
  ```

- [ ] **Update imports to use .js extension**
  ```typescript
  // Even though files are .ts, imports must use .js
  import { fileService } from './services/fileService.js';
  ```

### Step 4: Add Type Definitions

- [ ] **Create src/types/express.d.ts**
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

- [ ] **Create src/types/api.types.ts**
  ```typescript
  export interface ApiSuccess<T = any> {
    success: true;
    data: T;
    message?: string;
  }

  export interface ApiError {
    success: false;
    error: string;
    code: string;
    details?: string[];
  }
  ```

### Step 5: Add Environment Validation

- [ ] **Create src/config/env.ts**
  ```typescript
  import { z } from 'zod';
  import dotenv from 'dotenv';

  dotenv.config();

  const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3001'),
    FRONTEND_URL: z.string().url(),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRATION: z.string().default('7d'),
    AZURE_VISION_KEY: z.string().min(32),
    AZURE_VISION_ENDPOINT: z.string().url(),
    UPLOAD_DIR: z.string(),
    THUMBNAIL_DIR: z.string(),
    MAX_FILE_SIZE: z.string().transform(Number).default('26214400'),
  });

  export type Env = z.infer<typeof envSchema>;
  export const env = envSchema.parse(process.env);
  ```

### Step 6: Update .gitignore

- [ ] **Add TypeScript build output**
  ```bash
  # Add to .gitignore
  dist/
  *.tsbuildinfo
  ```

### Step 7: Test TypeScript Setup

- [ ] **Type check**
  ```bash
  npm run type-check
  # Should show no errors
  ```

- [ ] **Build**
  ```bash
  npm run build
  # Should create dist/ folder with compiled JS
  ```

- [ ] **Run dev server**
  ```bash
  npm run dev
  # Should start with hot reload
  ```

---

## Updated File Structure

```
backend/
├── src/
│   ├── index.ts                  # ✨ Changed from .js
│   ├── types/                    # ✨ New
│   │   ├── express.d.ts
│   │   └── api.types.ts
│   ├── config/                   # ✨ New
│   │   └── env.ts
│   ├── routes/
│   │   └── *.routes.ts          # ✨ All .ts now
│   ├── controllers/
│   │   └── *.controller.ts
│   ├── services/
│   │   └── *.service.ts
│   ├── middleware/
│   │   └── *.middleware.ts
│   ├── utils/
│   │   └── *.ts
│   └── prisma/
│       └── schema.prisma
├── dist/                         # ✨ New (gitignored)
├── tsconfig.json                 # ✨ New
└── package.json                  # ✨ Updated
```

---

## Benefits You'll See

### 1. Autocomplete Everywhere
```typescript
const user = await prisma.user.findUnique(...);
user. // ← VS Code shows all User fields with types!
```

### 2. Catch Errors Before Running
```typescript
const photo = await prisma.photo.findUnique({ where: { id } });
console.log(photo.filename); 
// ❌ TypeScript error: Object is possibly 'null'

// Fix:
if (photo) {
  console.log(photo.filename); // ✅ Safe!
}
```

### 3. Refactoring is Safe
```typescript
// Rename 'filename' to 'fileName' in Prisma schema
// TypeScript will show errors everywhere it's used
// No silent bugs!
```

---

## Common Issues & Solutions

### Issue: "Cannot find module './file.js'"

**Solution:** Always use `.js` extension in imports, even for `.ts` files
```typescript
import { something } from './something.js'; // ✅ Correct
```

### Issue: "Type 'undefined' is not assignable to type 'string'"

**Solution:** Use optional chaining and nullish coalescing
```typescript
const groupId = req.body.groupId ?? null; // ✅
```

### Issue: PM2 can't run .ts files

**Solution:** Always build first in production
```bash
npm run build  # Creates dist/
pm2 start dist/index.js --name picai-backend
```

---

## Testing TypeScript Changes

After setup:

```bash
# 1. Type check
npm run type-check

# 2. Build
npm run build

# 3. Run tests
npm test

# 4. Start dev server
npm run dev

# 5. Verify /health endpoint
curl http://localhost:3001/health
```

---

## Claude Code with TypeScript

When starting Claude Code after TypeScript setup:

```
"I'm using TypeScript for the PicAI backend. 

Key requirements:
- Strict type checking enabled
- Use Zod for validation (better than Joi for TypeScript)
- Leverage Prisma-generated types
- All imports must use .js extension
- Type all Express request/response handlers

Read the typescript-setup.md for patterns to follow."
```

---

## VS Code Extensions for TypeScript

- [ ] **Install extensions**
  - ESLint
  - Prettier
  - Prisma (syntax highlighting)
  - Error Lens (inline type errors)

---

**TypeScript setup complete!** You now have full type safety across your backend. 🎉