// src/schemas/auth.schema.ts
// Zod validation schemas for authentication requests
// Used by validate middleware to ensure request data is properly formatted

import { z } from 'zod';

/**
 * Login Request Schema
 *
 * POST /auth/login
 * {
 *   "email": "user@example.com",
 *   "password": "MySecurePass123!"
 * }
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof loginSchema>;

/**
 * Register Request Schema
 *
 * POST /auth/register
 * {
 *   "email": "user@example.com",
 *   "password": "MySecurePass123!",
 *   "name": "John Doe",
 *   "profilePictureUrl": "https://example.com/avatar.jpg" // optional
 * }
 *
 * Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .min(3, 'Email must be at least 3 characters')
    .max(255, 'Email must not exceed 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  profilePictureUrl: z.string().url('Invalid profile picture URL').optional().nullable(),
});

export type RegisterRequest = z.infer<typeof registerSchema>;

/**
 * Token Refresh Request Schema
 *
 * POST /auth/refresh
 * {
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;

/**
 * Logout Request Schema (optional - for token blacklisting)
 *
 * POST /auth/logout
 * Uses Authorization header Bearer token
 * No body required
 */
export const logoutSchema = z.object({}).optional();
