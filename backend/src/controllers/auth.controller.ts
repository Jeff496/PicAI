// src/controllers/auth.controller.ts
// Authentication controller handling user registration, login, token refresh
// Uses authService for JWT operations and Prisma for database access

import type { Request, Response } from 'express';
import {
  authService,
  TokenExpiredError,
  TokenInvalidError,
  TokenMalformedError,
} from '../services/authService.js';
import prisma from '../prisma/client.js';
import type { LoginRequest, RegisterRequest, RefreshTokenRequest } from '../schemas/auth.schema.js';

/**
 * Pre-computed dummy bcrypt hash for timing attack prevention
 * This is a valid bcrypt hash of a random string, used when user doesn't exist
 * to ensure consistent timing regardless of whether the user exists
 */
const DUMMY_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLHJ.bJe';

/**
 * Register a new user
 *
 * POST /auth/register
 * Body: { email, password, name, profilePictureUrl? }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "accessToken": "...",
 *   "refreshToken": "...",
 *   "expiresIn": 900,
 *   "user": { "id": "...", "email": "...", "name": "..." }
 * }
 *
 * Errors:
 * - 400 USER_EXISTS: Email already registered
 * - 500 Internal server error
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, profilePictureUrl } = req.body as RegisterRequest;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    res.status(400).json({
      success: false,
      error: 'Email already registered',
      code: 'USER_EXISTS',
    });
    return;
  }

  // Hash password
  const passwordHash = await authService.hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      profilePictureUrl: profilePictureUrl ?? null,
    },
  });

  // Generate token pair
  const tokens = await authService.generateTokenPair(user.id, user.email);

  res.status(201).json({
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      profilePictureUrl: user.profilePictureUrl,
    },
  });
};

/**
 * Login existing user
 *
 * POST /auth/login
 * Body: { email, password }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "accessToken": "...",
 *   "refreshToken": "...",
 *   "expiresIn": 900,
 *   "user": { "id": "...", "email": "...", "name": "..." }
 * }
 *
 * Errors:
 * - 401 INVALID_CREDENTIALS: Email not found or password incorrect
 * - 500 Internal server error
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as LoginRequest;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // SECURITY: Always run bcrypt comparison to prevent timing attacks
  // Use valid dummy hash if user doesn't exist to maintain consistent timing
  // This prevents attackers from enumerating valid email addresses via timing analysis
  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const isPasswordValid = await authService.comparePassword(password, passwordHash);

  // Check if user exists AND password is correct
  if (!user || !isPasswordValid) {
    res.status(401).json({
      success: false,
      error: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
    return;
  }

  // Generate token pair
  const tokens = await authService.generateTokenPair(user.id, user.email);

  res.json({
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      profilePictureUrl: user.profilePictureUrl,
    },
  });
};

/**
 * Refresh access token
 *
 * POST /auth/refresh
 * Body: { refreshToken }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "accessToken": "...",
 *   "refreshToken": "...",
 *   "expiresIn": 900
 * }
 *
 * Errors:
 * - 400 MISSING_TOKEN: No refresh token provided
 * - 401 REFRESH_TOKEN_EXPIRED: Refresh token has expired
 * - 401 INVALID_REFRESH_TOKEN: Refresh token is invalid
 * - 500 Internal server error
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as RefreshTokenRequest;

  if (!refreshToken) {
    res.status(400).json({
      success: false,
      error: 'Refresh token required',
      code: 'MISSING_TOKEN',
    });
    return;
  }

  try {
    // Generate new token pair
    const tokens = await authService.refreshTokens(refreshToken);

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    // Handle custom error types
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Refresh token expired, please login again',
        code: 'REFRESH_TOKEN_EXPIRED',
      });
      return;
    }

    if (error instanceof TokenInvalidError) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
      return;
    }

    if (error instanceof TokenMalformedError) {
      res.status(401).json({
        success: false,
        error: 'Malformed refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
      return;
    }

    // Re-throw unexpected errors
    throw error;
  }
};

/**
 * Logout user
 *
 * POST /auth/logout
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Logged out successfully"
 * }
 *
 * Note: Since we're using stateless JWT, logout is handled client-side
 * by clearing tokens from storage. This endpoint is provided for
 * consistency and can be extended for token blacklisting if needed.
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
  // TODO: Implement token blacklisting if required
  // For now, client-side token removal is sufficient

  res.json({
    success: true,
    message: 'Logged out successfully. Please clear tokens on client.',
  });
};

/**
 * Get current user profile
 *
 * GET /auth/me
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "user": { "id": "...", "email": "...", "name": "...", "profilePictureUrl": "..." }
 * }
 *
 * Requires: authenticateJWT middleware
 *
 * Errors:
 * - 401 NO_TOKEN: Missing or invalid Authorization header
 * - 401 USER_NOT_FOUND: User from token doesn't exist
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  // User is attached by authenticateJWT middleware
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      profilePictureUrl: req.user.profilePictureUrl,
    },
  });
};
