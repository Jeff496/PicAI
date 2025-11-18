# Logging Guide - Winston Logger

This guide explains how to use the Winston logger in the PicAI backend.

## Overview

The logger is configured with:
- **4 log levels**: error, warn, info, debug
- **Console output**: Color-coded logs in development
- **File output**: Two daily rotating log files
  - `logs/error-YYYY-MM-DD.log` - Error logs only
  - `logs/combined-YYYY-MM-DD.log` - All logs
- **Automatic rotation**: New file created each day, old files kept for 14 days

## Basic Usage

```typescript
import logger from './utils/logger.js';

// Error - Critical issues (database failures, exceptions)
logger.error('Database connection failed', {
  error: err.message,
  host: 'localhost'
});

// Warn - Potential issues (rate limits, deprecations)
logger.warn('API rate limit approaching', {
  current: 950,
  limit: 1000
});

// Info - General information (user actions, API calls)
logger.info('User logged in', {
  userId: user.id,
  email: user.email
});

// Debug - Detailed debugging (only in development)
logger.debug('Processing request', {
  body: req.body,
  headers: req.headers
});
```

## When to Use Each Level

### ERROR (0) - Highest Priority
Use for:
- Database connection failures
- Unhandled exceptions
- External API failures
- File system errors
- Critical security issues

**Example:**
```typescript
try {
  await prisma.user.create({ data: userData });
} catch (error) {
  logger.error('Failed to create user', { error, userData });
  throw error;
}
```

### WARN (1)
Use for:
- Approaching rate limits
- Deprecated API usage
- Invalid but recoverable input
- Performance degradation
- Missing optional configuration

**Example:**
```typescript
if (remainingRequests < 100) {
  logger.warn('Azure API rate limit approaching', {
    remaining: remainingRequests,
    limit: 5000,
    userId: user.id
  });
}
```

### INFO (2)
Use for:
- User authentication events
- Photo uploads/downloads
- API requests (in production)
- Scheduled job execution
- Configuration changes

**Example:**
```typescript
logger.info('Photo uploaded successfully', {
  photoId: photo.id,
  userId: user.id,
  filename: photo.filename,
  size: photo.fileSize
});
```

### DEBUG (3) - Lowest Priority
Use for:
- Request/response payloads
- Internal function calls
- Variable state inspection
- Algorithm step-by-step execution

**Example:**
```typescript
logger.debug('Analyzing photo with Azure Vision', {
  photoId: photo.id,
  endpoint: azureEndpoint,
  features: ['tags', 'objects', 'caption']
});
```

**Note:** Debug logs are only shown in `NODE_ENV=development`. They're automatically disabled in production.

## Advanced Features

### 1. Including Error Stack Traces

Winston automatically includes stack traces for Error objects:

```typescript
try {
  await riskyOperation();
} catch (error) {
  // Stack trace will be included automatically
  logger.error('Operation failed', { error });
}
```

### 2. Printf-Style Formatting

Use `%s` for strings, `%d` for numbers:

```typescript
logger.info('User %s uploaded %d photos', user.email, photoCount);
// Output: User john@example.com uploaded 25 photos
```

### 3. Structured Metadata

Always include context with your logs:

```typescript
logger.error('Payment processing failed', {
  userId: user.id,
  amount: 99.99,
  currency: 'USD',
  paymentMethod: 'stripe',
  errorCode: error.code,
  errorMessage: error.message
});
```

This creates searchable JSON logs:
```json
{
  "level": "error",
  "message": "Payment processing failed",
  "timestamp": "2025-11-17 17:24:47",
  "userId": "user-123",
  "amount": 99.99,
  "currency": "USD",
  "paymentMethod": "stripe",
  "errorCode": "card_declined",
  "errorMessage": "Insufficient funds"
}
```

## Integration with Express

### Option 1: Manual Logging in Controllers

```typescript
// src/controllers/photos.controller.ts
import logger from '../utils/logger.js';

export const uploadPhoto = asyncHandler(async (req, res) => {
  logger.info('Photo upload started', {
    userId: req.user.id,
    filename: req.file.originalname
  });

  try {
    const photo = await photoService.upload(req.file);

    logger.info('Photo upload completed', {
      photoId: photo.id,
      userId: req.user.id,
      size: photo.fileSize
    });

    res.json({ success: true, data: photo });
  } catch (error) {
    logger.error('Photo upload failed', {
      userId: req.user.id,
      filename: req.file.originalname,
      error
    });
    throw error;
  }
});
```

### Option 2: HTTP Request Logging with Morgan (Future)

