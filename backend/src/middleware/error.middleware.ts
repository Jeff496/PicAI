// src/middleware/error.middleware.ts
// Global error handler for Express application
// Catches all errors and returns consistent JSON responses

import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Global Error Handler Middleware
 *
 * **CRITICAL:** Must have exactly 4 parameters (err, req, res, next)
 * Express 5 requires this signature to recognize it as an error handler
 *
 * **What this does:**
 * 1. Logs the error with Winston (file + console)
 * 2. Determines HTTP status code (default: 500)
 * 3. Returns consistent JSON error response
 * 4. Includes stack trace in development only (security!)
 *
 * **Where errors come from:**
 * - Thrown errors in route handlers
 * - Promise rejections in async functions (Express 5 auto-catches)
 * - next(error) calls from other middleware
 * - Database errors from Prisma
 * - Validation errors from Zod
 *
 * **Why 4 parameters?**
 * Express identifies error handlers by their function signature.
 * If you only have (err, req, res), Express won't recognize it!
 *
 * @param err - The error object (from throw, reject, or next(err))
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (required but unused)
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction // Required for Express to recognize this as error handler
): void => {
  /**
   * Step 1: Log the error
   *
   * Why log here?
   * - Centralized logging for all errors
   * - Includes request context (method, URL, user)
   * - Makes debugging production issues possible
   */

  // SECURITY: Sanitize sensitive data before logging
  // Never log passwords, tokens, or other credentials
  const sanitizedBody = { ...req.body };
  const sensitiveFields = ['password', 'passwordHash', 'refreshToken', 'accessToken', 'token'];

  for (const field of sensitiveFields) {
    if (sanitizedBody[field]) {
      sanitizedBody[field] = '[REDACTED]';
    }
  }

  logger.error('Unhandled error in request', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    userId: req.user?.id, // If user is authenticated
    body: sanitizedBody, // Sanitized to prevent password leaks
  });

  /**
   * Step 2: Determine HTTP Status Code
   *
   * Different errors should return different status codes:
   * - 400: Bad request (validation errors)
   * - 401: Unauthorized (auth errors)
   * - 404: Not found
   * - 500: Server error (default)
   *
   * Some errors might have a statusCode property attached
   * (e.g., from custom error classes or libraries)
   */
  const statusCode = (err as any).statusCode || 500;

  /**
   * Step 3: Build Error Response
   *
   * Production vs Development differences:
   * - Production: Hide implementation details (security!)
   * - Development: Show full error details (debugging!)
   */
  const errorResponse = {
    success: false,
    error: err.message || 'Internal server error',
    code: (err as any).code || 'INTERNAL_ERROR',

    // Only include stack trace in development
    // Why? Stack traces reveal:
    // - File paths (shows server structure)
    // - Code snippets (shows implementation)
    // - Library versions (helps attackers find vulnerabilities)
    ...(env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: (err as any).details, // Validation error details from Zod
    }),
  };

  /**
   * Step 4: Send Response
   *
   * Why void return type?
   * - TypeScript requires consistency
   * - Error handlers don't return values
   * - They send responses and end the request cycle
   */
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found Handler
 *
 * **What this does:**
 * Catches all requests that don't match any route
 * Returns a consistent 404 response instead of default HTML
 *
 * **When is this called?**
 * - User requests /api/nonexistent
 * - Typo in API endpoint
 * - Route was removed but client still calls it
 *
 * **Why separate from error handler?**
 * - 404 is not an error, it's "route not found"
 * - Allows custom 404 messages
 * - Can track 404s separately in analytics
 *
 * **Placement in middleware chain:**
 * Must be AFTER all route handlers but BEFORE error handler
 *
 * @example
 * ```typescript
 * app.use('/api/auth', authRoutes);
 * app.use('/api/photos', photoRoutes);
 * app.use(notFoundHandler); // ← Catches everything else
 * app.use(errorHandler);    // ← Catches errors from above
 * ```
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('404 Not Found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.url}`,
    code: 'NOT_FOUND',
  });
};

/**
 * Usage Example in Express App:
 *
 * ```typescript
 * import express from 'express';
 * import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
 *
 * const app = express();
 *
 * // ... all your routes ...
 * app.use('/api/auth', authRoutes);
 *
 * // 404 handler - MUST be after all routes
 * app.use(notFoundHandler);
 *
 * // Error handler - MUST be LAST
 * app.use(errorHandler);
 * ```
 *
 * Order matters!
 * 1. Routes
 * 2. 404 handler (catches unmatched routes)
 * 3. Error handler (catches all errors)
 */
