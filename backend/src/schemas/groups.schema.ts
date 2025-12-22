// src/schemas/groups.schema.ts
// Zod validation schemas for groups, membership, and invites endpoints

import { z } from 'zod';

// ========== GROUP CRUD ==========

/**
 * Create Group Request Schema
 *
 * POST /api/groups
 * {
 *   "name": "Family Photos",
 *   "description": "Our family memories"
 * }
 */
export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Group name is required')
    .max(100, 'Group name must not exceed 100 characters')
    .trim(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional(),
});

export type CreateGroupRequest = z.infer<typeof createGroupSchema>;

/**
 * Update Group Request Schema
 *
 * PUT /api/groups/:id
 * {
 *   "name": "Updated Name",
 *   "description": "Updated description"
 * }
 */
export const updateGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Group name must be at least 1 character')
    .max(100, 'Group name must not exceed 100 characters')
    .trim()
    .optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional(),
});

export type UpdateGroupRequest = z.infer<typeof updateGroupSchema>;

/**
 * Group ID Parameter Schema
 *
 * Used for routes like /api/groups/:id
 */
export const groupIdParamSchema = z.object({
  id: z.string().uuid('Invalid group ID format'),
});

export type GroupIdParam = z.infer<typeof groupIdParamSchema>;

/**
 * Query Parameters for Listing Groups
 *
 * GET /api/groups?limit=50&offset=0
 */
export const getGroupsQuerySchema = z.object({
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

export type GetGroupsQuery = z.infer<typeof getGroupsQuerySchema>;

// ========== MEMBERSHIP ==========

/**
 * Update Member Role Request Schema
 *
 * PUT /api/groups/:id/members/:userId
 * {
 *   "role": "admin" | "member"
 * }
 */
export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member'], {
    message: 'Role must be either "admin" or "member"',
  }),
});

export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleSchema>;

/**
 * Member User ID Parameter Schema
 *
 * Used for routes like /api/groups/:id/members/:userId
 */
export const memberUserIdParamSchema = z.object({
  id: z.string().uuid('Invalid group ID format'),
  userId: z.string().uuid('Invalid user ID format'),
});

export type MemberUserIdParam = z.infer<typeof memberUserIdParamSchema>;

// ========== INVITES ==========

/**
 * Create Invite Request Schema
 *
 * POST /api/groups/:id/invites
 * {
 *   "expiresInDays": 7,    // optional, null = never expires
 *   "maxUses": 10          // optional, null = unlimited
 * }
 */
export const createInviteSchema = z.object({
  expiresInDays: z
    .number()
    .int('Expiration must be a whole number of days')
    .min(1, 'Expiration must be at least 1 day')
    .max(30, 'Expiration must not exceed 30 days')
    .optional(),
  maxUses: z
    .number()
    .int('Max uses must be a whole number')
    .min(1, 'Max uses must be at least 1')
    .max(100, 'Max uses must not exceed 100')
    .optional(),
});

export type CreateInviteRequest = z.infer<typeof createInviteSchema>;

/**
 * Invite ID Parameter Schema
 *
 * Used for routes like /api/groups/:id/invites/:inviteId
 */
export const inviteIdParamSchema = z.object({
  id: z.string().uuid('Invalid group ID format'),
  inviteId: z.string().uuid('Invalid invite ID format'),
});

export type InviteIdParam = z.infer<typeof inviteIdParamSchema>;

/**
 * Invite Token Parameter Schema
 *
 * Used for routes like /api/invites/:token
 * Tokens are 64 hex characters (32 bytes)
 */
export const inviteTokenParamSchema = z.object({
  token: z
    .string()
    .min(32, 'Invalid invite token')
    .max(128, 'Invalid invite token')
    .regex(/^[a-f0-9]+$/i, 'Invalid invite token format'),
});

export type InviteTokenParam = z.infer<typeof inviteTokenParamSchema>;

/**
 * Email Invite Request Schema
 *
 * POST /api/groups/:id/invite-email
 * {
 *   "email": "user@example.com",
 *   "expiresInDays": 7     // optional
 * }
 */
export const emailInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  expiresInDays: z
    .number()
    .int('Expiration must be a whole number of days')
    .min(1, 'Expiration must be at least 1 day')
    .max(30, 'Expiration must not exceed 30 days')
    .optional(),
});

export type EmailInviteRequest = z.infer<typeof emailInviteSchema>;
