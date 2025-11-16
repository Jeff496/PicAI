# PicAI Quick Reference Card

**Node:** v24.11.1 | **NPM:** v11.6.2 | **Project:** ~/PicAI/

---

## 📁 File Placement Guide

### Copy These Files:

```bash
# Main project guides (Claude auto-reads)
FINAL-CLAUDE.md           → ~/PicAI/CLAUDE.md
PRD.md                    → ~/PicAI/PRD.md (already have)

# Backend guide
FINAL-BACKEND-CLAUDE.md   → ~/PicAI/backend/CLAUDE.md

# Frontend guide
FINAL-FRONTEND-CLAUDE.md  → ~/PicAI/frontend/CLAUDE.md

# Reference docs (for your use)
FINAL-PRE-CODING-CHECKLIST.md → ~/PicAI/docs/pre-coding-checklist.md
(All other docs)              → ~/PicAI/docs/
```

### Create These Files:

```bash
# Backend
~/PicAI/backend/.env          # Fill from checklist
~/PicAI/backend/.env.example  # Without real values
~/PicAI/backend/src/          # Create directory

# Frontend  
~/PicAI/frontend/.env         # VITE_API_URL=http://localhost:3001/api
~/PicAI/frontend/.env.example # Same but for reference
```

---

## 🚀 Commands Quick Reference

### Backend

```bash
cd ~/PicAI/backend

# Development
npm run dev                    # Start with auto-reload
npm run type-check            # Check TypeScript types
npm run build                 # Compile to JavaScript

# Database
npx prisma studio             # Open database GUI
npx prisma generate           # Generate Prisma client
npx prisma migrate dev        # Create migration
npx prisma migrate deploy     # Apply migrations (production)

# Testing
npm test                      # Run tests
npm run test:coverage         # With coverage report

# Production
npm run build                 # Build first
pm2 start dist/index.js --name picai-backend
pm2 logs picai-backend        # View logs
pm2 restart picai-backend     # Restart
```

### Frontend

```bash
cd ~/PicAI/frontend

# Development
npm run dev                   # Start Vite dev server (port 5173)
npm run build                 # Build for production
npm run preview               # Preview production build
npm run lint                  # Lint code

# Type check
npm run type-check            # Verify types (via build)
```

### Git

```bash
# Status check
git status                    # Should NOT show .env files

# Create feature branch
git checkout -b feature/user-auth

# Commit
git add .
git commit -m "feat: add user authentication"
git push origin feature/user-auth

# Merge to main
git checkout main
git merge feature/user-auth
git push origin main
```

### System Services

```bash
# PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql
psql -U picai_user -d picai -h localhost

# Cloudflare Tunnel
sudo systemctl status cloudflared
sudo systemctl restart cloudflared
sudo journalctl -u cloudflared -n 50   # View logs
cloudflared tunnel info picai          # Check tunnel

# View tunnel URL
cloudflared tunnel list
```

---

## 🔑 Environment Variables

### Backend (.env)

```bash
NODE_ENV=development
PORT=3001
FRONTEND_URL=https://YOUR-APP.azurestaticapps.net

DATABASE_URL=postgresql://picai_user:PASSWORD@localhost:5432/picai

JWT_SECRET=YOUR-32-CHAR-SECRET   # openssl rand -base64 32
JWT_EXPIRATION=7d

AZURE_VISION_KEY=YOUR-AZURE-KEY
AZURE_VISION_ENDPOINT=https://YOUR-RESOURCE.cognitiveservices.azure.com/

UPLOAD_DIR=/home/jeffreykeem/PicAI/backend/storage/originals
THUMBNAIL_DIR=/home/jeffreykeem/PicAI/backend/storage/thumbnails
MAX_FILE_SIZE=26214400
```

### Frontend (.env)

```bash
# Local development
VITE_API_URL=http://localhost:3001/api

# Production (set in Azure, not .env)
VITE_API_URL=https://YOUR-TUNNEL-URL/api
```

---

## 📊 Versions

| Package | Backend | Frontend |
|---------|---------|----------|
| Node.js | 24.11.1 | 24.11.1 |
| TypeScript | 5.9.3 | 5.9.3 |
| React | - | 19.2.0 |
| Express | 5.1.0 | - |
| Prisma | 6.19.0 | - |
| Vite | - | 7.2.2 |
| TailwindCSS | - | 4.1.17 |
| Axios | 1.13.2 | 1.13.2 |
| Zod | 4.1.12 | 4.1.12 |
| React Query | - | 5.90.9 |
| React Router | - | 7.9.6 |

---

## 🌐 URLs & Ports

| Service | URL | Port |
|---------|-----|------|
| Backend Dev | http://localhost:3001 | 3001 |
| Frontend Dev | http://localhost:5173 | 5173 |
| PostgreSQL | localhost | 5432 |
| Prisma Studio | http://localhost:5555 | 5555 |
| Cloudflare Tunnel | https://YOUR-URL | - |
| Azure Static Web App | https://YOUR-APP.azurestaticapps.net | - |

---

