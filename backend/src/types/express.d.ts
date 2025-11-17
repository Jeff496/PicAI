// src/types/express.d.ts
// TypeScript declaration file to extend Express Request interface
// Adds user property for authenticated requests

import type { UserModel } from '../generated/prisma/models.js';

declare global {
  namespace Express {
    interface Request {
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
