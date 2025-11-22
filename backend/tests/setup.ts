/**
 * Vitest Setup File
 *
 * This file runs before all tests
 * Configure global test settings here
 */

import { config } from 'dotenv';
import { beforeAll } from 'vitest';

// Load environment variables from .env.test or .env
config({ path: '.env.test' });
config({ path: '.env' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global setup before all tests
beforeAll(() => {
  // Any global setup can go here
});

// Note: Timeout is configured in vitest.config.ts (testTimeout: 10000)
// Note: Console suppression can be configured in vitest.config.ts if needed
