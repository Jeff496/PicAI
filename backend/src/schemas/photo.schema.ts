// src/schemas/photo.schema.ts
// Zod validation schemas for photo-related requests

import { z } from 'zod';

/**
 * Schema for photo upload request body
 * Files are handled by Multer, this validates additional form fields
 */
export const uploadPhotoSchema = z.object({
  groupId: z.string().uuid('Invalid group ID format').optional(),
});

/**
 * Schema for query parameters when listing photos
 */
export const getPhotosQuerySchema = z.object({
  groupId: z.string().uuid('Invalid group ID format').optional(),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .default('50')
    .transform(Number)
    .pipe(z.number().int().min(1).max(100)),
  offset: z
    .string()
    .regex(/^\d+$/, 'Offset must be a non-negative integer')
    .default('0')
    .transform(Number)
    .pipe(z.number().int().min(0)),
});

/**
 * Schema for photo ID parameter
 */
export const photoIdSchema = z.object({
  id: z.string().uuid('Invalid photo ID format'),
});

/**
 * TypeScript types inferred from schemas
 */
export type UploadPhotoRequest = z.infer<typeof uploadPhotoSchema>;
export type GetPhotosQuery = z.infer<typeof getPhotosQuerySchema>;
export type PhotoIdParam = z.infer<typeof photoIdSchema>;
