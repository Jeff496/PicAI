// src/middleware/validate.middleware.ts
// Zod validation middleware for request body validation
// Validates incoming requests against Zod schemas and returns 400 on errors

import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Validation middleware factory
 *
 * Creates a middleware that validates request body against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const loginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8)
 * });
 *
 * router.post('/login', validateRequest(loginSchema), authController.login);
 * ```
 *
 * Error Response (400):
 * {
 *   "success": false,
 *   "error": "Validation failed",
 *   "code": "VALIDATION_ERROR",
 *   "details": [
 *     { "field": "email", "message": "Invalid email address" },
 *     { "field": "password", "message": "Password must be at least 8 characters" }
 *   ]
 * }
 */
export const validateRequest = <T extends z.ZodType>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate request body
      schema.parse(req.body);
      next();
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      // Re-throw unexpected errors
      next(error);
    }
  };
};

/**
 * Query parameter validation middleware factory
 *
 * Creates a middleware that validates query parameters against a Zod schema
 * Transforms and replaces req.query with parsed values
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const querySchema = z.object({
 *   limit: z.string().transform(Number).pipe(z.number().min(1).max(100)),
 *   offset: z.string().transform(Number).pipe(z.number().min(0))
 * });
 *
 * router.get('/photos', validateQuery(querySchema), photosController.getPhotos);
 * ```
 */
export const validateQuery = <T extends z.ZodType>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate query parameters
      // Store parsed/transformed values on req.parsedQuery since req.query is read-only in Express 5
      const parsed = schema.parse(req.query);
      req.parsedQuery = parsed as Record<string, unknown>;
      next();
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      // Re-throw unexpected errors
      next(error);
    }
  };
};

/**
 * URL parameter validation middleware factory
 *
 * Creates a middleware that validates URL parameters against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const paramSchema = z.object({
 *   id: z.string().uuid('Invalid photo ID format')
 * });
 *
 * router.get('/photos/:id', validateParams(paramSchema), photosController.getPhotoById);
 * ```
 */
export const validateParams = <T extends z.ZodType>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate URL parameters
      schema.parse(req.params);
      next();
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid URL parameters',
          code: 'VALIDATION_ERROR',
          details: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      // Re-throw unexpected errors
      next(error);
    }
  };
};
