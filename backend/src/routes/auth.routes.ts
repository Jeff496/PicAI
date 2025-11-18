// src/routes/auth.routes.ts
// Authentication routes for user registration, login, and token management
// Connects validation middleware and auth controller

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { loginSchema, registerSchema, refreshTokenSchema } from '../schemas/auth.schema.js';

const router = Router();

/**
 * Rate limiting configuration for authentication endpoints
 *
 * Stricter limits on sensitive endpoints to prevent:
 * - Brute force attacks on login
 * - Account enumeration via registration
 * - Token refresh abuse
 *
 * Note: Uses default keyGenerator which properly handles IPv4 and IPv6
 */

// Strict rate limiter for login (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  // Default keyGenerator handles IPv4/IPv6 automatically
});

// Moderate rate limiter for registration (3 per hour)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: {
    success: false,
    error: 'Too many registration attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Default keyGenerator handles IPv4/IPv6 automatically
});

// Refresh token rate limiter (10 per 15 minutes)
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    error: 'Too many token refresh attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Default keyGenerator handles IPv4/IPv6 automatically
});

/**
 * Authentication Routes
 *
 * All routes return standardized JSON responses:
 * Success: { success: true, data: {...} }
 * Error: { success: false, error: "message", code: "ERROR_CODE" }
 */

/**
 * POST /auth/register
 *
 * Register a new user account
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!",
 *   "name": "John Doe",
 *   "profilePictureUrl": "https://example.com/avatar.jpg" // optional
 * }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresIn": 900,
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "profilePictureUrl": "https://example.com/avatar.jpg"
 *   }
 * }
 *
 * Errors:
 * - 400 VALIDATION_ERROR: Invalid request body
 * - 400 USER_EXISTS: Email already registered
 * - 429 RATE_LIMIT_EXCEEDED: Too many registration attempts
 */
router.post('/register', registerLimiter, validateRequest(registerSchema), authController.register);

/**
 * POST /auth/login
 *
 * Authenticate user and receive access + refresh tokens
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!"
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresIn": 900,
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "profilePictureUrl": "https://example.com/avatar.jpg"
 *   }
 * }
 *
 * Errors:
 * - 400 VALIDATION_ERROR: Invalid request body
 * - 401 INVALID_CREDENTIALS: Email not found or password incorrect
 * - 429 RATE_LIMIT_EXCEEDED: Too many login attempts
 */
router.post('/login', loginLimiter, validateRequest(loginSchema), authController.login);

/**
 * POST /auth/refresh
 *
 * Refresh access token using refresh token
 *
 * Request Body:
 * {
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresIn": 900
 * }
 *
 * Errors:
 * - 400 VALIDATION_ERROR: Invalid request body
 * - 400 MISSING_TOKEN: No refresh token provided
 * - 401 REFRESH_TOKEN_EXPIRED: Refresh token has expired
 * - 401 INVALID_REFRESH_TOKEN: Refresh token is invalid
 * - 429 RATE_LIMIT_EXCEEDED: Too many refresh attempts
 */
router.post(
  '/refresh',
  refreshLimiter,
  validateRequest(refreshTokenSchema),
  authController.refresh
);

/**
 * POST /auth/logout
 *
 * Logout user (client-side token removal)
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Logged out successfully. Please clear tokens on client."
 * }
 *
 * Note: Since JWTs are stateless, logout is primarily handled client-side
 * by removing tokens from storage. This endpoint can be extended for
 * token blacklisting if required.
 */
router.post('/logout', authenticateJWT, authController.logout);

/**
 * GET /auth/me
 *
 * Get current authenticated user profile
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "profilePictureUrl": "https://example.com/avatar.jpg"
 *   }
 * }
 *
 * Errors:
 * - 401 NO_TOKEN: Missing or invalid Authorization header
 * - 401 TOKEN_EXPIRED: Access token has expired (use refresh token)
 * - 401 INVALID_TOKEN: Access token is invalid
 * - 401 USER_NOT_FOUND: User from token doesn't exist
 */
router.get('/me', authenticateJWT, authController.getCurrentUser);

export default router;
