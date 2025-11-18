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
 * Prisma Client instance
 *
 * In development: Reuses existing instance to prevent connection exhaustion
 * In production: Creates new instance
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Store in global for development hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Export as default for convenience
export default prisma;
