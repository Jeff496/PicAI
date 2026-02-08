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
 * groupId can be:
 * - undefined: personal photos only (default)
 * - UUID: specific group
 * - "all": all photos user has access to (personal + all groups)
 */
export const getPhotosQuerySchema = z.object({
  groupId: z
    .string()
    .refine(
      (val) =>
        val === 'all' ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
      'Group ID must be a valid UUID or "all"'
    )
    .optional(),
  tag: z.string().min(1).max(200).optional(),
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
