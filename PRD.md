# PicAI - Product Requirements Document (PRD)

## Version 1.0 - MVP
**Last Updated:** November 15, 2025  
**Author:** Jeffrey  
**Status:** Planning Phase

---

## 1. Executive Summary

PicAI is a collaborative photo management platform that uses AI to automatically organize and curate photos into meaningful albums. Users can share photos in personal or group contexts, and leverage AI-powered sorting to create albums based on content, time periods, or custom specifications.

### Key Value Propositions
- **Effortless Organization**: AI automatically sorts photos into meaningful albums
- **Collaborative Sharing**: Create groups and share memories with friends/family
- **Smart Curation**: Generate albums by time period, content, or custom criteria
- **Privacy-Focused**: Self-hosted backend with user-controlled data

---

## 2. Goals & Success Metrics

### Primary Goals
1. Enable users to upload and organize photos with minimal manual effort
2. Provide AI-powered photo sorting that creates meaningful albums
3. Facilitate photo sharing within groups
4. Maintain user privacy with hybrid cloud architecture

### Success Metrics (MVP)
- Users can create account and upload photos within 5 minutes
- AI successfully categorizes 90%+ of uploaded photos
- Albums can be generated and downloaded within 30 seconds
- Zero data breaches or unauthorized access incidents
- System handles 100+ photos per user without performance degradation

---

## 3. User Personas

### Primary Persona: "Sarah the Social Organizer"
- **Age:** 28
- **Background:** Takes lots of photos at events, trips, and gatherings
- **Pain Points:** 
  - Hundreds of unsorted photos on phone
  - Hard to find specific photos quickly
  - Wants to share curated albums with friends
- **Goals:** Automatically organize photos and easily share with groups

### Secondary Persona: "Mike the Memory Keeper"
- **Age:** 35
- **Background:** Family person who wants to preserve memories
- **Pain Points:**
  - Photos scattered across devices
  - Wants to create albums by event/time period
  - Concerned about privacy on big tech platforms
- **Goals:** Private photo storage with smart organization

---

## 4. Feature Requirements

### 4.1 Authentication & User Management

#### Must Have (P0)
- **User Registration**
  - Email + password signup
  - Email verification
  - Password requirements: min 8 chars, 1 uppercase, 1 number, 1 special char
  
- **User Login**
  - Email + password authentication
  - "Remember me" option
  - Session management (7-day default, 30-day with "remember me")
  
- **User Logout**
  - Clear session tokens
  - Redirect to login page

#### Should Have (P1)
- Password reset via email
- Profile management (name, profile picture)

#### Nice to Have (P2)
- OAuth (Google/Microsoft login)
- Two-factor authentication

---

### 4.2 Group Management

#### Must Have (P0)
- **Create Group**
  - Group name (required, max 50 chars)
  - Group description (optional, max 200 chars)
  - Auto-assign creator as admin
  
- **Join Group**
  - Invite link system
  - Accept/decline invitations
  - View group member list
  
- **Group Roles**
  - Admin: Can add/remove members, delete group
  - Member: Can upload photos, create albums

#### Should Have (P1)
- Leave group functionality
- Group settings (privacy, photo upload permissions)
- Multiple admins per group

#### Nice to Have (P2)
- Group profile pictures
- Activity feed per group
- Member removal by admin

---

### 4.3 Photo Upload & Storage

#### Must Have (P0)
- **Upload Photos**
  - Support formats: JPEG, PNG, HEIC
  - Max file size: 25MB per photo
  - Batch upload (up to 50 photos at once)
  - Upload to personal library OR specific group
  - Progress indicator during upload
  
- **Photo Storage**
  - Store original quality photos on Raspberry Pi
  - Store metadata in database (filename, upload date, user, group, etc.)
  - Generate thumbnails (200x200px) for quick loading
  
- **Photo Organization**
  - Personal library (private to user)
  - Group libraries (shared with group members)
  - Photos tagged with upload timestamp

#### Should Have (P1)
- Duplicate detection (prevent same photo uploaded twice)
- Photo deletion capability
- Compression options for storage optimization

#### Nice to Have (P2)
- EXIF data preservation
- GPS location extraction
- Camera metadata display

---

### 4.4 AI-Powered Photo Sorting

#### Must Have (P0)
- **Azure Computer Vision Integration**
  - Automatic tagging when photos are uploaded
  - Extract: objects, scenes, activities, colors, landmarks
  - Face detection (for grouping, not identification)
  - Text recognition (OCR for signs, documents)
  
