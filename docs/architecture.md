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

### High-Level Architecture

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
│  │  React Frontend (Vite)                                     │  │
│  │  • Authentication UI (Login/Signup)                        │  │
│  │  • Photo Upload Interface                                  │  │
│  │  • Group Management                                        │  │
│  │  • Album Browser & Generator                               │  │
│  │  • Lightbox Photo Viewer                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Hosting: Free Tier (100GB bandwidth/month)                      │
│  SSL: Automatic                                                   │
│  Deploy: Auto on git push                                        │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS API Calls
                               │ (via Cloudflare Tunnel)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE TUNNEL                            │
│  • Secure tunnel to Raspberry Pi (no port forwarding)           │
│  • SSL/TLS termination                                           │
│  • DDoS protection                                               │
│  • Rate limiting (100 req/min per IP)                           │
│  • WAF (Web Application Firewall)                               │
│  • Public URL: https://api.yourdomain.com                       │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ Secure Tunnel (localhost:3001)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    RASPBERRY PI 4 BACKEND                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Express.js REST API (Node.js 20)                 │  │
│  │                                                            │  │
│  │  Routes:                                                   │  │
│  │    /api/auth/*      → Authentication endpoints            │  │
│  │    /api/users/*     → User management                     │  │
│  │    /api/groups/*    → Group CRUD                          │  │
│  │    /api/photos/*    → Photo upload/retrieval              │  │
│  │    /api/albums/*    → Album generation/management         │  │
│  │                                                            │  │
│  │  Middleware:                                               │  │
│  │    • JWT authentication                                    │  │
│  │    • Request validation (Joi)                             │  │
│  │    • Error handling                                        │  │
│  │    • File upload (Multer)                                  │  │
│  │    • Rate limiting                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Services Layer                                │  │
│  │  • aiService.js    → Azure Vision API integration         │  │
│  │  • fileService.js  → Photo storage & thumbnails           │  │
│  │  • albumService.js → Album generation logic               │  │
│  │  • authService.js  → JWT & password handling              │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            PostgreSQL 15 Database                          │  │
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
│  │  ORM: Prisma                                              │  │
│  │  Backups: Daily automated to external USB                │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Local File Storage                            │  │
│  │  Path: /home/pi/picai/storage/                            │  │
│  │  • originals/      → Full-size photos                     │  │
│  │  • thumbnails/     → 200x200px previews                   │  │
│  │                                                            │  │
│  │  File naming: {UUID}.{ext}                                │  │
│  │  Organization: Flat structure (no subdirs for simplicity) │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Hardware: Raspberry Pi 5 (4GB RAM minimum)                      │
│  Storage: 256GB+ SSD (via USB 3.0)                               │
│  OS: Ubuntu 24.04.3 LTS                                          │
│  Process Manager: PM2 (auto-restart)                             │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS API Calls
                               │ (from backend, not frontend)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                 AZURE COMPUTER VISION API                         │
│  Endpoint: *.cognitiveservices.azure.com                         │
│  Features:                                                        │
│    • Object detection (dog, car, tree, etc.)                    │
│    • Scene recognition (beach, mountain, indoor)                │
│    • Activity detection (swimming, hiking)                      │
│    • Color extraction (dominant colors)                         │
│    • Face detection (count, bounding boxes)                     │
│    • OCR (text in images)                                       │
│                                                                    │
│  Tier: F0 (Free)                                                 │
│  Limits: 5,000 calls/month, 20/minute                           │
│  Cost: $0/month                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Why This Choice |
|-----------|---------------|-----------------|
| **React Frontend** | UI/UX, user interactions, API calls | Modern, component-based, great ecosystem |
| **Azure Static Web Apps** | Frontend hosting, CDN, SSL | Free tier, auto-deploy, global CDN |
| **Cloudflare Tunnel** | Secure Pi access, no port forwarding | Free, secure, easy setup, no router config |
| **Express API** | Business logic, data validation, auth | Lightweight, Node.js ecosystem, async I/O |
| **PostgreSQL** | Data persistence, relational queries | ACID compliance, better than SQLite for multi-user |
| **Raspberry Pi** | Photo storage, backend hosting | Privacy, cost savings, data ownership |
| **Azure Vision** | AI photo analysis | Best-in-class, free tier, easy integration |

---

## Database Design Rationale

### Why PostgreSQL over SQLite?

**Initial Consideration: SQLite**
- ✅ Simple, file-based, no server needed
- ✅ Good for single-user or low concurrency
- ❌ Write locks entire database (one write at a time)
- ❌ No concurrent uploads from multiple users
- ❌ Limited JOIN performance at scale

**Final Choice: PostgreSQL**
- ✅ True multi-user concurrent access
- ✅ Better JOIN performance (critical for albums with many photos)
- ✅ Full ACID compliance
- ✅ Advanced indexing (B-tree, GiST for future text search)
- ✅ JSON support (useful for album generation criteria)
- ✅ Mature ecosystem, better tooling
- ✅ Easy to migrate to cloud PostgreSQL if needed
- ❌ Slightly more complex setup (manageable with Prisma)

**Conclusion:** PostgreSQL is better for PicAI's multi-user, collaborative nature.

### Database Schema Explanation

#### Core Tables

**users**
```sql
id          UUID PRIMARY KEY
email       VARCHAR(255) UNIQUE NOT NULL  -- Login identifier
password_hash VARCHAR(255) NOT NULL       -- bcrypt hashed password
name        VARCHAR(100)                  -- Display name
profile_picture_url TEXT                  -- Optional avatar
created_at  TIMESTAMP                     -- Account creation
updated_at  TIMESTAMP                     -- Last profile update
```
*Purpose:* Store user accounts and authentication data.

**groups**
```sql
id          UUID PRIMARY KEY
name        VARCHAR(50) NOT NULL          -- "Family Vacation 2025"
description VARCHAR(200)                  -- Optional group description
created_by  UUID → users(id)              -- Group owner
created_at  TIMESTAMP
updated_at  TIMESTAMP
```
*Purpose:* Photo sharing groups (like albums but for collaboration).

**group_memberships**
```sql
id          UUID PRIMARY KEY
group_id    UUID → groups(id)             -- Which group
user_id     UUID → users(id)              -- Which user
role        VARCHAR(20) DEFAULT 'member'  -- 'admin' or 'member'
joined_at   TIMESTAMP
UNIQUE(group_id, user_id)                 -- User can't join group twice
```
*Purpose:* Many-to-many relationship between users and groups.

**photos**
```sql
id             UUID PRIMARY KEY
user_id        UUID → users(id)           -- Photo owner
group_id       UUID → groups(id) NULLABLE -- NULL if personal photo
filename       VARCHAR(255) NOT NULL      -- Original filename
file_path      TEXT NOT NULL              -- Path to original on disk
thumbnail_path TEXT NOT NULL              -- Path to thumbnail
file_size      INTEGER                    -- Bytes
mime_type      VARCHAR(50)                -- image/jpeg, image/png
width          INTEGER                    -- Original dimensions
height         INTEGER
uploaded_at    TIMESTAMP                  -- When uploaded
taken_at       TIMESTAMP NULLABLE         -- From EXIF if available
```
*Purpose:* Photo metadata (actual files on disk, paths stored here).
*Index:* `user_id`, `group_id`, `uploaded_at` for fast queries.

**ai_tags**
```sql
id          UUID PRIMARY KEY
photo_id    UUID → photos(id)             -- Which photo
tag         VARCHAR(100) NOT NULL         -- "dog", "beach", "sunset"
confidence  DECIMAL(3,2)                  -- 0.00 to 1.00 (e.g., 0.92)
category    VARCHAR(50)                   -- 'object', 'scene', 'activity', 'color'
created_at  TIMESTAMP
```
*Purpose:* AI-generated labels for each photo.
*Why separate table:* One photo can have many tags (e.g., "dog", "beach", "outdoor").
*Index:* `photo_id`, `tag` for fast album generation searches.

**albums**
```sql
id                  UUID PRIMARY KEY
name                VARCHAR(100) NOT NULL         -- "Summer Vacation"
description         TEXT                          -- Optional
user_id             UUID → users(id)              -- Album creator
group_id            UUID → groups(id) NULLABLE    -- NULL if personal
is_auto_generated   BOOLEAN DEFAULT FALSE         -- AI-created?
generation_criteria JSONB                         -- {"tags": ["dog"], "dateRange": "..."}
created_at          TIMESTAMP
updated_at          TIMESTAMP
```
*Purpose:* Photo collections (both manual and AI-generated).
*Why JSONB:* Flexible storage for complex search criteria without rigid schema.

**album_photos**
```sql
id          UUID PRIMARY KEY
album_id    UUID → albums(id)
photo_id    UUID → photos(id)
added_at    TIMESTAMP
UNIQUE(album_id, photo_id)                -- Photo can't be in album twice
```
*Purpose:* Many-to-many relationship (photos can be in multiple albums).

**share_links**
```sql
id          UUID PRIMARY KEY
album_id    UUID → albums(id)
token       VARCHAR(64) UNIQUE NOT NULL   -- Random token for public access
expires_at  TIMESTAMP NOT NULL            -- Automatic expiration
created_at  TIMESTAMP
view_count  INTEGER DEFAULT 0             -- Track how many times viewed
```
*Purpose:* Public album sharing without login.
*Security:* Tokens are random (not sequential), expire automatically.

### ER Diagram (Text)

```
users
  ↓ (1:N)
photos ← ai_tags (N:1)
  ↓ (N:M via album_photos)
albums
  ↓ (1:N)
share_links

users → group_memberships ← groups
  ↓ (1:N)                      ↓ (1:N)
photos                       photos
```

### Indexing Strategy

**Critical Indexes (add to Prisma schema):**
```sql
-- Fast photo queries by user/group
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_group_id ON photos(group_id);

-- Time-based album generation
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at);
CREATE INDEX idx_photos_taken_at ON photos(taken_at);

-- Tag-based searches
CREATE INDEX idx_ai_tags_photo_id ON ai_tags(photo_id);
CREATE INDEX idx_ai_tags_tag ON ai_tags(tag);

-- Album queries
CREATE INDEX idx_albums_user_id ON albums(user_id);
CREATE INDEX idx_album_photos_album_id ON album_photos(album_id);

-- Share link lookups
CREATE INDEX idx_share_links_token ON share_links(token);
```

---

## Data Flow Diagrams

### 1. Photo Upload Flow

```
User → Frontend → Backend → Disk → Database → Azure Vision → Database
  │        │         │        │         │           │            │
  │        │         │        │         │           │            │
  1      Select    Validate Save    Store     Call API     Store
        photos     & auth   file   metadata              AI tags
                            │                              │
                            ↓                              ↓
                        Generate                      Auto-generate
                       thumbnail                      time-based albums
```

**Detailed Steps:**

1. **User selects photos** in React UI (drag-drop or file picker)
2. **Frontend validates** file types and sizes (client-side check)
3. **Frontend sends** to `/api/photos/upload` with JWT token
4. **Backend authenticates** user via JWT middleware
5. **Backend validates** files again (MIME type, size, extension)
6. **Backend saves** original to `/storage/originals/{UUID}.jpg`
7. **Backend generates** thumbnail using Sharp → `/storage/thumbnails/{UUID}.jpg`
8. **Backend stores** metadata in `photos` table (file paths, size, etc.)
9. **Backend calls** Azure Computer Vision API (async)
10. **Azure returns** tags (e.g., `{"tags": [{"name": "dog", "confidence": 0.95}]}`)
11. **Backend stores** tags in `ai_tags` table
12. **Backend checks** if auto-albums should be generated (e.g., if 10+ photos from same day)
13. **Backend returns** success response to frontend
14. **Frontend updates** UI (show uploaded photos)

### 2. Album Generation Flow (Smart Album)

```
User → Frontend → Backend → Database (query photos by tags) → Create album → Return
  │        │         │                     │                        │          │
  │        │         │                     │                        │          │
  1      Input    Parse    JOIN photos + ai_tags        INSERT      Show
       "dogs"   criteria   WHERE tag LIKE '%dog%'     album row    preview
```

**Detailed Steps:**

1. **User types** "Create album with all dog photos"
2. **Frontend sends** to `/api/albums/generate` with criteria: `{"tags": ["dog"]}`
3. **Backend parses** criteria and builds SQL query:
   ```sql
   SELECT DISTINCT photos.*
   FROM photos
   JOIN ai_tags ON ai_tags.photo_id = photos.id
   WHERE ai_tags.tag ILIKE '%dog%'
   AND ai_tags.confidence > 0.5
   AND photos.user_id = {current_user_id}
   ```
4. **Backend gets** matching photo IDs
5. **Backend creates** album record in `albums` table
6. **Backend inserts** photo-album relationships in `album_photos` table
7. **Backend returns** album with preview (first 4 photos)
8. **Frontend displays** album in dashboard

### 3. Authentication Flow

```
User → Frontend → Backend → Database → Backend → Frontend
  │        │         │          │         │          │
  │        │         │          │         │          │
  1     Submit   Validate   Check user  Generate   Store JWT
       email+pw   input       exists     JWT token   in localStorage
                               ↓
                         Compare bcrypt
                         password hash
```

**Login Steps:**

1. User enters email + password
2. Frontend validates input (not empty, valid email format)
3. Frontend sends POST `/api/auth/login` with credentials
4. Backend validates input again
5. Backend queries `users` table by email
6. Backend compares password with `bcrypt.compare(password, user.password_hash)`
7. If match: Backend generates JWT with payload `{userId, email}`
8. Backend returns JWT + user info to frontend
9. Frontend stores JWT in `localStorage`
10. Frontend attaches JWT to all subsequent requests in `Authorization: Bearer {token}` header

---

## Implementation Phases

### Phase 1: Foundation Setup (Week 1-2)
**Goal:** Get basic infrastructure running

**Tasks:**
- [ ] Set up Raspberry Pi OS, install PostgreSQL, Node.js 20
- [ ] Initialize Express.js backend with project structure
- [ ] Set up Prisma ORM, create database schema
- [ ] Implement authentication (register, login, JWT middleware)
- [ ] Set up Cloudflare Tunnel (connect Pi to internet)
- [ ] Create React frontend with Vite + TailwindCSS
- [ ] Deploy frontend to Azure Static Web Apps
- [ ] Test end-to-end connection (frontend → tunnel → backend → database)

**Deliverable:** User can register, login, and see empty dashboard

**How to Use Claude Code:**
```
Phase 1 Strategy:
1. Work in Plan Mode to create architecture
2. Auto Mode for boilerplate (Express setup, Prisma schema, React scaffolding)
3. Default Mode for auth logic (more control needed)
4. Create git branches: feature/backend-setup, feature/frontend-setup
5. Test locally before deploying
```

---

### Phase 2: Photo Upload & Storage (Week 3)
**Goal:** Users can upload photos to personal library

**Tasks:**
- [ ] Implement file upload endpoint (`POST /api/photos/upload`)
- [ ] Set up Multer for multipart/form-data
- [ ] Implement file validation (type, size)
- [ ] Save files to disk (`/storage/originals/`)
- [ ] Generate thumbnails with Sharp
- [ ] Store photo metadata in `photos` table
- [ ] Create photo upload UI in React
- [ ] Implement drag-drop upload
- [ ] Show upload progress bar
- [ ] Display uploaded photos in grid

**Deliverable:** User can upload photos and see them in dashboard

**Claude Code Usage:**
```
# In backend worktree
claude
[Plan Mode] "Build photo upload system with Multer, file validation, thumbnail generation using Sharp, and save to PostgreSQL. Follow security best practices."

# In frontend worktree
claude
[Auto Mode] "Create photo upload component with drag-drop, file validation, progress bar, and grid display. Use TailwindCSS."
```

---

### Phase 3: Azure Computer Vision Integration (Week 3-4)
**Goal:** AI tags photos automatically on upload

**Tasks:**
- [ ] Set up Azure Computer Vision resource (F0 tier)
- [ ] Create `aiService.js` with API client
- [ ] Implement tag extraction logic
- [ ] Store tags in `ai_tags` table
- [ ] Handle API rate limits (queue, retry logic)
- [ ] Cache results (don't re-analyze same photo)
- [ ] Add "Analyzing..." loading state in UI
- [ ] Display AI tags on photo hover

**Deliverable:** Photos get AI tags visible in UI

**Claude Code Usage:**
```
# Ask Claude to read Azure docs first
/mcp add brave-search
"Search for Azure Computer Vision API v3.2 image analysis documentation and implement integration in Node.js with error handling and rate limiting."
```

---

### Phase 4: Group Management (Week 5)
**Goal:** Users can create groups and upload group photos

**Tasks:**
- [ ] Implement group CRUD endpoints
- [ ] Create invite link system (generate unique tokens)
- [ ] Implement join-via-invite logic
- [ ] Add group permissions (admin vs member)
- [ ] Create group management UI
- [ ] Implement group photo upload (separate from personal)
- [ ] Show group members list
- [ ] Filter photos by group

**Deliverable:** Users can create groups, invite friends, upload group photos

**Claude Code Usage:**
```
# Use sub-agents for code review
/agents
Create sub-agent: "security-reviewer" to check invite link security and permission logic

[Default Mode] Build group system with invite links, permissions, and UI
[After completion] /agents security-reviewer "Review group invite link generation and permission checks"
```

---

### Phase 5: Album Generation (Week 6-7)
**Goal:** AI automatically creates albums, users can create custom albums

**Tasks:**
- [ ] Implement time-based album generation (daily, monthly, yearly)
- [ ] Create album generation logic (`albumService.js`)
- [ ] Implement smart album search (by tags)
- [ ] Create album browsing UI
- [ ] Implement lightbox photo viewer
- [ ] Add album cover (first 4 photos)
- [ ] Manual album creation UI
- [ ] Add/remove photos from albums

**Deliverable:** Users see auto-generated albums and can create custom ones

**Claude Code Usage:**
```
# Complex feature - use Plan Mode
[Plan Mode] "Think hard about album generation algorithm. We need:
1. Time-based albums (group photos by day/month/year)
2. Tag-based albums (search AI tags with confidence > 0.5)
3. Smart suggestions (detect patterns like 20+ photos in one day)
Create implementation plan with SQL queries and React components."

[Follow plan iteratively, clearing context between major sections]
```

---

### Phase 6: Download & Sharing (Week 8)
**Goal:** Users can download albums as ZIP and share publicly

**Tasks:**
- [ ] Implement album download as ZIP (streaming)
- [ ] Create share link generation (random token + expiration)
- [ ] Implement public album view (no auth required)
- [ ] Add share link UI (copy button)
- [ ] Implement link expiration logic
- [ ] Add watermark option (optional)
- [ ] Track view count on shared albums

**Deliverable:** Users can download and share albums

**Claude Code Usage:**
```
# Use custom slash command for deployment testing
/commands
Create command: /test-download "Download test album with 50 photos, verify ZIP integrity and performance"

[Auto Mode] Build download and sharing system
[After completion] /test-download
```

---

### Phase 7: Testing & Polish (Week 9-10)
**Goal:** Production-ready app with tests

**Tasks:**
- [ ] Write unit tests (services, utils)
- [ ] Write integration tests (API endpoints)
- [ ] Write E2E tests (critical user flows)
- [ ] Performance testing (100+ photos)
- [ ] Security audit (input validation, SQL injection, XSS)
- [ ] Set up error logging (Winston)
- [ ] Implement monitoring (disk usage, API quota)
- [ ] Create user documentation
- [ ] Set up CI/CD (GitHub Actions)
- [ ] Load testing with 10 concurrent users

**Deliverable:** Tested, documented, production-ready app

**Claude Code Usage:**
```
# Use Claude's testing expertise
[Plan Mode] "Design comprehensive testing strategy for PicAI covering unit, integration, and E2E tests. Include security testing for file uploads and authentication."

# Let Claude set up testing infrastructure
[Auto Mode] "Set up Jest for backend, React Testing Library for frontend, and Playwright for E2E tests. Write tests for all critical paths."
```

---

## Technology Decisions

### Frontend: React 18 + Vite

**Why React?**
- Component-based architecture (reusable photo grids, albums)
- Large ecosystem (UI libraries, hooks, tooling)
- Great developer experience
- You're already familiar with it

**Why Vite over Create React App?**
- Faster dev server (HMR in milliseconds)
- Smaller build output
- Better default configuration
- Modern (supports ESM natively)

**UI Framework: TailwindCSS + shadcn/ui**
- TailwindCSS: Utility-first, rapid development, small bundle
- shadcn/ui: High-quality accessible components (built on Radix)
- Alternative considered: Material-UI (heavier, slower)

**State Management: React Context + useReducer**
- Simple enough for MVP
- No need for Redux complexity
- Can upgrade to Zustand if needed later

---

### Backend: Node.js 20 + Express.js

**Why Node.js?**
- Async I/O (perfect for file uploads, API calls)
- Single language (JavaScript everywhere)
- Great ecosystem (Sharp, Multer, Prisma)
- Works well on Raspberry Pi

**Why Express.js?**
- Minimal, unopinionated
- Huge ecosystem of middleware
- Easy to test
- Alternative considered: Fastify (faster but less ecosystem)

**ORM: Prisma**
- Type-safe database access
- Excellent migration system
- Great DevEx (auto-complete, validation)
- Handles connection pooling
- Alternative considered: TypeORM (more complex)

---

### Database: PostgreSQL 15

**Why PostgreSQL?** (Already covered above)

**Migration Strategy:**
- Prisma handles migrations (`npx prisma migrate dev`)
- Version control migrations (commit to git)
- Automated backups daily

---

### Infrastructure

**Raspberry Pi 4**
- Cost: $75 (one-time) vs $5-10/month for VPS
- Privacy: Your data, your hardware
- Learning: Great DevOps experience
- Limitation: Single point of failure (ok for MVP)

**Cloudflare Tunnel**
- Free alternative to VPS or ngrok
- No port forwarding (works with CGNAT)
- DDoS protection included
- SSL automatic

**Azure Static Web Apps**
- Free hosting (100GB bandwidth)
- Auto-deploy from GitHub
- Global CDN
- Custom domains supported

**Azure Computer Vision**
- Best-in-class AI (better than AWS Rekognition for tags)
- Free tier generous (5,000/month)
- Simple API

---

## Security Architecture

### Authentication Flow

```
Login Request
    ↓
Validate credentials (bcrypt)
    ↓
Generate JWT (payload: {userId, email}, secret: env var, expires: 7d)
    ↓
Return JWT to frontend
    ↓
Frontend stores in localStorage
    ↓
All subsequent requests: Authorization: Bearer {JWT}
    ↓
Backend middleware verifies JWT
    ↓
Attach user to req.user
    ↓
Route handlers use req.user.id
```

### Security Measures

**1. Authentication**
- JWT with expiration (7 days default, 30 with "remember me")
- bcrypt password hashing (salt rounds = 10)
- Email verification on signup (future)
- Rate limiting on login attempts (5 attempts/15 min)

**2. Input Validation**
- All inputs validated with Joi/Zod
- File uploads: type check (MIME), size check (25MB max)
- Filename sanitization (remove special chars, generate UUID)

**3. SQL Injection Prevention**
- Prisma ORM (parameterized queries)
- Never concatenate user input in queries

**4. XSS Prevention**
- React auto-escapes output (safe by default)
- Content Security Policy headers
- Sanitize any HTML rendering (use DOMPurify if needed)

**5. CSRF Protection**
- JWT in Authorization header (not cookies)
- SameSite cookie attribute for any future cookies

**6. File Upload Security**
- Validate MIME type (not just extension)
- Store outside web root
- Serve files via controlled endpoint (auth check)
- Consider virus scanning (ClamAV) if storage allows

**7. HTTPS Only**
- Cloudflare Tunnel handles SSL
- Redirect HTTP → HTTPS
- HSTS header enabled

**8. Rate Limiting**
- 100 requests/minute per IP (Cloudflare)
- 5 login attempts/15 min per email
- 20 photo uploads/hour per user

**9. Environment Variables**
- Never commit `.env` to git
- Use `.env.example` for reference
- Rotate secrets periodically

**10. Error Handling**
- Never expose stack traces to users
- Log errors server-side only
- Generic error messages to frontend

---

## Scalability Considerations

### Current Limits (MVP)

- **Users:** 10-50 concurrent users
- **Photos:** 10,000-100,000 photos
- **Raspberry Pi:** Can handle ~50 req/sec (with caching)
- **PostgreSQL:** Millions of records (database not bottleneck)
- **Azure Vision:** 5,000 calls/month (free tier)

### Future Scaling Strategies

**If hitting Raspberry Pi limits:**
1. Add second Pi behind Cloudflare load balancer
2. Shared PostgreSQL database (both Pis connect)
3. Sync file storage via NFS or rsync

**If hitting Azure Vision limits:**
- Upgrade to S1 tier ($1/1,000 transactions)
- Implement better caching (Redis)
- Only analyze new photos, not duplicates

**If outgrowing home setup:**
- Migrate database to managed PostgreSQL (DigitalOcean, Azure)
- Move photo storage to S3/Azure Blob
- Keep same codebase (minimal changes)

### Performance Optimizations

**Backend:**
- Connection pooling (Prisma default: 10 connections)
- Lazy loading (paginate photo queries, 50 per page)
- Caching frequent queries (Redis or in-memory)
- Streaming file downloads (don't load entire ZIP in RAM)

**Frontend:**
- Lazy load images (Intersection Observer)
- Virtual scrolling for large photo lists (react-window)
- Image optimization (WebP format, responsive sizes)
- Code splitting (React.lazy)

**Database:**
- Proper indexes (already covered)
- EXPLAIN ANALYZE slow queries
- Vacuum regularly (PostgreSQL maintenance)

---

## Development Environment Setup

### Required Software

**Raspberry Pi:**
- Raspberry Pi OS (64-bit, lite version ok)
- PostgreSQL 15: `sudo apt install postgresql`
- Node.js 24.11.1: Use nvm: `nvm install 24.11.1`
- Git: `sudo apt install git`
- PM2: `npm install -g pm2` (process manager)

**Local Machine (for development):**
- Node.js 20
- Git
- PostgreSQL (optional, can develop against Pi)
- VS Code with extensions:
  - Prisma
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense

### Directory Structure

```
picai/
├── backend/
│   ├── src/
│   │   ├── index.js                 # Entry point
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── users.routes.js
│   │   │   ├── groups.routes.js
│   │   │   ├── photos.routes.js
│   │   │   └── albums.routes.js
│   │   ├── controllers/             # Request handlers
│   │   ├── services/                # Business logic
│   │   │   ├── aiService.js
│   │   │   ├── fileService.js
│   │   │   ├── albumService.js
│   │   │   └── authService.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js   # JWT verification
│   │   │   ├── validate.middleware.js
│   │   │   └── error.middleware.js
│   │   ├── utils/
│   │   │   ├── logger.js            # Winston logger
│   │   │   └── helpers.js
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   ├── storage/                     # DO NOT COMMIT
│   │   ├── originals/
│   │   └── thumbnails/
│   ├── tests/
│   ├── .env.example
│   ├── .env                         # DO NOT COMMIT
│   ├── package.json
│   └── CLAUDE.md
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── photos/
│   │   │   ├── albums/
│   │   │   ├── groups/
│   │   │   └── common/              # Reusable components
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Albums.jsx
│   │   │   └── Groups.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   ├── api.js               # Axios instance
│   │   │   └── azureVision.js       # (if calling from frontend)
│   │   └── utils/
│   ├── public/
│   ├── tests/
│   ├── .env.example
│   ├── .env                         # DO NOT COMMIT
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── CLAUDE.md
├── docs/
│   ├── architecture.md              # This file
│   ├── azure-setup.md
│   ├── deployment.md
│   └── api-reference.md
├── .github/
│   └── workflows/
│       ├── backend-tests.yml
│       └── frontend-deploy.yml
├── CLAUDE.md                        # Main project knowledge
├── PRD.md
└── README.md
```

---

## Next Steps

1. **Review all documents** (PRD, CLAUDE.md, azure-setup.md, this file)
2. **Set up Azure account** and create Computer Vision resource (use azure-setup.md)
3. **Set up Raspberry Pi** (install OS, PostgreSQL, Node.js)
4. **Initialize backend** with Claude Code in Plan Mode
5. **Initialize frontend** in separate worktree
6. **Follow implementation phases** week by week
7. **Test frequently** after each phase
8. **Deploy iteratively** (don't wait until everything is done)

---

**You're ready to build PicAI!** 🚀

Use Claude Code strategically:
- **Plan Mode** for architecture and complex features
- **Auto Mode** for boilerplate and repetitive tasks
- **Default Mode** for security-critical code (auth, file uploads)
- **Sub-agents** for code review and testing
- **Git branches** for every feature
- **Clear context** frequently to stay focused

Good luck! Reach out if you hit roadblocks.