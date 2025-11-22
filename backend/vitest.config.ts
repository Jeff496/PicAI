/**
 * Vitest Configuration for PicAI Backend
 *
 * Configured for:
 * - TypeScript with native ES modules support
 * - Node.js 24
 * - Prisma integration
 * - Stable, production-ready testing
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test setup
    setupFiles: ['./tests/setup.ts'],

    // Test file patterns
    include: ['tests/**/*.test.ts', '**/__tests__/**/*.test.ts'],

    // Files to exclude
    exclude: ['node_modules', 'dist', 'src/generated'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/generated/**',
        'src/types/**',
        'src/index.ts',
      ],
      // Coverage thresholds
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },

    // Increase timeout for integration tests (database operations)
    testTimeout: 10000,

    // Globals (makes describe, it, expect available without imports)
    globals: true,

    // Clear mocks between tests
    clearMocks: true,

    // Mock reset between tests
    mockReset: true,

    // Restore mocks between tests
    restoreMocks: true,
  },
});