- **Automatic Album Generation**
  - **Time-based albums**:
    - By day (e.g., "November 15, 2025")
    - By month (e.g., "November 2025")
    - By year (e.g., "2025")
  - Auto-generate on upload or on-demand
  - Show preview of first 4 photos as album cover

#### Should Have (P1)
- **Custom Album Generation**
  - User specifies search criteria:
    - "All photos with dogs"
    - "Photos from vacation" (by date range + tags)
    - "Photos with [person's name]" (by face grouping)
  - Natural language input for album creation
  - Show AI confidence scores for matches

- **Smart Suggestions**
  - Suggest albums based on detected patterns
  - "Looks like you went to Paris - create album?"
  - "Lots of beach photos from last week - group them?"

#### Nice to Have (P2)
- Custom AI models for specific photo types
- Duplicate photo detection and removal
- Photo quality scoring (blur detection, exposure)

---

### 4.5 Album Management

#### Must Have (P0)
- **View Albums**
  - Grid view with thumbnails
  - Album title and photo count
  - Click to view full album
  - Sort albums by: date created, name, photo count
  
- **Album Details**
  - View all photos in album
  - Lightbox view for full-size photos
  - Navigation between photos (prev/next)
  - Display album metadata (created date, photo count, tags)
  
- **Manual Album Creation**
  - Create empty album
  - Add photos from library
  - Remove photos from album
  - Rename/delete album

#### Should Have (P1)
- Album descriptions/captions
- Collaborative albums (group members can add photos)
- Album privacy settings (private, group-only, shareable link)

#### Nice to Have (P2)
- Album cover customization
- Photo ordering within albums (chronological, manual)
- Album templates (vacation, birthday, wedding, etc.)

---

### 4.6 Download & Sharing

#### Must Have (P0)
- **Download Albums**
  - Download entire album as ZIP file
  - Include all original quality photos
  - ZIP file named: "AlbumName_YYYY-MM-DD.zip"
  - Progress indicator for large downloads
  
- **Share Albums**
  - Generate shareable link
  - Link expires after 7 days (configurable)
  - No login required to view shared album
  - Watermark option (optional, shows "Shared from PicAI")

#### Should Have (P1)
- Download individual photos
- Download options (original, compressed, thumbnail)
- Copy shareable link button
- Share directly to social media (future)

#### Nice to Have (P2)
- Custom expiration dates for share links
- Password-protected share links
- View count for shared albums

---

## 5. Technical Architecture

### 5.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           React App (Azure Static Web Apps)            │ │
│  │  - Authentication UI                                   │ │
│  │  - Photo Upload Interface                              │ │
│  │  - Album Browsing & Management                         │ │
│  │  - Azure Computer Vision API Integration              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE TUNNEL                         │
│  - Secure connection to Raspberry Pi                        │
│  - SSL/TLS termination                                      │
│  - Rate limiting                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Secure Tunnel
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    RASPBERRY PI BACKEND                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Node.js/Express Server                    │ │
│  │  - REST API                                            │ │
│  │  - Authentication (JWT)                                │ │
│  │  - File Upload Handling                                │ │
│  │  - Album Generation Logic                              │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL Database                       │ │
│  │  - User accounts                                       │ │
│  │  - Groups & memberships                                │ │
│  │  - Photo metadata                                      │ │
│  │  - AI tags & labels                                    │ │
│  │  - Albums                                              │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Local File Storage                        │ │
│  │  /photos/originals/                                    │ │
│  │  /photos/thumbnails/                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AZURE SERVICES                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Azure Computer Vision API                    │ │
│  │  - Image Analysis                                      │ │
│  │  - Object Detection                                    │ │
│  │  - Face Detection                                      │ │
│  │  - OCR                                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Technology Stack

#### Frontend
- **Framework:** React 18 with Vite
- **Hosting:** Azure Static Web Apps (Free tier)
- **UI Library:** TailwindCSS + shadcn/ui
- **State Management:** React Context API + useReducer
- **HTTP Client:** Axios
- **Authentication:** JWT stored in localStorage

#### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js
- **Database:** PostgreSQL 15
- **ORM:** Prisma
- **Authentication:** JWT (jsonwebtoken)
- **File Upload:** Multer
- **Image Processing:** Sharp (for thumbnails)

