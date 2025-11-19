// src/services/authService.ts
// Authentication service using jose for JWT and bcrypt for password hashing
// Compatible with Node.js 24 (jose replaces jsonwebtoken)

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

/**
 * Custom error types for better error handling
 */
export class TokenExpiredError extends Error {
  constructor(message = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class TokenInvalidError extends Error {
  constructor(message = 'Token is invalid') {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

export class TokenMalformedError extends Error {
  constructor(message = 'Token is malformed') {
    super(message);
    this.name = 'TokenMalformedError';
  }
}

/**
 * JWT Payload interface for type safety
 */
export interface AuthTokenPayload extends JWTPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

/**
 * Token pair returned on login/refresh
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

/**
 * Decoded token result with type safety
 */
export interface DecodedToken {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
  sub: string;
}

/**
 * AuthService Class
 *
 * Handles all authentication-related operations:
 * - Password hashing and comparison using bcrypt
 * - JWT token generation and verification using jose
 * - Access and refresh token management
 *
 * Uses jose instead of jsonwebtoken for Node.js 24 compatibility
 */
class AuthService {
  private secret: Uint8Array;

  // Token expiration times (from environment variables)
  private readonly ACCESS_TOKEN_EXPIRATION = env.ACCESS_TOKEN_EXPIRATION; // Default: 15m
  private readonly REFRESH_TOKEN_EXPIRATION = env.REFRESH_TOKEN_EXPIRATION; // Default: 7d

  // Password hashing configuration (2025 security standards)
  private readonly BCRYPT_ROUNDS = 12; // Minimum recommended as of 2025

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
   * Security: Uses 12 salt rounds (2025 minimum standard)
   * - OWASP recommends minimum 12 rounds as of 2025
   * - Target hashing time: 250-500ms
   * - PHP/Laravel bumped defaults to 12 in 2024
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
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
   * Generate a JWT token using jose (legacy method - use generateTokenPair for new code)
   *
   * @param userId - User's unique identifier (UUID)
   * @param email - User's email address
   * @returns Promise resolving to signed JWT token string
   *
   * @deprecated Use generateTokenPair() instead for access + refresh tokens
   */
  async generateToken(userId: string, email: string): Promise<string> {
    const jwt = await new SignJWT({ userId, email, type: 'access' } as AuthTokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(env.JWT_EXPIRATION)
      .setSubject(userId)
      .sign(this.secret);

    return jwt;
  }

  /**
   * Generate access and refresh token pair
   *
   * @param userId - User's unique identifier (UUID)
   * @param email - User's email address
   * @returns Promise resolving to token pair with access and refresh tokens
   *
   * Token Structure:
   * - Access Token: Short-lived (15min), used for API requests
   * - Refresh Token: Long-lived (7d), used to get new access tokens
   *
   * @example
   * ```typescript
   * const tokens = await authService.generateTokenPair(user.id, user.email);
   * // Send both tokens to client
   * res.json({
   *   accessToken: tokens.accessToken,
   *   refreshToken: tokens.refreshToken,
   *   expiresIn: tokens.expiresIn
   * });
   * ```
   */
  async generateTokenPair(userId: string, email: string): Promise<TokenPair> {
    // Generate access token (short-lived)
    const accessToken = await new SignJWT({
      userId,
      email,
      type: 'access',
    } as AuthTokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.ACCESS_TOKEN_EXPIRATION)
      .setSubject(userId)
      .sign(this.secret);

    // Generate refresh token (long-lived)
    const refreshToken = await new SignJWT({
      userId,
      email,
      type: 'refresh',
    } as AuthTokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.REFRESH_TOKEN_EXPIRATION)
      .setSubject(userId)
      .sign(this.secret);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Verify and decode a JWT token using jose with type safety
   *
   * @param token - JWT token string to verify
   * @returns Promise resolving to decoded payload with type safety
   * @throws {TokenExpiredError} If token has expired
   * @throws {TokenInvalidError} If token signature is invalid
   * @throws {TokenMalformedError} If token structure is invalid
   *
   * Validation checks:
   * - Signature verification using secret
   * - Expiration time (exp claim)
   * - Token structure and required fields
   */
  async verifyToken(token: string): Promise<DecodedToken> {
    try {
      const { payload } = await jwtVerify(token, this.secret);

      // Type guard to ensure payload has required fields
      if (!this.isValidAuthPayload(payload)) {
        throw new TokenMalformedError('Token payload missing required fields');
      }

      return {
        userId: payload.userId,
        email: payload.email,
        type: (payload as AuthTokenPayload).type,
        iat: payload.iat!,
        exp: payload.exp!,
        sub: payload.sub!,
      };
    } catch (error) {
      // Transform jose errors into custom error types
      if (error instanceof Error) {
        // Check for expiration
        if (error.message.includes('exp') || error.message.includes('expired')) {
          throw new TokenExpiredError('Token has expired');
        }

        // Check for signature/verification errors
        if (error.message.includes('signature') || error.message.includes('verification')) {
          throw new TokenInvalidError('Token signature verification failed');
        }

        // Check for structure errors
        if (
          error.message.includes('malformed') ||
          error.message.includes('invalid') ||
          error.message.includes('JWS')
        ) {
          throw new TokenMalformedError('Token structure is invalid');
        }

        // Re-throw custom errors
        if (
          error instanceof TokenExpiredError ||
          error instanceof TokenInvalidError ||
          error instanceof TokenMalformedError
        ) {
          throw error;
        }
      }

      // Fallback for unknown errors
      throw new TokenInvalidError('Token verification failed');
    }
  }

  /**
   * Verify a refresh token and generate new token pair
   *
   * @param refreshToken - Refresh token from client
   * @returns Promise resolving to new token pair
   * @throws {TokenExpiredError} If refresh token has expired
   * @throws {TokenInvalidError} If refresh token is invalid
   *
   * @example
   * ```typescript
   * try {
   *   const tokens = await authService.refreshTokens(oldRefreshToken);
   *   res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
   * } catch (error) {
   *   if (error instanceof TokenExpiredError) {
   *     res.status(401).json({ error: 'Refresh token expired, please login again' });
   *   }
   * }
   * ```
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Verify the refresh token
    const decoded = await this.verifyToken(refreshToken);

    // Verify token type (should be 'refresh')
    if (decoded.type !== 'refresh') {
      throw new TokenInvalidError('Token is not a refresh token');
    }

    // Generate new token pair
    return this.generateTokenPair(decoded.userId, decoded.email);
  }

  /**
   * Type guard to validate JWT payload structure
   *
   * @param payload - JWT payload to validate
   * @returns True if payload has required fields
   */
  private isValidAuthPayload(payload: JWTPayload): payload is AuthTokenPayload {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      typeof payload.userId === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.iat === 'number' &&
      typeof payload.exp === 'number' &&
      typeof payload.sub === 'string'
    );
  }

  /**
   * Get token expiration times (for client-side storage decisions)
   */
  getTokenExpirations() {
    return {
      accessTokenExpiration: this.ACCESS_TOKEN_EXPIRATION,
      refreshTokenExpiration: this.REFRESH_TOKEN_EXPIRATION,
      accessTokenSeconds: 900, // 15 minutes
      refreshTokenSeconds: 604800, // 7 days
    };
  }
}

// Export singleton instance
// This ensures the secret is only loaded once and shared across the application
export const authService = new AuthService();
