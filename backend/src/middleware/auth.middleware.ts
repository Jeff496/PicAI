// src/middleware/auth.middleware.ts
// JWT authentication middleware using jose for token verification
// Verifies JWT tokens and attaches user to request object

import type { Request, Response, NextFunction } from 'express';
import {
  authService,
  TokenExpiredError,
  TokenInvalidError,
  TokenMalformedError,
} from '../services/authService.js';
import prisma from '../prisma/client.js';

/**
 * Authentication middleware for JWT verification
 *
 * Workflow:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies token using jose (via authService)
 * 3. Looks up user in database
 * 4. Attaches user object to req.user
 * 5. Returns 401 for invalid/missing tokens or non-existent users
 *
 * @example
 * ```typescript
 * // Protect a route
 * app.get('/api/photos', authenticateJWT, async (req, res) => {
 *   // req.user is guaranteed to exist here
 *   const photos = await prisma.photo.findMany({
 *     where: { userId: req.user.id }
 *   });
 *   res.json({ success: true, data: photos });
 * });
 * ```
 *
 * Error Responses:
 * - 401 NO_TOKEN: No Authorization header or invalid format
 * - 401 TOKEN_EXPIRED: Token has expired
 * - 401 INVALID_TOKEN: Token is invalid or malformed
 * - 401 USER_NOT_FOUND: Token is valid but user doesn't exist
 */
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Extract Authorization header
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists and starts with "Bearer "
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_TOKEN',
    });
    return;
  }

  // Extract token (remove "Bearer " prefix)
  const token = authHeader.substring(7);

  try {
    // Verify token using jose (via authService)
    // This validates signature, expiration, and token structure
    // Throws custom error types for better error handling
    // Returns decoded payload with token type
    const decoded = await authService.verifyToken(token);

    // SECURITY: Verify token type is 'access' not 'refresh'
    // Prevents refresh tokens (7d lifetime) from being used as access tokens
    if (decoded.type !== 'access') {
      res.status(401).json({
        success: false,
        error: 'Invalid token type. Use access token for API requests.',
        code: 'INVALID_TOKEN_TYPE',
      });
      return;
    }

    // Look up user in database using userId from token
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    // Check if user exists in database
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Attach user to request object for downstream middleware/routes
    req.user = user;

    // Proceed to next middleware/route handler
    next();
  } catch (error) {
    // Handle custom error types from authService
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (error instanceof TokenInvalidError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    if (error instanceof TokenMalformedError) {
      res.status(401).json({
        success: false,
        error: 'Malformed token',
        code: 'TOKEN_MALFORMED',
      });
      return;
    }

    // Generic token error (fallback for unexpected errors)
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};
