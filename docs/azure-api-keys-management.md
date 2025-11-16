# Azure API Keys Management Guide

How to properly use and manage your two Azure Computer Vision API keys.

---

## Why Two Keys?

Azure provides **two keys** for each service:

- **KEY 1 (Primary)**: Main key for everyday use
- **KEY 2 (Secondary)**: Backup key for:
  - Key rotation (security best practice)
  - Fallback if primary is rate-limited
  - Zero-downtime key updates

---

## Recommended Setup for PicAI MVP

### Option 1: Single Key (Simplest - Recommended for MVP)

**Use this for MVP:**

```bash
# .env
AZURE_VISION_KEY=your-key-1-here
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
```

**Pros:**
- ✅ Simplest setup
- ✅ Easier to debug
- ✅ Sufficient for MVP

**Cons:**
- ❌ No automatic fallback
- ❌ Manual key rotation required

**When to upgrade:** Post-MVP when you have real users

---

### Option 2: Dual Keys with Fallback (Production-Ready)

**Use this for production or if you want to learn best practices:**

```bash
# .env
AZURE_VISION_KEY_PRIMARY=your-key-1-here
AZURE_VISION_KEY_SECONDARY=your-key-2-here
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
```

**Implementation:**

```typescript
// src/config/env.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // ... other env vars
  AZURE_VISION_KEY_PRIMARY: z.string().min(32),
  AZURE_VISION_KEY_SECONDARY: z.string().min(32).optional(),
  AZURE_VISION_ENDPOINT: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

```typescript
// src/services/aiService.ts
import axios, { AxiosError } from 'axios';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

class AIService {
  private currentKey: 'primary' | 'secondary' = 'primary';

  private getApiKey(): string {
    if (this.currentKey === 'primary') {
      return env.AZURE_VISION_KEY_PRIMARY;
    }
    return env.AZURE_VISION_KEY_SECONDARY || env.AZURE_VISION_KEY_PRIMARY;
  }

  async analyzePhoto(photoId: string) {
    try {
      return await this.callVisionAPI(photoId, this.getApiKey());
    } catch (error) {
      // If rate limited or key error, try secondary key
      if (this.shouldFallbackToSecondary(error)) {
        logger.warn('Primary key failed, falling back to secondary key');
        this.currentKey = 'secondary';
        return await this.callVisionAPI(photoId, this.getApiKey());
      }
      throw error;
    }
  }

  private shouldFallbackToSecondary(error: any): boolean {
    if (!env.AZURE_VISION_KEY_SECONDARY) return false;
    
    const axiosError = error as AxiosError;
    
    // Rate limit (429) or auth errors (401, 403)
    return axiosError.response?.status === 429 || 
           axiosError.response?.status === 401 ||
           axiosError.response?.status === 403;
  }

  private async callVisionAPI(photoId: string, apiKey: string) {
    const response = await axios.post(
      `${env.AZURE_VISION_ENDPOINT}/vision/v3.2/analyze`,
      imageBuffer,
      {
        params: {
          visualFeatures: 'Categories,Tags,Description,Objects,Faces,Color',
        },
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/octet-stream'
        }
      }
    );
    
    return response.data;
  }
}

export const aiService = new AIService();
```

**Pros:**
- ✅ Automatic fallback on rate limits
- ✅ Higher effective rate limit (20/min × 2 = 40/min)
- ✅ Zero-downtime key rotation
- ✅ Production-ready

**Cons:**
- ❌ More complex
- ❌ Need to manage two keys

---

## Key Rotation Strategy (Post-MVP)

**When to rotate:** Every 90 days or if key is compromised

### Step-by-Step Rotation (Zero Downtime)

1. **Regenerate KEY 2** in Azure Portal
2. **Update `.env` with new KEY 2**
3. **Restart backend**
   ```bash
   pm2 restart picai-backend
   ```
4. **Wait 24 hours** (ensure no issues)
5. **Regenerate KEY 1** in Azure Portal
6. **Update `.env` with new KEY 1**
7. **Restart backend again**

With dual-key setup, you can rotate without any downtime.

---

## Rate Limiting Considerations

### Free Tier Limits (F0)
- **Total calls:** 5,000/month
- **Rate:** 20 calls/minute

### With Two Keys?
**Important:** Both keys share the same quota!

- ❌ **Doesn't give you** 10,000/month
- ✅ **Does give you** fallback if one fails
- ✅ **Could theoretically** alternate keys for 40/min (but not recommended)

### Recommendation:
Use single key for MVP. Add second key only for:
1. Production resilience
2. Key rotation
3. Security best practices

---

## Security Best Practices

### 1. Never Commit Keys to Git

```bash
# .gitignore should have:
.env
.env.local
.env.production
```

### 2. Use Environment Variables

```typescript
// ❌ BAD
const apiKey = 'abc123...'; 

