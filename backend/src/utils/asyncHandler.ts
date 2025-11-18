// src/utils/asyncHandler.ts
// Wrapper for async Express route handlers to catch errors automatically
// Eliminates need for try-catch blocks in every async route

import type { Request, Response, NextFunction } from 'express';

/**
 * Type definition for async Express route handlers
 */
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

/**
 * Wraps async Express route handlers to automatically catch errors
 *
 * @param fn - Async route handler function
 * @returns Express middleware function that handles promise rejections
 *
 * @example
 * ```typescript
 * export const getPhotos = asyncHandler(async (req, res) => {
 *   const photos = await prisma.photo.findMany();
 *   res.json({ success: true, data: photos });
 * });
 * ```
 *
 * Note: Express 5 has built-in async error handling, but this wrapper
 * provides explicit error catching and can be used for custom error handling.
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
