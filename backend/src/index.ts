// src/index.ts
// Express server entry point for PicAI backend
// Configures middleware, routes, and starts the HTTP server

/**
 * ========================================
 * STEP 1: IMPORTS
 * ========================================
 */

// Express framework - the foundation of our API server
import express from 'express';

// CORS - Cross-Origin Resource Sharing
// Allows frontend (running on different domain) to call our API
import cors from 'cors';

// Crypto for generating request IDs
import { randomUUID } from 'crypto';

// Environment variables (validated with Zod)
import { env } from './config/env.js';

// Routes - API endpoint handlers
import authRoutes from './routes/auth.routes.js';

// Middleware - Error handlers and utilities
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

// Logger - Winston logging
import logger from './utils/logger.js';

// Prisma client for graceful shutdown
import prisma from './prisma/client.js';

/**
 * ========================================
 * STEP 2: CREATE EXPRESS APP
 * ========================================
 *
 * What is an Express app?
 * - An object that represents your web server
 * - You add middleware and routes to it
 * - Then you tell it to "listen" on a port
 */
const app = express();

/**
 * ========================================
 * STEP 3: CONFIGURE MIDDLEWARE
 * ========================================
 *
 * Middleware = functions that run BEFORE your route handlers
 * They can:
 * - Modify the request/response
 * - End the request early
 * - Pass control to the next middleware
 *
 * Order matters! Middleware executes top to bottom.
 */

/**
 * 3.1 CORS Middleware
 *
 * **What is CORS?**
 * Cross-Origin Resource Sharing - browser security feature
 *
 * **The Problem:**
 * - Frontend: https://picai-frontend.azurestaticapps.net
 * - Backend:  https://piclyai.net/api
 * - Different domains = browser blocks requests by default
 *
 * **The Solution:**
 * CORS middleware tells the browser:
 * "It's okay, I allow these specific origins to call me"
 *
 * **How it works:**
 * Browser sends "preflight" OPTIONS request first
 * Server responds with allowed origins, methods, headers
 * If allowed, browser sends actual request
 *
 * **Configuration:**
 * - origin: Function that validates allowed origins
 * - credentials: true (allows cookies/auth headers)
 * - optionsSuccessStatus: 200 (some browsers need this)
 */

// Define allowed origins based on environment
const allowedOrigins = [
  env.FRONTEND_URL, // Production frontend
  'http://localhost:5173', // Vite dev server
  'http://localhost:4173', // Vite preview
  'http://localhost:3000', // Alternative dev port
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS request blocked from unauthorized origin', { origin });
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true, // Allow cookies and Authorization header
    optionsSuccessStatus: 200, // For legacy browsers
  })
);

/**
 * 3.2 Request ID Middleware
 *
 * **What does this do?**
 * Generates a unique ID for each request to enable request tracing
 *
 * **Why is this important?**
 * - Correlate log entries across the request lifecycle
 * - Debug issues in production with concurrent users
 * - Track requests through distributed systems
 *
 * **How it works:**
 * - Generates UUID for each request
 * - Attaches to req.id for use in controllers/services
 * - Returns in X-Request-ID response header
 * - Can be sent by client in X-Request-ID header (for client-initiated tracing)
 */
app.use((req, res, next) => {
  // Use client-provided request ID if available, otherwise generate new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log incoming request with request ID
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  next();
});

/**
 * 3.3 JSON Body Parser
 *
 * **What does this do?**
 * Parses incoming JSON request bodies and makes them available in req.body
 *
 * **Example:**
 * Client sends: { "email": "test@example.com", "password": "pass123" }
 * Without this: req.body is undefined
 * With this: req.body = { email: "test@example.com", password: "pass123" }
 *
 * **Why needed?**
 * HTTP requests are just strings (text)
 * This middleware converts JSON string → JavaScript object
 *
 * **Limit:**
 * 10mb max request size (prevents abuse)
 * Adjust if you need to accept larger payloads
 */
app.use(express.json({ limit: '10mb' }));

/**
 * 3.4 URL-Encoded Parser
 *
 * **What does this do?**
 * Parses form data (application/x-www-form-urlencoded)
 *
 * **When is this used?**
 * HTML forms that POST data (not JSON)
 * Some OAuth callbacks use this format
 *
 * **Extended: true means:**
 * Can parse complex objects, not just simple key-value pairs
 *
 * **Example:**
 * Form data: email=test@example.com&password=pass123
 * Becomes: { email: "test@example.com", password: "pass123" }
 */
app.use(express.urlencoded({ extended: true }));

/**
 * ========================================
 * STEP 4: HEALTH CHECK ENDPOINT
 * ========================================
 *
 * **What is a health check?**
 * An endpoint that verifies the server and its dependencies are functioning
 *
 * **Why do we need it?**
 * - Monitoring tools (PM2, Kubernetes) ping this to check if server is up
 * - Load balancers use this to know if they should send traffic here
 * - CI/CD pipelines verify deployment succeeded
 * - Quick manual test: curl http://localhost:3001/health
 *
 * **What does it check?**
 * - Database connectivity (critical)
 * - Server uptime
 * - Environment configuration
 *
 * **Response codes:**
 * - 200: All checks passed (healthy)
 * - 503: One or more checks failed (degraded/unhealthy)
 *
 * **Placement:**
 * Before authentication - should work even if auth is broken
 */
