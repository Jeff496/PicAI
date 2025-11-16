# Azure Setup & Cost Management Guide for PicAI

**Goal:** Set up Azure services for PicAI while staying on the **free tier** and protecting against accidental costs.

---

## Table of Contents
1. [Azure Account Setup](#1-azure-account-setup)
2. [Cost Protection Setup](#2-cost-protection-setup)
3. [Azure Computer Vision Setup](#3-azure-computer-vision-setup)
4. [Azure Static Web Apps Setup](#4-azure-static-web-apps-setup)
5. [Monitoring & Alerts](#5-monitoring--alerts)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Azure Account Setup

### Create Free Azure Account

1. Go to https://azure.microsoft.com/free/
2. Click **Start free**
3. Sign in with Microsoft account (or create one)
4. Verify identity (phone number + credit card required*)
5. Agree to terms

**Note:** Credit card is required for identity verification only. You **will not be charged** unless you explicitly upgrade to pay-as-you-go.

### What You Get (Free Tier)
- **$200 credit** for first 30 days (use for testing, but we won't need it)
- **12 months** of popular services free
- **Always free** services (Computer Vision F0, Static Web Apps)

### Initial Configuration

After account creation:

1. **Set Subscription Name**
   - Navigate to **Subscriptions**
   - Rename default to "PicAI Subscription"

2. **Set Spending Limit**
   - Go to **Cost Management + Billing**
   - Ensure spending limit is **ON**
   - This prevents charges after $200 credit runs out

3. **Enable Multi-Factor Authentication (MFA)**
   - Go to **Azure Active Directory** → **Security** → **MFA**
   - Enable for your account (protects against unauthorized access)

---

## 2. Cost Protection Setup

### Step 1: Create Budget with Alerts

This is **critical** to prevent unexpected costs.

1. Go to **Cost Management + Billing** in Azure Portal
2. Select **Budgets** → **Add**
3. Configure budget:
   - **Name:** PicAI Monthly Budget
   - **Amount:** $25 USD
   - **Time period:** Monthly
   - **Start date:** Current month
   - **Expiration:** Never

4. Set up **Alert Conditions:**

   **Alert 1 - Warning (50%)**
   - Threshold: 50% of budget ($12.50)
   - Email: your-email@example.com
   - Action: Send email notification

   **Alert 2 - Critical (75%)**
   - Threshold: 75% of budget ($18.75)
   - Email: your-email@example.com
   - Action: Send email + SMS (optional)

   **Alert 3 - Emergency (90%)**
   - Threshold: 90% of budget ($22.50)
   - Email: your-email@example.com
   - Action: Send alert + **manual intervention required**

5. Click **Create**

### Step 2: Set Up Action Groups (Optional but Recommended)

Action groups can **automatically disable resources** when budget exceeded.

1. Go to **Monitor** → **Alerts** → **Action groups**
2. Click **Create action group**
3. Configure:
   - **Name:** PicAI Cost Alert Actions
   - **Short name:** PicAICost
   - **Resource group:** Create new "picai-monitoring"
4. Add **Notifications:**
   - Type: Email/SMS
   - Name: Email Admin
   - Email: your-email@example.com
5. Add **Actions** (advanced - requires automation):
   - Type: Webhook (can trigger script to disable resources)
   - For MVP: Just use email notifications

### Step 3: Enable Cost Analysis Dashboard

1. Go to **Cost Management + Billing** → **Cost Analysis**
2. Pin to dashboard for easy monitoring
3. Set up views:
   - **By Service:** See which service costs most
   - **By Resource:** Track individual resources
   - **Forecast:** Predict monthly costs

### Step 4: Set Resource Tags

Tags help track costs per component.

1. When creating resources, always add tags:
   - **Project:** PicAI
   - **Environment:** Dev or Prod
   - **Owner:** Your name
2. Use tags in Cost Analysis to filter spending

---

## 3. Azure Computer Vision Setup

### Step 1: Create Computer Vision Resource

1. In Azure Portal, search for **Computer Vision**
2. Click **Create** → **Computer Vision**
3. Configure:
   - **Subscription:** PicAI Subscription
   - **Resource group:** Create new → `picai-resources`
   - **Region:** Choose closest to you (e.g., East US, West Europe)
     - **Important:** Pick a region that supports Free tier
     - Check availability: https://azure.microsoft.com/en-us/explore/global-infrastructure/products-by-region/
   - **Name:** `picai-vision` (must be globally unique)
   - **Pricing tier:** **F0 (Free)** ⚠️ **CRITICAL**

4. Click **Review + Create** → **Create**

### Step 2: Get API Credentials

1. After deployment, go to the resource
2. Navigate to **Keys and Endpoint** (left sidebar)
3. Copy:
   - **Key 1:** (your API key)
   - **Endpoint:** (URL like `https://picai-vision.cognitiveservices.azure.com/`)

4. **Store securely:**
   - Add to backend `.env` file:
     ```bash
     AZURE_VISION_KEY=your-key-here
     AZURE_VISION_ENDPOINT=https://picai-vision.cognitiveservices.azure.com/
     ```
   - **Never commit to GitHub!**

### Step 3: Test API Connection

Use this curl command to verify setup:

```bash
curl -X POST "https://picai-vision.cognitiveservices.azure.com/vision/v3.2/analyze?visualFeatures=Categories,Tags,Description,Faces,Objects,Color" \
  -H "Ocp-Apim-Subscription-Key: YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/ThreeTimeAKCGoldWinnerPembrookeWelshCorgi.jpg/1200px-ThreeTimeAKCGoldWinnerPembrookeWelshCorgi.jpg"}'
```

Expected response: JSON with detected tags (e.g., "dog", "corgi", "animal")

### Free Tier Limits (F0)

- **Monthly transactions:** 5,000
- **Transactions per minute:** 20
- **Cost:** $0/month

**How to Stay Within Limits:**
- Cache AI results in database (don't re-analyze same photo)
- Implement request queue to avoid exceeding 20/minute
- Monitor usage via Azure portal

### Upgrading (If Needed)

If you exceed free tier:
- **S1 Tier:** $1 per 1,000 transactions
- Only upgrade if consistently hitting limits
- Monitor first month before upgrading

---

## 4. Azure Static Web Apps Setup

### Step 1: Create GitHub Repository (If Not Done)

1. Create GitHub repo: `picai-frontend`
2. Push your React app to repo
3. Ensure `package.json` has build script:
   ```json
   {
     "scripts": {
       "build": "vite build",
       "preview": "vite preview"
     }
   }
   ```

### Step 2: Create Static Web App Resource

1. In Azure Portal, search for **Static Web Apps**
2. Click **Create**
3. Configure:
   - **Subscription:** PicAI Subscription
   - **Resource group:** `picai-resources` (same as Computer Vision)
   - **Name:** `picai-app`
   - **Plan type:** **Free** ⚠️ **CRITICAL**
   - **Region:** Auto-assigned (doesn't matter for static apps)
   - **Deployment details:**
     - **Source:** GitHub
     - **Sign in to GitHub** and authorize Azure
     - **Organization:** Your GitHub username
     - **Repository:** `picai-frontend`
     - **Branch:** `main`
   - **Build presets:** React
   - **App location:** `/` (root of repo)
   - **Output location:** `dist` (Vite default build folder)

4. Click **Review + Create** → **Create**

### Step 3: Automatic Deployment

Azure automatically:
1. Adds GitHub Actions workflow to your repo
2. Builds and deploys on every push to `main`
3. Provides a URL: `https://picai-app.azurestaticapps.net`

### Step 4: Configure Environment Variables

1. Go to your Static Web App resource
2. Navigate to **Configuration** (left sidebar)
3. Add environment variables:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://api.yourdomain.com/api` (Cloudflare Tunnel URL)
4. Click **Save**
5. Re-deploy to apply changes

### Step 5: Add Custom Domain (Optional)

If you have a domain (e.g., picai.com):

1. Go to **Custom domains** in Static Web App
2. Click **Add**
3. Enter domain: `picai.com` or `app.picai.com`
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (~10 min)

### Free Tier Limits

- **Bandwidth:** 100 GB/month
- **Storage:** 250 MB
- **Custom domains:** ✅ Supported
- **SSL:** ✅ Free and automatic
- **Cost:** $0/month

**How to Stay Within Limits:**
- 100GB bandwidth is ~40,000 page loads (plenty for MVP)
- Optimize images in React app (use WebP, lazy loading)
- If you somehow exceed 100GB, Azure just charges overage (~$0.15/GB)

---

## 5. Monitoring & Alerts

### Daily Monitoring Checklist

Check these **once per day** during development:

1. **Cost Dashboard**
   - Go to **Cost Management** → **Cost Analysis**
   - Verify daily spend: Should be **$0.00** if using only free services
   - If any charges appear, investigate immediately

2. **Computer Vision Usage**
   - Go to Computer Vision resource → **Metrics**
   - Check **Total Calls** metric
   - Should stay under 5,000/month and 20/minute

3. **Static Web App Bandwidth**
   - Go to Static Web App → **Metrics**
   - Check **Data Out** metric
   - Should stay under 100GB/month

### Weekly Monitoring Checklist

1. **Budget Status**
   - Check if any budget alerts triggered
   - Review spending forecast

2. **Resource Health**
   - Go to **Azure Service Health**
   - Check for any incidents affecting your services

3. **Security Alerts**
   - Go to **Security Center**
   - Review any recommendations

### Set Up Azure Mobile App

For on-the-go monitoring:

1. Download **Azure Mobile App** (iOS/Android)
2. Sign in with your account
3. Enable push notifications for:
   - Cost alerts
   - Service health
   - Security alerts

---

## 6. Troubleshooting

### Issue: "Free tier not available in this region"

**Solution:**
- Try different region (East US, West Europe, West US 2 usually support free tier)
- Check regional availability: https://azure.microsoft.com/en-us/explore/global-infrastructure/products-by-region/
- If still unavailable, contact Azure support

### Issue: "Subscription requires payment method"

**Cause:** Verification requirement
**Solution:**
- Credit card is required for verification even for free tier
- You won't be charged unless you upgrade
- Use virtual credit card if concerned (Privacy.com, Revolut)

### Issue: Computer Vision API returns 429 (Rate Limit)

**Cause:** Exceeded 20 requests/minute
**Solution:**
- Implement request queue in backend
- Add exponential backoff retry logic
- Cache results to reduce API calls
- Consider upgrading to S1 tier if consistently hitting limits

### Issue: Static Web App build failing

**Causes & Solutions:**
- **Missing build script:** Add `"build": "vite build"` to `package.json`
- **Wrong output location:** Set to `dist` in Static Web App settings
- **Node version mismatch:** Add `engines` field to `package.json`:
  ```json
  {
    "engines": {
      "node": "20.x"
    }
  }
  ```
- **Environment variables:** Add via Static Web App Configuration

### Issue: Accidental charges appearing

**Immediate Actions:**
1. Go to **Cost Management** → **Cost Analysis**
2. Identify which resource is charging
3. **Stop/delete the resource immediately**
4. Contact Azure support to dispute charges (if under free tier limits)

**Prevention:**
- Always select **Free (F0)** tier when creating resources
- Enable spending limit on subscription
- Set up budget alerts (as described above)

---

## Cost Monitoring Script (Optional)

Create a script to check Azure costs via CLI:

### Install Azure CLI

```bash
# macOS
brew install azure-cli

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Windows
# Download from https://aka.ms/installazurecliwindows
```

### Login and Check Costs

```bash
# Login
az login

# Check current costs
az consumption usage list --start-date 2025-11-01 --end-date 2025-11-30 --query '[].{Service:instanceName, Cost:pretaxCost}' --output table

# Check Computer Vision usage
az monitor metrics list --resource /subscriptions/{subscription-id}/resourceGroups/picai-resources/providers/Microsoft.CognitiveServices/accounts/picai-vision --metric TotalCalls --start-time 2025-11-01T00:00:00Z --end-time 2025-11-30T23:59:59Z
```

### Automate Daily Cost Check

Create a cron job (Linux/Mac) or Task Scheduler (Windows) to run daily:

```bash
#!/bin/bash
# daily-cost-check.sh

az consumption usage list --start-date $(date +%Y-%m-01) --end-date $(date +%Y-%m-%d) --query '[].{Cost:pretaxCost}' --output tsv | awk '{sum+=$1} END {print "Total cost this month: $" sum}'

# Alert if costs > $5
COST=$(az consumption usage list --start-date $(date +%Y-%m-01) --end-date $(date +%Y-%m-%d) --query 'sum([].pretaxCost)' --output tsv)
if (( $(echo "$COST > 5" | bc -l) )); then
  echo "WARNING: Costs exceeded $5!" | mail -s "Azure Cost Alert" your-email@example.com
fi
```

---

## Summary: Staying on Free Tier

### ✅ What's Free Forever
- Azure Computer Vision F0: 5,000 transactions/month
- Azure Static Web Apps Free tier: 100GB bandwidth/month
- Azure Active Directory: Basic features

### ⚠️ What to Watch
- Computer Vision S1 auto-upgrade (prevent by monitoring usage)
- Static Web Apps bandwidth overage (rare for MVP)
- Any resources created outside free tier

### 🚫 What to Avoid
- Creating resources without checking pricing tier
- Enabling auto-scaling (can cause unexpected costs)
- Creating VMs, databases in Azure (use Raspberry Pi instead)
- Enabling premium features (Traffic Manager, CDN, etc.)

### 📊 Monthly Checklist
- [ ] Check Cost Analysis dashboard (should be $0.00)
- [ ] Verify Computer Vision usage < 5,000 calls
- [ ] Verify Static Web Apps bandwidth < 100GB
- [ ] Review budget alerts (should have none)
- [ ] Check for unused resources (delete if found)

---

## Quick Reference: Azure Resources for PicAI

| Resource | Purpose | Tier | Monthly Cost | Limits |
|----------|---------|------|--------------|--------|
| **Computer Vision** | AI photo tagging | F0 (Free) | $0 | 5,000 calls, 20/min |
| **Static Web Apps** | Frontend hosting | Free | $0 | 100GB bandwidth |
| **Storage** (optional) | Photo backup | Not needed | N/A | Use Pi storage |

**Total Azure Cost for MVP:** **$0/month** ✅

---

## Next Steps

1. ✅ Create Azure account
2. ✅ Set up budget and alerts
3. ✅ Create Computer Vision resource (F0 tier)
4. ✅ Create Static Web Apps resource (Free tier)
5. ✅ Configure environment variables
6. ✅ Test API connections
7. ✅ Monitor daily for first week
8. ✅ Review monthly costs

**You're ready to build PicAI with zero Azure costs!** 🎉

---

**Document Last Updated:** November 15, 2025