// ✅ GOOD
import { env } from './config/env.js';
const apiKey = env.AZURE_VISION_KEY;
```

### 3. Validate Keys on Startup

```typescript
// src/config/env.ts
const envSchema = z.object({
  AZURE_VISION_KEY: z.string()
    .min(32, 'API key must be at least 32 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'API key contains invalid characters'),
});
```

### 4. Monitor Key Usage

Set up Azure alerts:
- Alert at 4,000 calls/month (80% of quota)
- Alert at 4,500 calls/month (90% of quota)

### 5. Rotate Keys Regularly

- Rotate every 90 days (calendar reminder)
- Rotate immediately if:
  - Key accidentally committed to git
  - Team member leaves
  - Suspicious activity detected

---

## Monitoring API Key Usage

### Azure Portal Dashboard

1. Go to your Computer Vision resource
2. Click **Metrics**
3. Add metric: **Total Calls**
4. Filter by time range (last 30 days)

### Create Usage Alert

1. Go to **Alerts** → **New alert rule**
2. Condition: Total Calls > 4,000
3. Action: Email notification
4. Create alert

### Log Usage in Code

```typescript
// src/services/aiService.ts
class AIService {
  private callCount = 0;

  async analyzePhoto(photoId: string) {
    this.callCount++;
    
    if (this.callCount % 100 === 0) {
      logger.info(`Azure Vision API calls: ${this.callCount} this session`);
    }

    // ... rest of code
  }
}
```

---

## Testing API Keys

### Quick Test (from terminal)

```bash
# Test KEY 1
curl -X POST "YOUR_ENDPOINT/vision/v3.2/analyze?visualFeatures=Tags" \
  -H "Ocp-Apim-Subscription-Key: YOUR_KEY_1" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://upload.wikimedia.org/wikipedia/commons/1/12/ThreeTimeAKCGoldWinnerPembrookeWelshCorgi.jpg"}'

# Should return JSON with tags

# Test KEY 2 (same command, different key)
curl -X POST "YOUR_ENDPOINT/vision/v3.2/analyze?visualFeatures=Tags" \
  -H "Ocp-Apim-Subscription-Key: YOUR_KEY_2" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://upload.wikimedia.org/wikipedia/commons/1/12/ThreeTimeAKCGoldWinnerPembrookeWelshCorgi.jpg"}'
```

### Expected Response

```json
{
  "tags": [
    { "name": "dog", "confidence": 0.98 },
    { "name": "animal", "confidence": 0.95 },
    { "name": "corgi", "confidence": 0.89 }
  ],
  "requestId": "abc-123",
  "metadata": { "width": 1200, "height": 800 }
}
```

### Error Responses

**Invalid Key (401):**
```json
{
  "error": {
    "code": "Unauthorized",
    "message": "Access denied due to invalid subscription key"
  }
}
```

**Rate Limited (429):**
```json
{
  "error": {
    "code": "429",
    "message": "Rate limit exceeded. Retry after some time."
  }
}
```

---

## My Recommendation for PicAI

### For MVP (Now):
```bash
# .env - Just use KEY 1
AZURE_VISION_KEY=your-key-1-here
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
```

Store KEY 2 somewhere safe (password manager) for future use.

### For Production (Later):
Implement dual-key setup with automatic fallback (Option 2 above).

---

## Quick Decision Matrix

| Use Case | Recommendation |
|----------|---------------|
| MVP development | Single key (KEY 1) ✅ |
| Learning best practices | Dual keys with fallback |
| < 100 users | Single key |
| 100+ users | Dual keys with fallback ✅ |
| Security compliance required | Dual keys + 90-day rotation ✅ |
| Just want it working | Single key ✅ |

---

## What to Do Right Now

1. **Store both keys safely**
   - Add to password manager
   - Never share in Slack/email

2. **Use KEY 1 in .env**
   ```bash
   AZURE_VISION_KEY=your-key-1-here
   ```

3. **Test KEY 1**
   ```bash
   curl test from above
   ```

4. **Set usage alert**
   - Alert at 4,000/5,000 calls

5. **Schedule key rotation**
   - Calendar reminder for 90 days

---

## Summary

- ✅ **Use KEY 1 for MVP** - simplest and sufficient
- 📝 **Save KEY 2** - you'll need it for rotation
- 🔄 **Rotate every 90 days** - security best practice
- 📊 **Monitor usage** - set up Azure alerts
- 🚨 **Never commit keys** - use .env + .gitignore

**Bottom line:** Start simple with one key, add fallback logic post-MVP when you have real users to protect.