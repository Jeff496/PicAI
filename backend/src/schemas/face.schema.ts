// src/schemas/face.schema.ts
// Zod validation schemas for face-related requests

import { z } from 'zod';

/**
 * Schema for face ID parameter
 */
export const faceIdSchema = z.object({
  id: z.string().uuid('Invalid face ID format'),
});

/**
 * Schema for tagging a face
 */
export const tagFaceSchema = z
  .object({
    personId: z.string().uuid('Invalid person ID format').optional(),
    personName: z.string().min(1).max(100).optional(),
  })
  .refine((data) => data.personId || data.personName, {
    message: 'Either personId or personName is required',
  });

/**
 * TypeScript types inferred from schemas
 */
export type FaceIdParam = z.infer<typeof faceIdSchema>;
export type TagFaceRequest = z.infer<typeof tagFaceSchema>;
