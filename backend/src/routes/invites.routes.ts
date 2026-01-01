// src/routes/invites.routes.ts
// Public routes for invite handling

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validateParams } from '../middleware/validate.middleware.js';
import { inviteTokenParamSchema } from '../schemas/groups.schema.js';
import * as groupsController from '../controllers/groups.controller.js';

const router = Router();

// Public - no auth required
router.get('/:token', validateParams(inviteTokenParamSchema), groupsController.getInviteInfo);

// Requires auth to join
router.post('/:token/join', authenticateJWT, validateParams(inviteTokenParamSchema), groupsController.joinViaInvite);

export default router;
