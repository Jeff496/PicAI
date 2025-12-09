// src/schemas/people.schema.ts
// Zod validation schemas for people-related requests

import { z } from 'zod';

/**
 * Schema for person ID parameter
 */
export const personIdSchema = z.object({
  id: z.string().uuid('Invalid person ID format'),
});

/**
 * Schema for updating a person's name
 */
export const updatePersonSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
});

/**
 * Schema for listing people with pagination
 */
export const getPeopleQuerySchema = z.object({
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
 * TypeScript types inferred from schemas
 */
export type PersonIdParam = z.infer<typeof personIdSchema>;
export type UpdatePersonRequest = z.infer<typeof updatePersonSchema>;
export type GetPeopleQuery = z.infer<typeof getPeopleQuerySchema>;