## 📂 Important Paths

```
~/PicAI/
├── backend/
│   ├── src/               # TypeScript source
│   ├── dist/              # Compiled JS (gitignored)
│   ├── storage/           # Photos (gitignored)
│   │   ├── originals/
│   │   └── thumbnails/
│   ├── logs/              # App logs (gitignored)
│   └── prisma/            # Database schema
├── frontend/
│   ├── src/               # React source
│   ├── dist/              # Build output (gitignored)
│   └── public/            # Static assets
└── docs/                  # All reference docs
```

---

## ⚠️ Common Issues

### "Cannot find module"

```bash
# Backend
cd ~/PicAI/backend
rm -rf node_modules package-lock.json
npm install
npx prisma generate

# Frontend
cd ~/PicAI/frontend
rm -rf node_modules package-lock.json
npm install
```

### PostgreSQL connection failed

```bash
sudo systemctl restart postgresql
psql -U picai_user -d picai -h localhost -c "SELECT 1;"
```

### Cloudflare Tunnel not working

```bash
sudo systemctl restart cloudflared
sudo journalctl -u cloudflared -n 50
cloudflared tunnel info picai
```

### TypeScript errors

```bash
# Regenerate Prisma types
cd ~/PicAI/backend
npx prisma generate

# Clear cache
rm -rf dist/ node_modules/
npm install
```

### Git shows .env files

```bash
# Remove from git
git rm --cached backend/.env frontend/.env

# Verify .gitignore
cat .gitignore | grep ".env"
```

---

## 🔒 Security Checklist

- [ ] `.env` files NOT in git
- [ ] JWT secret is 32+ characters
- [ ] PostgreSQL password is strong
- [ ] Azure keys only in `.env`
- [ ] `storage/` directory gitignored
- [ ] HTTPS enforced everywhere
- [ ] CORS configured for frontend URL only

---

## 🎯 Starting Claude Code

### Phase 1: Authentication

```bash
cd ~/PicAI
claude

# In Plan Mode, paste:
"Read @CLAUDE.md and @PRD.md. 

I want to build Phase 1: User authentication system with TypeScript.

Components needed:
- User registration with email + password
- Login with JWT token generation  
- Password hashing with bcrypt
- JWT middleware for protected routes
- Prisma schema for users table
- Type-safe API responses

Think hard about the implementation approach following the patterns
in @backend/CLAUDE.md. Create a detailed plan with all files needed.

Let's start with just auth before moving to photos."
```

---

## 📋 Pre-Coding Verification

Before running Claude:

```bash
# 1. Check Node version
node --version    # Should be v24.11.1

# 2. Check PostgreSQL
psql -U picai_user -d picai -h localhost -c "SELECT 1;"

# 3. Check Cloudflare
sudo systemctl status cloudflared

# 4. Check environment files
cat backend/.env | head -3     # Should show values
cat frontend/.env              # Should show VITE_API_URL

# 5. Verify gitignore
git status                     # Should NOT show .env, node_modules, storage

# 6. Test backend setup
cd ~/PicAI/backend
npm run type-check

# 7. Test frontend setup
cd ~/PicAI/frontend  
npm run dev                    # Should start on :5173
```

All should pass ✅

---

## 🎨 Development Workflow

### Daily Flow

```bash
# Morning: Start services
cd ~/PicAI/backend && npm run dev      # Terminal 1
cd ~/PicAI/frontend && npm run dev     # Terminal 2
npx prisma studio                      # Terminal 3 (optional)

# Work on features with Claude Code
cd ~/PicAI
claude

# Test changes
curl http://localhost:3001/health
open http://localhost:5173

# Commit and push
git add .
git commit -m "feat: add photo upload"
git push
```

### Azure Deploys Automatically

When you push to `main`, Azure Static Web Apps automatically:
1. Builds frontend
2. Deploys to production
3. Updates https://YOUR-APP.azurestaticapps.net

Backend stays on your Pi (accessed via Cloudflare Tunnel).

---

## 📞 Getting Help

### Check Logs

```bash
# Backend logs
tail -f ~/PicAI/backend/logs/combined.log

# Cloudflare Tunnel
sudo journalctl -u cloudflared -f

# PostgreSQL
sudo journalctl -u postgresql -n 50
```

### Debug Database

```bash
npx prisma studio
# Opens GUI at http://localhost:5555
```

### Test API Manually

```bash
# Health check
curl http://localhost:3001/health

# Via tunnel
curl https://YOUR-TUNNEL-URL/health

# With auth
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/photos
```

---

## ✅ Ready Checklist

- [ ] All files in correct locations
- [ ] Backend .env filled with real values
- [ ] Frontend .env created
- [ ] PostgreSQL accessible
- [ ] Cloudflare Tunnel running
- [ ] `npm install` completed in both backend & frontend
- [ ] `npx prisma generate` run
- [ ] Git status clean (no .env files)
- [ ] All CLAUDE.md files in place

**If all checked, you're ready to code!** 🚀

---

**Last Updated:** November 15, 2025
**Status:** Ready for Development