app.get('/health', async (_req, res) => {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    environment: string;
    checks: {
      database: 'ok' | 'error';
    };
    details?: {
      database?: string;
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    checks: {
      database: 'ok',
    },
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = 'ok';
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = 'error';
    health.details = {
      database: error instanceof Error ? error.message : 'Unknown error',
    };
    logger.error('Health check: Database connection failed', { error });
  }

  // Determine overall status
  const hasErrors = Object.values(health.checks).some((check) => check === 'error');
  if (hasErrors) {
    health.status = 'degraded';
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    success: health.status === 'healthy',
    ...health,
  });
});

/**
 * ========================================
 * STEP 5: API ROUTES
 * ========================================
 *
 * **Route Mounting:**
 * app.use('/path', router) - mounts a router at a specific path
 *
 * **Why /api prefix?**
 * - Clear separation: /api/* = backend, /* = frontend (on same domain)
 * - Easier reverse proxy config (Nginx, Cloudflare)
 * - API versioning possibility: /api/v1, /api/v2
 *
 * **Auth Routes:**
 * Mounted at /api/auth means:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - POST /api/auth/refresh
 * - POST /api/auth/logout
 * - GET  /api/auth/me
 *
 * **Future Routes:**
 * app.use('/api/photos', photoRoutes);  // Photo upload/management
 * app.use('/api/albums', albumRoutes);  // Album creation/sharing
 * app.use('/api/groups', groupRoutes);  // Group management
 * app.use('/api/users', userRoutes);    // User profile management
 */
app.use('/api/auth', authRoutes);

// Placeholder for future routes
// app.use('/api/photos', photoRoutes);
// app.use('/api/albums', albumRoutes);
// app.use('/api/groups', groupRoutes);
// app.use('/api/users', userRoutes);

/**
 * ========================================
 * STEP 6: ERROR HANDLING MIDDLEWARE
 * ========================================
 *
 * **Critical Order:**
 * These MUST be the last middleware added
 * Why? They catch everything that falls through from above
 */

/**
 * 6.1 404 Not Found Handler
 *
 * **When does this run?**
 * If no route above matched the request
 *
 * **Example:**
 * GET /api/nonexistent → 404 Not Found
 * POST /api/auth/typo → 404 Not Found
 *
 * **Why before error handler?**
 * 404 is not an error, it's "route not found"
 * Error handler is for actual errors (exceptions, crashes)
 */
app.use(notFoundHandler);

/**
 * 6.2 Global Error Handler
 *
 * **When does this run?**
 * - Errors thrown in route handlers
 * - Promise rejections (Express 5 auto-catches)
 * - next(error) calls
 *
 * **Why LAST?**
 * Must be after all routes and other middleware
 * It's the "catch-all" for anything that went wrong
 *
 * **Example:**
 * Database connection fails → Error handler returns 500
 * Validation fails → Error handler returns 400
 * User not found → Error handler returns 404
 */
app.use(errorHandler);

/**
 * ========================================
 * STEP 7: START SERVER
 * ========================================
 *
 * **What is app.listen()?**
 * Starts the HTTP server and binds it to a port
 *
 * **Port:**
 * env.PORT from .env file (default: 3001)
 * Why not hardcode? Different environments use different ports
 * - Development: 3001
 * - Production: 80 or 443 (behind reverse proxy)
 * - Testing: Random available port
 *
 * **Only start if this is the main module:**
 * import.meta.url checks if this file was directly executed
 * Why? When running tests, we don't want to start the server
 * Tests will import `app` and use supertest instead
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = env.PORT;

  const server = app.listen(PORT, () => {
    logger.info('==============================================');
    logger.info('🚀 PicAI Backend Server Started');
    logger.info('==============================================');
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Port: ${PORT}`);
    logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
    logger.info(`Health Check: http://localhost:${PORT}/health`);
    logger.info(`API Base: http://localhost:${PORT}/api`);
    logger.info('==============================================');
    logger.info('Available Routes:');
    logger.info('  POST   /api/auth/register');
    logger.info('  POST   /api/auth/login');
    logger.info('  POST   /api/auth/refresh');
    logger.info('  POST   /api/auth/logout');
    logger.info('  GET    /api/auth/me');
    logger.info('==============================================');
  });

  /**
   * ========================================
   * GRACEFUL SHUTDOWN HANDLERS
   * ========================================
   *
   * Handle SIGTERM and SIGINT signals to gracefully shutdown the server.
   * This ensures:
   * - In-flight requests complete before shutdown
   * - Database connections close cleanly
   * - No data corruption or connection leaks
   *
   * Process managers like PM2, Docker, and Kubernetes send SIGTERM
   * when stopping containers/processes.
   */

  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} signal received: closing HTTP server`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connections
        await prisma.$disconnect();
        logger.info('Database connections closed');

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds if graceful shutdown fails
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle SIGTERM (from Docker, Kubernetes, PM2)
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle SIGINT (Ctrl+C in terminal)
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    gracefulShutdown('unhandledRejection');
  });
}

/**
 * ========================================
 * STEP 8: EXPORT APP
 * ========================================
 *
 * **Why export the app?**
 * For testing! Tests can import the app and make requests
 * without actually starting the server on a port
 *
 * **Example Test:**
 * ```typescript
 * import request from 'supertest';
 * import app from './index.js';
 *
 * test('health check works', async () => {
 *   const response = await request(app).get('/health');
 *   expect(response.status).toBe(200);
 * });
 * ```
 *
 * **Default export vs Named export:**
 * default export = import app from './index.js'
 * named export = import { app } from './index.js'
 * Default is cleaner for single export
 */
export default app;
