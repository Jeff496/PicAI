// src/prisma/client.ts
// Prisma Client singleton instance
// Ensures only one instance is created and reused across the application

import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Global Prisma Client instance
 *
 * Using a singleton pattern to prevent multiple instances in development
 * when using hot reload (tsx watch, nodemon, etc.)
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma Client instance with optimized connection pooling
 *
 * Connection Pool Configuration:
 * - Configured via DATABASE_URL connection string parameters
 * - Recommended for Raspberry Pi: connection_limit=5, pool_timeout=20
 * - Example DATABASE_URL:
 *   postgresql://user:password@localhost:5432/db?connection_limit=5&pool_timeout=20
 *
 * Logging Configuration:
 * - Development: Logs queries, errors, and warnings for debugging
 * - Production: Only logs errors to reduce noise
 * - Test: Minimal logging to keep test output clean
 *
 * Performance Tips:
 * - Singleton pattern prevents connection pool exhaustion
 * - Connection pool is shared across all requests
 * - Adjust connection_limit based on available RAM (Pi: 5-10)
 * - Use connection pooler (PgBouncer) for high-traffic scenarios
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : process.env.NODE_ENV === 'test'
          ? ['error']
          : ['error', 'warn'],
    errorFormat: 'minimal', // Smaller error messages for production
  });

// Store in global for development hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Export as default for convenience
export default prisma;
