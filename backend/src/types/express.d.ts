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
    }
  }
}
