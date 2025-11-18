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
