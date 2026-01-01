// src/routes/groups.routes.ts
// Routes for groups, membership, and invite operations

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validateRequest, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import {
  createGroupSchema,
  updateGroupSchema,
  groupIdParamSchema,
  updateMemberRoleSchema,
  memberUserIdParamSchema,
  createInviteSchema,
  inviteIdParamSchema,
  getGroupsQuerySchema,
} from '../schemas/groups.schema.js';
import * as groupsController from '../controllers/groups.controller.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiters
const inviteRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 invites per hour
  message: { success: false, error: 'Too many invites created', code: 'RATE_LIMIT_EXCEEDED' },
});

// ========== GROUP CRUD ==========
router.post('/', authenticateJWT, validateRequest(createGroupSchema), groupsController.createGroup);
router.get('/', authenticateJWT, validateQuery(getGroupsQuerySchema), groupsController.getGroups);
router.get('/:id', authenticateJWT, validateParams(groupIdParamSchema), groupsController.getGroupById);
router.put('/:id', authenticateJWT, validateParams(groupIdParamSchema), validateRequest(updateGroupSchema), groupsController.updateGroup);
router.delete('/:id', authenticateJWT, validateParams(groupIdParamSchema), groupsController.deleteGroup);

// ========== GROUP PHOTOS ==========
router.get('/:id/photos', authenticateJWT, validateParams(groupIdParamSchema), groupsController.getGroupPhotos);

// ========== MEMBERSHIP ==========
router.get('/:id/members', authenticateJWT, validateParams(groupIdParamSchema), groupsController.getGroupMembers);
router.put('/:id/members/:userId', authenticateJWT, validateParams(memberUserIdParamSchema), validateRequest(updateMemberRoleSchema), groupsController.updateMemberRole);
router.delete('/:id/members/:userId', authenticateJWT, validateParams(memberUserIdParamSchema), groupsController.removeMember);
router.delete('/:id/leave', authenticateJWT, validateParams(groupIdParamSchema), groupsController.leaveGroup);

// ========== INVITES ==========
router.post('/:id/invites', authenticateJWT, inviteRateLimiter, validateParams(groupIdParamSchema), validateRequest(createInviteSchema), groupsController.createInvite);
router.get('/:id/invites', authenticateJWT, validateParams(groupIdParamSchema), groupsController.getGroupInvites);
router.delete('/:id/invites/:inviteId', authenticateJWT, validateParams(inviteIdParamSchema), groupsController.revokeInvite);

export default router;
