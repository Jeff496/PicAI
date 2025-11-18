// tests/test-logger.ts
// Example demonstrating Winston logger usage
// Run with: npx tsx tests/test-logger.ts

import logger from '../src/utils/logger.js';

/**
 * Logger Test Examples
 *
 * Demonstrates all four log levels and how to include metadata
 */

console.log('=== Testing Winston Logger ===\n');

// 1. ERROR Level - Critical issues that need immediate attention
logger.error('Database connection failed', {
  error: 'ECONNREFUSED',
  host: 'localhost',
  port: 5432,
});

// 2. WARN Level - Warning messages, potential issues
logger.warn('API rate limit approaching threshold', {
  currentRequests: 950,
  limit: 1000,
  timeWindow: '1 minute',
});

// 3. INFO Level - General informational messages
logger.info('User authentication successful', {
  userId: 'user-123',
  email: 'test@example.com',
  ip: '192.168.1.1',
});

// 4. DEBUG Level - Detailed debugging information
logger.debug('Processing authentication request', {
  method: 'POST',
  endpoint: '/auth/login',
  body: { email: 'test@example.com' }, // Don't log passwords!
  headers: {
    'user-agent': 'Mozilla/5.0',
    'content-type': 'application/json',
  },
});

// 5. Logging Errors with Stack Traces
try {
  throw new Error('Something went wrong in the application');
} catch (error) {
  logger.error('Caught an exception', { error });
}

// 6. Logging with printf-style formatting (using %s, %d)
logger.info('User %s uploaded %d photos', 'john@example.com', 25);

console.log('\n=== Logger Test Complete ===');
console.log('\nCheck the following locations for logs:');
console.log('- Console: You should see colored output above');
console.log('- File: logs/combined-YYYY-MM-DD.log (all logs)');
console.log('- File: logs/error-YYYY-MM-DD.log (errors only)');
