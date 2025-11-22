// src/utils/logger.ts
// Winston logger with console output and daily rotating file transports
// Provides structured logging for development and production environments

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '../config/env.js';

/**
 * Log Format Configuration
 *
 * Creates a structured log format with:
 * - Timestamp in ISO 8601 format
 * - Log level (error, warn, info, debug)
 * - Message
 * - Additional metadata (splat for printf-style formatting)
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Include stack traces for errors
  winston.format.splat(), // Support for %s, %d printf-style formatting
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...metadata } = info;

    // Build base log message
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add metadata if present (exclude Symbol keys like Symbol(level))
    const metadataKeys = Object.keys(metadata).filter((key) => !key.startsWith('Symbol('));
    if (metadataKeys.length > 0) {
      const metadataStr = JSON.stringify(metadata, null, 2);
      log += ` ${metadataStr}`;
    }

    // If there's a stack trace (from Error objects), include it
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

/**
 * Daily Rotating File Transport for Error Logs
 *
 * Configuration:
 * - filename: logs/error-%DATE%.log (e.g., error-2025-11-18.log)
 * - datePattern: Daily rotation (YYYY-MM-DD)
 * - maxSize: No size limit per file (relies on daily rotation)
 * - maxFiles: Keep last 14 days of error logs
 * - level: Only log 'error' level messages
 *
 * Why separate error logs?
 * - Quick access to critical issues
 * - Easier monitoring and alerting
 * - Smaller files for faster searching
 */
const errorFileTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxFiles: '14d', // Keep 14 days of logs
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json() // JSON format for easier parsing
  ),
});

/**
 * Daily Rotating File Transport for All Logs
 *
 * Configuration:
 * - filename: logs/combined-%DATE%.log
 * - datePattern: Daily rotation (YYYY-MM-DD)
 * - maxFiles: Keep last 14 days of all logs
 * - level: Log all levels (error, warn, info, debug)
 *
 * Why combined logs?
 * - Complete audit trail of application activity
 * - Debug issues by seeing full context
 * - Compliance and security requirements
 */
const combinedFileTransport = new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json() // JSON format for log aggregation tools
  ),
});

/**
 * Console Transport for Development
 *
 * Configuration:
 * - Colored output for easy reading in terminal
 * - Pretty-printed format (not JSON)
 * - Shows all log levels in development
 * - Disabled in test environment to reduce noise
 *
 * Why conditional console logging?
 * - Development: Need immediate feedback
 * - Production: Files are sufficient, console clutters PM2 logs
 * - Test: Reduces noise in test output
 */
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(), // Color-code log levels
    logFormat // Use our custom format
  ),
});

/**
 * Winston Logger Instance
 *
 * Log Levels (in order of severity):
 * - error (0): Application errors, exceptions, crashes
 * - warn (1): Warning messages, deprecated features
 * - info (2): General informational messages (user login, API calls)
 * - debug (3): Detailed debugging information
 *
 * Environment-based Configuration:
 * - Development: debug level + console output
 * - Production: info level + file output only
 * - Test: warn level + minimal output
 *
 * Usage Examples:
 * ```typescript
 * import logger from './utils/logger.js';
 *
 * logger.error('Database connection failed', { error: err });
 * logger.warn('Deprecated API endpoint called', { endpoint: '/old-api' });
 * logger.info('User logged in', { userId: user.id, email: user.email });
 * logger.debug('Processing request', { body: req.body });
 * ```
 */
const logger = winston.createLogger({
  // Set log level based on environment
  // Development: 'debug' (log everything)
  // Production/Test: 'info' (skip debug messages)
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',

  // Default format for all transports (can be overridden per transport)
  format: logFormat,

  // Transports: Where logs are written
  transports: [
    errorFileTransport, // Error logs only
    combinedFileTransport, // All logs
  ],

  // Don't exit on uncaught exceptions (let PM2 handle process management)
  exitOnError: false,
});

// Add console transport for non-test environments
// Test environment: No console output to keep test output clean
if (env.NODE_ENV !== 'test') {
  logger.add(consoleTransport);
}

/**
 * Log Rotation Event Handlers
 *
 * These handlers are triggered when log files are rotated (created/removed)
 * Useful for monitoring and debugging log rotation issues
 */
errorFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Error log file rotated', { oldFilename, newFilename });
});

combinedFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Combined log file rotated', { oldFilename, newFilename });
});

/**
 * Stream Interface for Morgan HTTP Request Logging
 *
 * Allows Morgan (HTTP request logger) to write to Winston
 * Morgan will log all HTTP requests at 'info' level
 *
 * Usage with Express:
 * ```typescript
 * import morgan from 'morgan';
 * import logger, { morganStream } from './utils/logger.js';
 *
 * app.use(morgan('combined', { stream: morganStream }));
 * ```
 */
export const morganStream = {
  write: (message: string) => {
    // Remove trailing newline from Morgan messages
    logger.info(message.trim());
  },
};

// Export the configured logger as default export
export default logger;
