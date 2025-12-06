# PicAI Architecture & Implementation Plan

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Database Design Rationale](#database-design-rationale)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Implementation Phases](#implementation-phases)
5. [Technology Decisions](#technology-decisions)
6. [Security Architecture](#security-architecture)
7. [Scalability Considerations](#scalability-considerations)

---

## System Architecture Overview

### High-Level Architecture (November 2025 Stack)

```
┌──────────────────────────────────────────────────────────────────┐
│                           USERS                                   │
│                    (Browser/Mobile Web)                           │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    AZURE STATIC WEB APP                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  React 19.2.0 Frontend (Vite 7.0)                          │  │
│  │  • Authentication UI (Login/Signup)                        │  │
│  │  • Photo Upload Interface                                  │  │
│  │  • Group Management                                        │  │
│  │  • Album Browser & Generator                               │  │
│  │  • Lightbox Photo Viewer                                   │  │
│  │  • TailwindCSS 4.0 (3.5-5x faster builds)                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Hosting: Free Tier (100GB bandwidth/month)                      │
│  SSL: Automatic                                                   │
│  Deploy: Auto on git push                                        │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS API Calls
                               │ (via Cloudflare Tunnel 2025.8.1)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE TUNNEL                            │
│  • Secure tunnel to Raspberry Pi (no port forwarding)           │
│  • SSL/TLS termination                                           │
│  • DDoS protection                                               │
│  • Rate limiting (100 req/min per IP)                           │
│  • WAF (Web Application Firewall)                               │
│  • UDP proxy rearchitecture (2025.8.1)                          │
│  • Public URL: https://api.yourdomain.com                       │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ Secure Tunnel (localhost:3001)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    RASPBERRY PI 5 BACKEND                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │      Express 5.1.0 REST API (Node.js 24.11.1 LTS)         │  │
│  │                                                            │  │
│  │  Routes:                                                   │  │
│  │    /api/auth/*      → Authentication (jose JWT)           │  │
│  │    /api/users/*     → User management                     │  │
│  │    /api/groups/*    → Group CRUD                          │  │
│  │    /api/photos/*    → Photo upload/retrieval              │  │
│  │    /api/albums/*    → Album generation/management         │  │
│  │                                                            │  │
│  │  Middleware:                                               │  │
│  │    • JWT authentication (jose 5.3.0)                      │  │
│  │    • Request validation (Zod 4.1.12)                      │  │
│  │    • Error handling (Express 5 automatic)                 │  │
│  │    • File upload (Multer 2.0.2 - patched)                │  │
│  │    • Rate limiting                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Services Layer                                │  │
│  │  • aiService.ts         → Azure Vision 2023-10-01 GA      │  │
│  │  • rekognitionService.ts → AWS Rekognition (faces)        │  │
│  │  • fileService.ts       → Photo storage & thumbnails      │  │
│  │  • albumService.ts      → Album generation logic          │  │
│  │  • authService.ts       → JWT (jose) & bcrypt             │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │         PostgreSQL 18.1 Database (3x faster I/O)           │  │
│  │  Tables:                                                   │  │
│  │    • users (accounts, auth)                               │  │
│  │    • groups (photo groups)                                │  │
│  │    • group_memberships (user-group relations)             │  │
│  │    • photos (metadata, paths)                             │  │
│  │    • ai_tags (AI-generated labels)                        │  │
│  │    • albums (collections)                                 │  │
│  │    • album_photos (album-photo relations)                 │  │
│  │    • share_links (public sharing)                         │  │
│  │                                                            │  │
│  │  ORM: Prisma 6.19.0 (Rust-free, 90% smaller)             │  │
│  │  Async I/O: io_uring enabled                              │  │
│  │  Backups: Daily automated to external USB                │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Local File Storage                            │  │
│  │  Path: /home/pi/picai/storage/                            │  │
│  │  • originals/      → Full-size photos                     │  │
│  │  • thumbnails/     → 200x200px previews (Sharp 0.34.5)    │  │
│  │                                                            │  │
│  │  File naming: {UUID}.{ext}                                │  │
│  │  Organization: Flat structure (no subdirs for simplicity) │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Hardware: Raspberry Pi 5 (4GB RAM minimum)                      │
│  Storage: 256GB+ SSD (via USB 3.0)                               │
│  OS: Ubuntu 24.04.3 LTS                                          │
│  Process Manager: PM2 6.0.13 (Bun support)                      │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS API Calls
                               │ (from backend, not frontend)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│            AZURE COMPUTER VISION API (2023-10-01 GA)              │
│  Endpoint: *.cognitiveservices.azure.com                         │
│  Features:                                                        │
│    • Object detection (dog, car, tree, etc.)                    │
│    • Scene recognition (beach, mountain, indoor)                │
│    • Activity detection (swimming, hiking)                      │
│    • Color extraction (dominant colors)                         │
│    • Face detection (count, bounding boxes)                     │
│    • OCR (text in images)                                       │
│    • Dense captions (multiple regions)                          │
│                                                                    │
│  Tier: F0 (Free)                                                 │
│  Limits: 5,000 calls/month, 20/minute                           │
│  Cost: $0/month                                                   │
│  SDK: @azure-rest/ai-vision-image-analysis 1.0.0-beta.3         │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ (When people detected in photo)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│            AWS REKOGNITION (Face Collections)                     │
│  Region: us-east-1                                                │
│  Auth: IAM Roles Anywhere (X.509 certificates from backend/pki/)│
│  Features:                                                        │
│    • Face detection (bounding boxes, landmarks)                  │
│    • Face indexing (store in collection for matching)            │
│    • Face search (find matching faces across photos)             │
│                                                                    │
│  Tier: Free (first 12 months)                                    │
│  Limits: 5,000 DetectFaces/month, 1,000 IndexFaces/month        │
│  Cost: $0/month (within free tier)                               │
│  SDK: @aws-sdk/client-rekognition                                │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (November 2025)

| Component | Technology | Version | Why This Choice |
|-----------|------------|---------|-----------------|
| **React Frontend** | React | 19.2.0 | Actions, use() API, automatic batching |
| **Build Tool** | Vite | 7.0 | Rolldown integration, faster builds |
| **CSS Framework** | TailwindCSS | 4.0 | CSS-first config, 3.5-5x faster |
| **State Management** | TanStack Query | 5.90.9 | React 19 compatible, Suspense support |
| **Routing** | React Router | 7.9.5 | Single package, framework mode |
| **Backend Runtime** | Node.js | 24.11.1 LTS | 30% faster HTTP with Undici 7 |
| **API Framework** | Express | 5.1.0 | Finally stable, automatic async handling |
| **Database** | PostgreSQL | 18.1 | 3x faster I/O with async subsystem |
| **ORM** | Prisma | 6.19.0 | Rust-free, 90% smaller, 3.4x faster |
| **JWT Library** | jose | 5.3.0 | Node.js 24 compatible (replaces jsonwebtoken) |
| **Validation** | Zod | 4.1.12 | 14x faster, 57% smaller |
| **File Upload** | Multer | 2.0.2 | Security patches applied |
| **Image Processing** | Sharp | 0.34.5 | Latest libvips, RISC-V support |
| **Azure Vision** | API | 2023-10-01 GA | Production API (preview retiring) |
| **AWS Rekognition** | API | Latest | Face collections, IAM Roles Anywhere auth |
| **Tunnel** | Cloudflare | 2025.8.1 | UDP proxy improvements |

---

## Database Design Rationale

### Why PostgreSQL 18 over Earlier Versions?

**PostgreSQL 18.1 Advantages:**
- ✅ **Asynchronous I/O subsystem:** 3x faster storage reads with io_uring
- ✅ **Skip scan indexes:** Use multicolumn B-tree without prefix equality
- ✅ **UUIDv7 support:** Timestamp-ordered identifiers for better indexing
- ✅ **Data checksums by default:** Enhanced data integrity
- ✅ **Protocol 3.2:** First update since PostgreSQL 7.4

**Configuration for Performance:**
```sql
-- Enable async I/O for 3x performance
ALTER SYSTEM SET io_method = 'io_uring';
SELECT pg_reload_conf();

-- Use UUIDv7 for better indexing
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SELECT uuidv7();
```

### Database Schema with Prisma 6

#### Prisma Configuration (Rust-Free)

```prisma
// schema.prisma
generator client {
  provider = "prisma-client"  // Changed from "prisma-client-js" in v6
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String   @map("password_hash")
  name              String?
  profilePictureUrl String?  @map("profile_picture_url")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  
  photos            Photo[]
  albums            Album[]
  groupMemberships  GroupMembership[]
  createdGroups     Group[]  @relation("GroupCreator")
  
  @@map("users")
}

model Group {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(50)
  description String?  @db.VarChar(200)
  createdById String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  createdBy   User     @relation("GroupCreator", fields: [createdById], references: [id], onDelete: Cascade)
  members     GroupMembership[]
  photos      Photo[]
  albums      Album[]
  
  @@map("groups")
}

// ... rest of schema
```

---

## Data Flow Diagrams

### 1. Photo Upload Flow (with November 2025 Stack)

```
User → Frontend → Backend → Disk → Database → Azure Vision → Database
  │        │         │        │         │           │            │
  │        │         │        │         │           │            │
  1    Select    Validate  Save    Store     Call 2023-10-01  Store
      photos    & auth    file   metadata    GA API         AI tags
                (jose JWT)  │                              │
                            ↓                              ↓
                        Generate                      Auto-generate
                      thumbnail                       time-based albums
                      (Sharp 0.34.5)                  (Prisma 6)
```

**Detailed Steps:**

1. **User selects photos** in React 19 UI (drag-drop or file picker)
2. **Frontend validates** file types and sizes (client-side check)
3. **Frontend sends** to `/api/photos/upload` with JWT token
4. **Backend authenticates** user via jose JWT verification
5. **Backend validates** files with Multer 2.0.2 (security patched)
6. **Backend saves** original to `/storage/originals/{UUID}.jpg`
7. **Backend generates** thumbnail using Sharp 0.34.5 → `/storage/thumbnails/{UUID}.jpg`
8. **Backend stores** metadata in `photos` table using Prisma 6
9. **Backend calls** Azure Computer Vision 2023-10-01 GA API (async)
10. **Azure returns** tags with new API response format
11. **Backend stores** tags in `ai_tags` table (Zod validated)
12. **Backend checks** if auto-albums should be generated
13. **Backend returns** success response to frontend
14. **Frontend updates** UI with TanStack Query cache invalidation

### 2. Authentication Flow (jose JWT)

```
User → Frontend → Backend → Database → Backend → Frontend
  │        │         │          │         │          │
  │        │         │          │         │          │
  1     Submit   Validate   Check user  Generate   Store JWT
       email+pw  with Zod    exists    jose JWT   in localStorage
                              ↓
                        Compare bcrypt
                        password hash
```

**Login Steps with jose:**

1. User enters email + password in React 19 form
2. Frontend validates with Zod 4.1.12 (14x faster)
3. Frontend sends POST `/api/auth/login`
4. Backend validates input with Zod again
5. Backend queries `users` table with Prisma 6
6. Backend compares password with `bcrypt.compare()`
7. If match: Backend generates JWT with jose:
   ```typescript
   const token = await new SignJWT({ userId, email })
     .setProtectedHeader({ alg: 'HS256' })
     .setExpirationTime('7d')
     .sign(secret);
   ```
8. Backend returns JWT + user info
9. Frontend stores JWT in `localStorage`
10. Frontend uses JWT in all API calls

---

## Implementation Phases

### Phase 1: Foundation Setup (Week 1-2)
**Goal:** Get basic infrastructure running with November 2025 stack

**Tasks:**
- [ ] Install Node.js 24.11.1 LTS
- [ ] Set up Raspberry Pi with PostgreSQL 18.1
- [ ] Initialize Express 5.1.0 backend with TypeScript 5.9.3
- [ ] Set up Prisma 6.19.0 ORM with Rust-free engine
- [ ] Implement authentication with jose 5.3.0 (NOT jsonwebtoken)
- [ ] Set up Cloudflare Tunnel 2025.8.1
- [ ] Create React 19.2.0 frontend with Vite 7.0 + TailwindCSS 4.0
- [ ] Deploy frontend to Azure Static Web Apps
- [ ] Test end-to-end connection

**Deliverable:** User can register, login with jose JWT

---

### Phase 2: Photo Upload & Storage (Week 3)
**Goal:** Users can upload photos with latest libraries

**Tasks:**
- [ ] Implement file upload with Multer 2.0.2 (security patched)
- [ ] File validation with Zod 4.1.12
- [ ] Save files to disk
- [ ] Generate thumbnails with Sharp 0.34.5
- [ ] Store metadata in PostgreSQL 18.1
- [ ] Create upload UI with React 19 Actions
- [ ] Implement drag-drop with Suspense boundaries
- [ ] Display photos with TanStack Query 5.90.9

**Deliverable:** Photos upload with progress, thumbnails generate

---

### Phase 3: Azure Computer Vision Integration (Week 3-4)
**Goal:** AI tags photos with 2023-10-01 GA API

**Tasks:**
- [ ] Migrate to Azure Computer Vision 2023-10-01 GA
- [ ] Update SDK to @azure-rest/ai-vision-image-analysis 1.0.0-beta.3
- [ ] Implement new API response format handling
- [ ] Store tags in PostgreSQL 18 with Prisma 6
- [ ] Handle rate limits (20/minute)
- [ ] Add retry logic with exponential backoff
- [ ] Display tags in React 19 UI

**Deliverable:** Photos automatically tagged with AI

---

### Phase 4-7: [Same as original but with updated tech stack]

---

## Technology Decisions (November 2025)

### Frontend: React 19 + Vite 7

**Why React 19?**
- Actions for async operations
- use() API for promise handling
- No forwardRef needed
- Automatic batching improvements
- Server Components support

**Compatibility Check Required:**
```bash
~/PicAI/docs/check-react19-compatibility.sh
```

**Why Vite 7 over Vite 6?**
- Rolldown integration (Rust bundler)
- Better SSR support
- ESM-only distribution
- Chrome 107+ baseline (was 87)

### Backend: Node.js 24 + Express 5

**Why Node.js 24 LTS?**
- 30% faster HTTP with Undici 7
- npm 11 included
- V8 13.6 engine improvements
- LTS until April 2028

**Critical:** Must use jose for JWT (jsonwebtoken incompatible)

**Why Express 5?**
- Finally stable after 10 years
- Automatic async error handling
- HTTP/2 support
- Brotli compression
- No breaking changes if migrating properly

### Database: PostgreSQL 18 + Prisma 6

**Why PostgreSQL 18?**
- 3x faster I/O with async subsystem
- Skip scan indexes
- UUIDv7 support
- Data checksums by default

**Why Prisma 6?**
- Rust-free architecture (90% smaller)
- 3.4x faster queries
- Edge runtime support
- No binary target issues

### Authentication: jose (NOT jsonwebtoken)

**Why jose over jsonwebtoken?**
- Node.js 24 compatible
- Modern, maintained
- ~10% performance improvement
- Better error messages
- ESM native

---

## Security Architecture

### Authentication Flow with jose

```typescript
// Token Generation (jose)
const token = await new SignJWT({ userId, email })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(secret);

// Token Verification (jose)
const { payload } = await jwtVerify(token, secret);
```

### Security Measures (November 2025)

**1. Authentication**
- JWT with jose 5.3.0 (Node.js 24 compatible)
- bcrypt 6.0.0 (native version, 30% faster)
- 7-day default expiration
- Rate limiting on login (5/15min)

**2. Input Validation**
- Zod 4.1.12 (14x faster validation)
- File validation with Multer 2.0.2 (CVE patches)
- 25MB max file size

**3. SQL Injection Prevention**
- Prisma 6 ORM (parameterized queries)
- Never concatenate user input

**4. File Upload Security**
- Multer 2.0.2 with CVE-2025-47935 and CVE-2025-47944 fixes
- MIME type validation
- UUID filenames
- Storage outside web root

**5. HTTPS Only**
- Cloudflare Tunnel 2025.8.1 handles SSL
- HSTS headers enabled
- Secure cookies only

---

## Scalability Considerations

### Current Limits (MVP with November 2025 Stack)

- **Users:** 50-100 concurrent (Express 5 improvements)
- **Photos:** 100,000-500,000 (PostgreSQL 18 can handle)
- **Performance:** 3x faster with PostgreSQL 18 async I/O
- **Bundle Size:** 90% smaller backend (Prisma 6)
- **Build Speed:** 3.5-5x faster CSS (TailwindCSS 4)

### Performance Optimizations

**Backend:**
- PostgreSQL 18 async I/O enabled
- Prisma 6 connection pooling
- Express 5 automatic error handling
- Sharp 0.34.5 streaming

**Frontend:**
- React 19 automatic batching
- TanStack Query 5 suspense mode
- Virtual scrolling for large lists
- Vite 7 with Rolldown

**Database:**
```sql
-- Enable PostgreSQL 18 async I/O
ALTER SYSTEM SET io_method = 'io_uring';

-- Use UUIDv7 for better indexing
CREATE EXTENSION "uuid-ossp";
```

---

## Next Steps

1. **Install November 2025 stack** (see versions above)
2. **Migrate to jose** for JWT (critical for Node.js 24)
3. **Check React 19 compatibility** before upgrading
4. **Enable PostgreSQL 18 async I/O** for 3x performance
5. **Update Prisma generator** to "prisma-client"
6. **Migrate Azure Vision** to 2023-10-01 GA before March 2025
7. **Apply Multer security patches** (2.0.2)
8. **Test all integrations** with new versions

---

**Document Updated:** December 4, 2025
**Stack Version:** November 2025 (all stable releases)
**Critical Changes:** jose for JWT (Node.js 24), AWS Rekognition with IAM Roles Anywhere (PKI-based auth)

You're ready to build PicAI with the latest technology stack! 🚀