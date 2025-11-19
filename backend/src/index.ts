// src/index.ts
// Express server entry point for PicAI backend
// Configures middleware, routes, and starts the HTTP server

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import logger from './utils/logger.js';
import prisma from './prisma/client.js';

const app = express();

/**
 * 3.1 CORS Middleware
 * Allows frontend to call API
 * Validates origin against allowed list
 */

// Define allowed origins based on environment
const allowedOrigins = [
  env.FRONTEND_URL, // Production frontend
  'http://localhost:5173', // Vite dev server
  'http://localhost:4173', // Vite preview
  'http://localhost:3000', // Alternative dev port
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin only in development (mobile apps, Postman, curl)
      if (!origin) {
        if (env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        return callback(new Error('Origin header required in production'));
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked', { origin });
        callback(null, false);
      }
    },
    credentials: true, // Allow cookies and Authorization header
    optionsSuccessStatus: 200, // For legacy browsers
  })
);

/**
 * 3.2 Request Timeout Middleware
 * Prevents slow clients from exhuasting server connections (especially for pi)
 */

app.use((req, _res, next) => {
  req.setTimeout(30 * 1000);
  next();
});

/**
 * 3.3 Request ID Middleware
 * Generates a unique ID for request tracing and debugging
 */
app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log incoming request with request ID
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  next();
});

/**
 * 3.4 JSON Body Parser
 * Parses incoming JSON request bodies and makes them available in req.body
 * 10mb max request size (prevents abuse)
 * Adjust if you need to accept larger payloads
 */
app.use(express.json({ limit: '10mb' }));

/**
 * 3.5 URL-Encoded Parser
 * Parses form data (application/x-www-form-urlencoded)
 */
app.use(express.urlencoded({ extended: true }));

/**
 * ========================================
 * STEP 4: HEALTH CHECK ENDPOINT
 * ========================================
 * Verifies server and database health
 * Used by monitoring tools, load balancers, and CI/CD
 */

const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', healthCheckLimiter, async (_req, res) => {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    environment: string;
    checks: {
      database: 'ok' | 'error';
    };
    details?: {
      database?: string;
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    checks: {
      database: 'ok',
    },
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = 'ok';
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = 'error';
    health.details = {
      database: error instanceof Error ? error.message : 'Unknown error',
    };
    logger.error('Health check: Database connection failed', { error });
  }

  // Determine overall status
  const hasErrors = Object.values(health.checks).some((check) => check === 'error');
  if (hasErrors) {
    health.status = 'degraded';
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    success: health.status === 'healthy',
    ...health,
  });
});

/**
 * ========================================
 * STEP 5: API ROUTES
 * ========================================
 */
app.use('/api/auth', authRoutes);

// future: /api/photos, /api/albums, /api/groups, /api/users

/**
 * ========================================
 * STEP 6: ERROR HANDLING MIDDLEWARE
 * ========================================
 */
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * ========================================
 * STEP 7: START SERVER
 * ========================================
 * Only starts if file is directly executed (not imported for tests)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = env.PORT;

  const server = app.listen(PORT, () => {
    logger.info('==============================================');
    logger.info('🚀 PicAI Backend Server Started');
    logger.info('==============================================');
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Port: ${PORT}`);
    logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
    logger.info(`Health Check: http://localhost:${PORT}/health`);
    logger.info(`API Base: http://localhost:${PORT}/api`);
    logger.info('==============================================');
    logger.info('Available Routes:');
    logger.info('  POST   /api/auth/register');
    logger.info('  POST   /api/auth/login');
    logger.info('  POST   /api/auth/refresh');
    logger.info('  POST   /api/auth/logout');
    logger.info('  GET    /api/auth/me');
    logger.info('==============================================');
  });

  /**
   * Graceful Shutdown Handler
   * Ensures in-flight requests are completed and resources are cleaned up before exiting
   */

  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} signal received: closing HTTP server`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connections
        await prisma.$disconnect();
        logger.info('Database connections closed');

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds if graceful shutdown fails
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    gracefulShutdown('unhandledRejection');
  });
}

// export app for testing
export default app;
