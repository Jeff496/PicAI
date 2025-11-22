/**
 * Authentication Integration Tests
 *
 * Automated tests based on SESSION_LOG_1_CHECK_AUTH.md
 * Run with: npm run test:auth
 *
 * Using Vitest for stable ES module support
 */

import { describe, it, expect, afterAll } from 'vitest';
import { authService } from '../src/services/authService.js';
import prisma from '../src/prisma/client.js';

describe('Authentication System - Integration Tests', () => {
  let testUserId: string;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123@';
  const testName = 'Integration Test User';

  /**
   * Cleanup: Delete test user after all tests
   */
  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
      }).catch(() => {
        // Ignore if already deleted
      });
    }
    await prisma.$disconnect();
  });

  describe('AuthService - Password Operations', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'MySecurePassword123!';
      const hash = await authService.hashPassword(password);

      // Check hash format (bcrypt starts with $2b$)
      expect(hash).toMatch(/^\$2b\$/);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await authService.hashPassword(password);
      const isValid = await authService.comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await authService.hashPassword(password);
      const isValid = await authService.comparePassword('WrongPassword', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('AuthService - JWT Token Operations', () => {
    let accessToken: string;
    let refreshToken: string;

    it('should generate access and refresh token pair', async () => {
      const tokens = await authService.generateTokenPair('test-user-id', 'test@example.com');

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(900); // 15 minutes
      expect(typeof tokens.accessToken).toBe('string');
      expect(tokens.accessToken.length).toBeGreaterThan(100);

      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    });

    it('should verify valid access token', async () => {
      const decoded = await authService.verifyToken(accessToken);

      expect(decoded.userId).toBe('test-user-id');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.type).toBe('access');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should verify valid refresh token', async () => {
      const decoded = await authService.verifyToken(refreshToken);

      expect(decoded.userId).toBe('test-user-id');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.type).toBe('refresh');
    });

    it('should reject invalid token', async () => {
      await expect(authService.verifyToken('invalid.token.here'))
        .rejects
        .toThrow();
    });

    it('should reject malformed token', async () => {
      await expect(authService.verifyToken('not-even-a-jwt'))
        .rejects
        .toThrow();
    });

    it('should reject forged token signature', async () => {
      const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlIiwiZW1haWwiOiJmYWtlQGV4YW1wbGUuY29tIn0.fakesignature';

      await expect(authService.verifyToken(forgedToken))
        .rejects
        .toThrow();
    });

    it('should refresh tokens with valid refresh token', async () => {
      const newTokens = await authService.refreshTokens(refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.expiresIn).toBe(900);

      // Verify new tokens are valid and contain correct data
      const decodedNewToken = await authService.verifyToken(newTokens.accessToken);
      expect(decodedNewToken.userId).toBe('test-user-id');
      expect(decodedNewToken.email).toBe('test@example.com');
    });

    it('should reject refresh with access token', async () => {
      // Try to refresh using access token instead of refresh token
      await expect(authService.refreshTokens(accessToken))
        .rejects
        .toThrow();
    });
  });

  describe('Database - User Creation', () => {
    it('should create user with hashed password', async () => {
      const passwordHash = await authService.hashPassword(testPassword);

      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash,
          name: testName,
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.name).toBe(testName);
      expect(user.passwordHash).toMatch(/^\$2b\$/);
      expect(user.createdAt).toBeInstanceOf(Date);

      testUserId = user.id;
    });

    it('should find user by email', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      expect(user).not.toBeNull();
      expect(user?.email).toBe(testEmail);
      expect(user?.id).toBe(testUserId);
    });

    it('should prevent duplicate email', async () => {
      const passwordHash = await authService.hashPassword('AnotherPassword123@');

      await expect(
        prisma.user.create({
          data: {
            email: testEmail, // Duplicate
            passwordHash,
            name: 'Duplicate User',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Database - Login Flow', () => {
    it('should authenticate user with correct credentials', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      expect(user).not.toBeNull();

      const isValidPassword = await authService.comparePassword(
        testPassword,
        user!.passwordHash
      );

      expect(isValidPassword).toBe(true);
    });

    it('should reject authentication with wrong password', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      expect(user).not.toBeNull();

      const isValidPassword = await authService.comparePassword(
        'WrongPassword123@',
        user!.passwordHash
      );

      expect(isValidPassword).toBe(false);
    });
  });

  describe('Database - Token Storage Simulation', () => {
    it('should generate tokens for authenticated user', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      expect(user).not.toBeNull();

      const tokens = await authService.generateTokenPair(user!.id, user!.email);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      // Verify token contains correct user data
      const decoded = await authService.verifyToken(tokens.accessToken);
      expect(decoded.userId).toBe(user!.id);
      expect(decoded.email).toBe(user!.email);
    });
  });

  describe('Environment Variables', () => {
    it('should have JWT_SECRET configured', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET!.length).toBeGreaterThanOrEqual(32);
    });

    it('should have DATABASE_URL configured', () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toContain('postgresql://');
    });
  });

  describe('Database Connection', () => {
    it('should connect to database', async () => {
      await expect(prisma.$connect()).resolves.not.toThrow();
    });

    it('should execute queries', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toBeDefined();
    });
  });
});
