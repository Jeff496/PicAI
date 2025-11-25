// src/types/express.d.ts
// TypeScript declaration file to extend Express Request interface
// Adds custom properties for authenticated requests and request tracing

import type { UserModel } from '../generated/prisma/models.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Unique request ID for tracing
       *
       * Populated by request ID middleware for every request.
       * Used for correlating logs and debugging production issues.
       *
       * @example
       * ```typescript
       * logger.info('Processing request', { requestId: req.id });
       * ```
       */
      id?: string;

      /**
       * Authenticated user object
       *
       * Populated by authentication middleware after JWT verification.
       * Will be undefined on unauthenticated requests.
       *
       * @example
       * ```typescript
       * app.get('/profile', authenticateJWT, (req, res) => {
       *   if (!req.user) {
       *     return res.status(401).json({ error: 'Unauthorized' });
       *   }
       *   res.json({ user: req.user });
       * });
       * ```
       */
      user?: UserModel;

      /**
       * Parsed and transformed query parameters
       *
       * Populated by validateQuery middleware after Zod validation.
       * Contains transformed values (e.g., strings converted to numbers).
       * Use this instead of req.query when validateQuery middleware is applied.
       *
       * @example
       * ```typescript
       * // In route with validateQuery(schema) middleware:
       * const { limit, offset } = req.parsedQuery as GetPhotosQuery;
       * ```
       */
      parsedQuery?: Record<string, unknown>;
    }
  }
}