#### Infrastructure
- **Backend Hosting:** Raspberry Pi 4 (4GB+ RAM recommended)
- **Tunnel:** Cloudflare Tunnel (free)
- **AI Service:** Azure Computer Vision API
- **Storage:** Raspberry Pi local storage (minimum 128GB microSD or USB SSD)

### 5.3 Database Schema (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Group memberships
CREATE TABLE group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- 'admin' or 'member'
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(50),
  width INTEGER,
  height INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  taken_at TIMESTAMP -- from EXIF if available
);

-- AI Tags table
CREATE TABLE ai_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  category VARCHAR(50), -- 'object', 'scene', 'activity', 'color', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Albums table
CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  generation_criteria JSONB, -- stores search criteria for auto albums
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Album photos (many-to-many)
CREATE TABLE album_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(album_id, photo_id)
);

-- Share links
CREATE TABLE share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  view_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_group_id ON photos(group_id);
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at);
CREATE INDEX idx_ai_tags_photo_id ON ai_tags(photo_id);
CREATE INDEX idx_ai_tags_tag ON ai_tags(tag);
CREATE INDEX idx_albums_user_id ON albums(user_id);
CREATE INDEX idx_share_links_token ON share_links(token);
```

### 5.4 API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

#### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `DELETE /api/users/:id` - Delete user account

#### Groups
- `POST /api/groups` - Create new group
- `GET /api/groups` - Get user's groups
- `GET /api/groups/:id` - Get group details
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/:id/invite` - Generate invite link
- `POST /api/groups/:id/join` - Join group via invite
- `DELETE /api/groups/:id/members/:userId` - Remove member
- `POST /api/groups/:id/leave` - Leave group

#### Photos
- `POST /api/photos/upload` - Upload photos (multipart/form-data)
- `GET /api/photos` - Get user's photos (with filters)
- `GET /api/photos/:id` - Get photo details
- `DELETE /api/photos/:id` - Delete photo
- `GET /api/photos/:id/file` - Get photo file
- `GET /api/photos/:id/thumbnail` - Get thumbnail
- `POST /api/photos/:id/analyze` - Trigger AI analysis

#### Albums
- `POST /api/albums` - Create album (manual or auto)
- `GET /api/albums` - Get user's albums
- `GET /api/albums/:id` - Get album details
- `PUT /api/albums/:id` - Update album
- `DELETE /api/albums/:id` - Delete album
- `POST /api/albums/:id/photos` - Add photos to album
- `DELETE /api/albums/:id/photos/:photoId` - Remove photo from album
- `POST /api/albums/:id/generate` - Generate auto album
- `GET /api/albums/:id/download` - Download album as ZIP
- `POST /api/albums/:id/share` - Create share link
- `GET /api/shared/:token` - View shared album (public)

### 5.5 Azure Services Setup & Cost Management

#### Azure Computer Vision API
**Recommended Tier:** Free (F0)
- **Limits:** 5,000 transactions/month, 20/minute
- **Cost:** $0/month
- **Upgrade Path:** S1 ($1/1,000 transactions) if you exceed free tier

**Setup Steps:**
1. Create Azure account (free tier gives $200 credit for 30 days)
2. Create Computer Vision resource
3. Select F0 (Free) tier
4. Copy API key and endpoint
5. Store in environment variables (never commit to code)

**Cost Protection:**
- Set up Azure Cost Alerts (alert at $5, $10, $20)
- Enable spending limit on subscription
- Monitor usage dashboard weekly
- Implement caching to reduce API calls

#### Azure Static Web Apps
**Recommended Tier:** Free
- **Limits:** 100GB bandwidth/month, custom domain support
- **Cost:** $0/month
- **Storage:** 250MB per app

**Setup Steps:**
1. Create Static Web App resource
2. Connect to GitHub repo (auto-deploy on push)
3. Configure build settings for React app
4. Add custom domain (optional)

**Cost Protection:**
- Free tier is sufficient for MVP
- Monitor bandwidth usage
- Standard tier ($9/month) only if you need > 100GB bandwidth

#### Azure Storage (Optional - for backup)
**Recommended:** Start without it, use only Raspberry Pi storage
- If needed later: Blob Storage LRS (Locally Redundant) 
- ~$0.02/GB/month

**Cost Protection:**
- Only use if Pi storage fails
- Set lifecycle policies to auto-delete old files
- Use cool/archive tiers for old photos