When you add Morgan for HTTP request logging:

```typescript
// src/index.ts
import morgan from 'morgan';
import logger, { morganStream } from './utils/logger.js';

// Log all HTTP requests at 'info' level
app.use(morgan('combined', { stream: morganStream }));
```

This will log all HTTP requests like:
```
2025-11-17 17:24:47 [INFO]: ::1 - - [17/Nov/2025:17:24:47 +0000] "POST /auth/login HTTP/1.1" 200 456
```

## Environment-Based Behavior

### Development (`NODE_ENV=development`)
- **Log Level**: `debug` (shows everything)
- **Console**: Enabled with colors
- **Files**: Both error.log and combined.log

### Production (`NODE_ENV=production`)
- **Log Level**: `info` (hides debug messages)
- **Console**: Disabled (files only)
- **Files**: Both error.log and combined.log

### Test (`NODE_ENV=test`)
- **Log Level**: `warn` (only warnings and errors)
- **Console**: Disabled (keeps test output clean)
- **Files**: Both error.log and combined.log

## Log File Management

### Automatic Rotation

Logs rotate daily at midnight:
- `combined-2025-11-17.log` → Created on Nov 17
- `combined-2025-11-18.log` → Created on Nov 18
- etc.

### Automatic Cleanup

Old logs are automatically deleted after 14 days:
- Keeps last 14 days of history
- Prevents disk space issues
- Configurable in `logger.ts` (`maxFiles: '14d'`)

### Manual Cleanup

To manually clean up logs:

```bash
# Delete all logs
rm logs/*.log

# Delete logs older than 7 days
find logs/ -name "*.log" -mtime +7 -delete

# View log file sizes
du -h logs/
```

## Best Practices

### ✅ DO

1. **Include context** - Always add relevant metadata
   ```typescript
   logger.error('Auth failed', { userId, email, reason });
   ```

2. **Log at appropriate levels** - Don't use `error` for warnings
   ```typescript
   logger.warn('Slow query detected', { duration: 5000, query });
   ```

3. **Use structured data** - Objects, not strings
   ```typescript
   logger.info('Upload complete', { photoId, userId, size });
   ```

4. **Sanitize sensitive data** - Never log passwords or tokens
   ```typescript
   logger.info('User login', {
     email: user.email,
     // password: req.body.password // ❌ NEVER!
   });
   ```

### ❌ DON'T

1. **Don't log inside tight loops** - Performance impact
   ```typescript
   // ❌ BAD
   for (let i = 0; i < 10000; i++) {
     logger.debug('Processing item', { i });
   }

   // ✅ GOOD
   logger.debug('Processing started', { count: 10000 });
   ```

2. **Don't log large objects** - Massive log files
   ```typescript
   // ❌ BAD
   logger.info('Request received', { body: hugeObject });

   // ✅ GOOD
   logger.info('Request received', {
     itemCount: hugeObject.items.length,
     size: hugeObject.size
   });
   ```

3. **Don't use console.log** - Use logger instead
   ```typescript
   // ❌ BAD
   console.log('User logged in');

   // ✅ GOOD
   logger.info('User logged in', { userId: user.id });
   ```

## Testing

Run the logger test:

```bash
npx tsx tests/test-logger.ts
```

Check the generated log files:

```bash
cat logs/combined-$(date +%Y-%m-%d).log | jq '.'
cat logs/error-$(date +%Y-%m-%d).log | jq '.'
```

## Troubleshooting

### Logs not appearing in console

Check your `NODE_ENV`:
```bash
echo $NODE_ENV
# If "test", console logging is disabled
```

### Log files not created

1. Ensure `logs/` directory exists:
   ```bash
   mkdir -p logs
   ```

2. Check file permissions:
   ```bash
   ls -la logs/
   ```

### Logs filling up disk space

1. Check current log sizes:
   ```bash
   du -h logs/
   ```

2. Reduce retention period in `logger.ts`:
   ```typescript
   maxFiles: '7d', // Change from 14d to 7d
   ```

3. Add size limits:
   ```typescript
   maxSize: '20m', // Max 20MB per file
   maxFiles: '14d'
   ```

## Future Enhancements

Consider adding:
- Log aggregation service (ELK Stack, Datadog, CloudWatch)
- Error monitoring (Sentry, Rollbar)
- Structured query language for log analysis
- Real-time log streaming for debugging
- Alert notifications for critical errors

---

**Last Updated:** November 17, 2025
**Winston Version:** 3.18.3
**Daily Rotate File Version:** Installed with logger setup
