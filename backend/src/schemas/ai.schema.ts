// src/schemas/ai.schema.ts
// Zod validation schemas for AI-related endpoints

import { z } from 'zod';

/**
 * Schema for adding a manual tag
 * POST /photos/:id/tags
 */
export const addTagSchema = z.object({
  tag: z
    .string()
    .min(1, 'Tag cannot be empty')
    .max(200, 'Tag must be 200 characters or less')
    .trim(),
  category: z.string().min(1).max(50).optional().default('manual'),
});

export type AddTagRequest = z.infer<typeof addTagSchema>;

/**
 * Schema for photo ID parameter
 * Used in /ai/analyze/:photoId and /photos/:id/tags
 */
export const photoIdParamSchema = z.object({
  photoId: z.uuid('Invalid photo ID'),
});

export type PhotoIdParam = z.infer<typeof photoIdParamSchema>;

/**
 * Schema for tag ID parameter
 * Used in DELETE /photos/:id/tags/:tagId
 */
export const tagIdParamSchema = z.object({
  id: z.uuid('Invalid photo ID'),
  tagId: z.uuid('Invalid tag ID'),
});

export type TagIdParam = z.infer<typeof tagIdParamSchema>;

/**
 * Schema for batch analysis request
 * POST /ai/analyze-missing
 */
export const analyzeMissingSchema = z.object({
  // Optional: filter to specific user (for admin use)
  userId: z.uuid().optional(),
});

export type AnalyzeMissingRequest = z.infer<typeof analyzeMissingSchema>;

/**
 * Schema for bulk photo analysis
 * POST /ai/analyze/bulk
 */
export const bulkAnalyzeSchema = z.object({
  photoIds: z
    .array(z.uuid('Invalid photo ID'))
    .min(1, 'At least one photo ID is required')
    .max(50, 'Maximum 50 photos per request'),
});

export type BulkAnalyzeRequest = z.infer<typeof bulkAnalyzeSchema>;