#### Total Estimated Azure Costs for MVP
- **Month 1-12:** $0 (free tiers only)
- **If scaled:** ~$10-20/month (S1 Computer Vision + potential bandwidth)

#### Azure Budget & Alerts Setup
```bash
# Create budget via Azure Portal
1. Go to Cost Management + Billing
2. Create Budget: "PicAI Monthly Budget"
3. Set amount: $25/month
4. Set alerts:
   - 50% threshold ($12.50) → Email alert
   - 75% threshold ($18.75) → Email alert
   - 90% threshold ($22.50) → Email alert + disable resources
5. Action groups: Send email + SMS
```

### 5.6 Cloudflare Tunnel Setup

**Purpose:** Securely expose Raspberry Pi backend to internet without port forwarding

**Setup Steps:**
1. Install cloudflared on Raspberry Pi
2. Authenticate with Cloudflare account
3. Create tunnel: `cloudflared tunnel create picai`
4. Configure DNS: Point `api.yourdomain.com` to tunnel
5. Create config file specifying which services to expose
6. Run as systemd service for auto-start

**Security Configurations:**
- Only expose specific API routes (not entire Pi)
- Enable Cloudflare WAF (Web Application Firewall)
- Rate limiting: 100 requests/minute per IP
- Block countries if needed
- Enable HTTPS only

