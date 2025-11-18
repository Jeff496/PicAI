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

// Environment variables (validated with Zod)
import { env } from './config/env.js';

// Routes - API endpoint handlers
import authRoutes from './routes/auth.routes.js';

// Middleware - Error handlers and utilities
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

// Logger - Winston logging
import logger from './utils/logger.js';

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
 * "It's okay, I allow https://picai-frontend.azurestaticapps.net to call me"
 *
 * **How it works:**
 * Browser sends "preflight" OPTIONS request first
 * Server responds with allowed origins, methods, headers
 * If allowed, browser sends actual request
 *
 * **Configuration:**
 * - origin: FRONTEND_URL from .env (e.g., http://localhost:5173 in dev)
 * - credentials: true (allows cookies/auth headers)
 * - optionsSuccessStatus: 200 (some browsers need this)
 */
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true, // Allow cookies and Authorization header
    optionsSuccessStatus: 200, // For legacy browsers
  })
);

/**
 * 3.2 JSON Body Parser
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
 * 3.3 URL-Encoded Parser
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
 * A simple endpoint that returns "I'm alive and working"
 *
 * **Why do we need it?**
 * - Monitoring tools (PM2, Kubernetes) ping this to check if server is up
 * - Load balancers use this to know if they should send traffic here
 * - CI/CD pipelines verify deployment succeeded
 * - Quick manual test: curl http://localhost:3001/health
 *
 * **What should it check?**
 * Basic version: Just return 200 OK
 * Advanced version: Check database, external APIs, disk space
 *
 * **Placement:**
 * Before authentication - should work even if auth is broken
 */
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'PicAI Backend is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    // Future: Add database health check
    // database: await checkDatabaseConnection(),
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

  app.listen(PORT, () => {
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
