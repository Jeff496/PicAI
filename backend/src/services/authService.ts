// src/services/authService.ts
// Authentication service using jose for JWT and bcrypt for password hashing
// Compatible with Node.js 24 (jose replaces jsonwebtoken)

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

/**
 * AuthService Class
 *
 * Handles all authentication-related operations:
 * - Password hashing and comparison using bcrypt
 * - JWT token generation and verification using jose
 *
 * Uses jose instead of jsonwebtoken for Node.js 24 compatibility
 */
class AuthService {
  private secret: Uint8Array;

  constructor() {
    // Convert JWT secret string to Uint8Array for jose
    // jose requires Uint8Array for HMAC operations
    this.secret = new TextEncoder().encode(env.JWT_SECRET);
  }

  /**
   * Hash a password using bcrypt
   *
   * @param password - Plain text password to hash
   * @returns Promise resolving to bcrypt hash
   *
   * Security: Uses 10 salt rounds as recommended for production
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Compare a plain text password with a bcrypt hash
   *
   * @param password - Plain text password to verify
   * @param hash - Bcrypt hash to compare against
   * @returns Promise resolving to true if password matches, false otherwise
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token using jose
   *
   * @param userId - User's unique identifier (UUID)
   * @param email - User's email address
   * @returns Promise resolving to signed JWT token string
   *
   * Token Structure:
   * - Header: { alg: 'HS256' }
   * - Payload: { userId, email, iat, exp, sub }
   * - Signature: HMAC SHA256
   *
   * Expiration: Configured via JWT_EXPIRATION env var (default: 7d)
   */
  async generateToken(userId: string, email: string): Promise<string> {
    const jwt = await new SignJWT({ userId, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(env.JWT_EXPIRATION)
      .setSubject(userId)
      .sign(this.secret);

    return jwt;
  }

  /**
   * Verify and decode a JWT token using jose
   *
   * @param token - JWT token string to verify
   * @returns Promise resolving to decoded payload { userId, email }
   * @throws Error if token is invalid, expired, or malformed
   *
   * Validation checks:
   * - Signature verification using secret
   * - Expiration time (exp claim)
   * - Token structure
   */
  async verifyToken(token: string): Promise<{ userId: string; email: string }> {
    const { payload } = await jwtVerify(token, this.secret);

    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  }
}

// Export singleton instance
// This ensures the secret is only loaded once and shared across the application
export const authService = new AuthService();