**Example Config (`~/.cloudflared/config.yml`):**
```yaml
tunnel: picai
credentials-file: /home/pi/.cloudflared/tunnel-id.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

---

## 6. User Flows

### 6.1 New User Onboarding Flow
1. User lands on homepage → "Sign Up" button
2. Enter email, password, name → Submit
3. Email verification sent → Click link
4. Redirected to login page → Enter credentials
5. Redirected to dashboard → "Upload Your First Photos" prompt
6. Upload photos → AI processes in background
7. View auto-generated albums → Success!

### 6.2 Photo Upload & Auto-Album Flow
1. User clicks "Upload Photos" button
2. Select files (drag-drop or file picker)
3. Choose destination: Personal Library OR Group
4. Photos upload with progress bar
5. Backend saves files, creates thumbnails
6. Frontend sends photos to Azure Computer Vision API
7. AI tags returned and stored in database
8. Backend generates time-based albums automatically
9. User sees notification: "3 new albums created!"
10. User browses albums in dashboard

### 6.3 Custom Album Generation Flow
1. User clicks "Create Smart Album"
2. Modal opens: "What photos do you want to group?"
3. User types: "All photos of my dog Max"
4. System searches AI tags for "dog" matches
5. Preview shows matching photos with confidence scores
6. User confirms → Album created
7. Album appears in dashboard

### 6.4 Group Photo Sharing Flow
1. User creates group: "Family Vacation 2025"
2. Generates invite link → Sends to family members
3. Members join group via link
4. User uploads 50 vacation photos to group
5. AI auto-generates "Beach Photos", "Hiking Trip", etc.
6. All group members see albums
7. Member downloads "Beach Photos" album as ZIP
8. Success!

---

## 7. Non-Functional Requirements

### 7.1 Performance
- **Photo Upload:** Max 30 seconds for 10 photos (10MB each)
- **Thumbnail Generation:** < 5 seconds per photo
- **AI Analysis:** < 10 seconds per photo (Azure API dependent)
- **Album Loading:** < 2 seconds for 100 photos
- **Download Album:** Stream ZIP without loading all in memory
- **Database Queries:** < 500ms for album generation

### 7.2 Security
- **Authentication:** JWT with 7-day expiration
- **Password Storage:** bcrypt with salt rounds = 10
- **HTTPS Only:** All API calls over TLS
- **Input Validation:** Sanitize all user inputs
- **File Upload:** Validate file types, max size limits
- **Rate Limiting:** 100 requests/minute per user
- **SQL Injection Prevention:** Use Prisma ORM (parameterized queries)
- **XSS Prevention:** Sanitize outputs, use Content Security Policy

### 7.3 Reliability
- **Uptime:** 95% (Raspberry Pi may require restarts)
- **Backup Strategy:** 
  - Weekly database backups to external drive
  - Photo backups to external USB drive
- **Error Handling:** Graceful degradation, user-friendly error messages
- **Logging:** Winston for structured logs, rotate daily

### 7.4 Scalability (Future Considerations)
- **Current MVP:** Support 10-50 users, 10,000 photos
- **Horizontal Scaling:** Add more Raspberry Pis behind load balancer
- **Database:** PostgreSQL can handle millions of records
- **Storage:** Expandable via USB drives or NAS

### 7.5 Usability
- **Mobile Responsive:** Works on phones, tablets, desktops
- **Accessibility:** WCAG 2.1 Level AA compliance
- **Browser Support:** Chrome, Firefox, Safari, Edge (last 2 versions)
- **Loading States:** Show spinners, progress bars
- **Error Messages:** Clear, actionable (e.g., "Photo must be < 25MB")

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Raspberry Pi downtime | Medium | High | Implement auto-restart, monitoring alerts |
| Azure API rate limits exceeded | Medium | Medium | Cache results, implement request queue |
| Storage fills up | High | High | Monitor disk usage, alert at 80%, auto-cleanup |
| Cloudflare Tunnel disconnects | Low | High | systemd auto-restart, health checks |
| Database corruption | Low | Critical | Daily backups, WAL archiving |
| User uploads malicious files | Medium | High | File type validation, virus scanning |
| Privacy breach | Low | Critical | Encryption at rest, access controls, audit logs |

---

## 9. Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Raspberry Pi with PostgreSQL
- [ ] Initialize Express.js backend with Prisma
- [ ] Implement authentication (register, login, logout)
- [ ] Set up Cloudflare Tunnel
- [ ] Create React frontend with basic routing
- [ ] Deploy frontend to Azure Static Web Apps

### Phase 2: Core Features (Week 3-4)
- [ ] Implement photo upload (backend + frontend)
- [ ] File storage and thumbnail generation
- [ ] Integrate Azure Computer Vision API
- [ ] Store AI tags in database
- [ ] Create photo browsing UI

### Phase 3: Groups (Week 5)
- [ ] Group CRUD operations
- [ ] Invite link system
- [ ] Group photo uploads
- [ ] Group permissions

### Phase 4: Albums (Week 6-7)
- [ ] Auto-generate time-based albums
- [ ] Manual album creation
- [ ] Smart album generation (search by tags)
- [ ] Album browsing UI
- [ ] Lightbox photo viewer

### Phase 5: Sharing & Download (Week 8)
- [ ] Album download as ZIP
- [ ] Share link generation
- [ ] Public album viewing page
- [ ] Download individual photos

### Phase 6: Polish & Testing (Week 9-10)
- [ ] Comprehensive testing (unit, integration, E2E)
- [ ] Performance optimization
- [ ] Security audit
- [ ] User documentation
- [ ] Deployment automation

---

## 10. Open Questions

1. **Face Recognition:** Should we group photos by people? (Privacy concerns)
2. **Video Support:** Should MVP include videos or photos only?
3. **Mobile Apps:** Native iOS/Android or PWA sufficient?
4. **Notifications:** Email/push notifications for new albums, group invites?
5. **Storage Limits:** Per-user storage quotas?
6. **Monetization:** Keep free or freemium model later?

---

## 11. Success Criteria for MVP Launch

- [ ] 5 beta testers can successfully create accounts
- [ ] Users upload 100+ photos without errors
- [ ] AI correctly tags 90%+ of photos
- [ ] Auto-albums generate within 30 seconds
- [ ] Zero security vulnerabilities in penetration testing
- [ ] System stable for 7 days without crashes
- [ ] Positive user feedback (4+ stars)

---

## 12. Future Enhancements (Post-MVP)

- Advanced AI: Custom models, face identification, duplicate detection
- Mobile apps: Native iOS/Android with offline support
- Collaborative editing: Multiple users edit same album
- Advanced search: "Find all photos of dogs at the beach in summer"
- Integration: Google Photos import, social media sharing
- Premium features: Unlimited storage, priority AI processing
- Analytics: Photo insights, most photographed places/objects

---

## Appendix A: Glossary

- **Album:** Collection of photos, either manually curated or AI-generated
- **AI Tag:** Label assigned to photo by Azure Computer Vision (e.g., "dog", "beach")
- **Auto-Album:** Album automatically created by AI based on time or content
- **Group:** Collection of users who can share photos together
- **Thumbnail:** Small preview image (200x200px) for fast loading
- **Share Link:** Public URL that allows viewing album without login

---

## Appendix B: References

- Azure Computer Vision API Docs: https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/
- Cloudflare Tunnel Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- PostgreSQL Best Practices: https://wiki.postgresql.org/wiki/Don't_Do_This
- React Best Practices: https://react.dev/learn

---

**Document End**