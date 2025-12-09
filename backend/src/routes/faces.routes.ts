// src/routes/faces.routes.ts
// Face detection and tagging routes
// All routes require JWT authentication

import { Router } from 'express';
import * as facesController from '../controllers/faces.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validateParams, validateRequest } from '../middleware/validate.middleware.js';
import { faceIdSchema, tagFaceSchema } from '../schemas/face.schema.js';

const router = Router();

/**
 * Face Routes
 *
 * All routes require JWT authentication via Authorization header:
 * Authorization: Bearer <access_token>
 */

/**
 * POST /faces/:id/tag
 *
 * Tag a face (link to person and index to AWS)
 *
 * Body:
 * {
 *   "personId": "uuid" | null,  // Existing person or null to create new
 *   "personName": "Mom"         // Name for new person (required if personId is null)
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "face": { id, indexed, awsFaceId },
 *   "person": { id, name }
 * }
 */
router.post(
  '/:id/tag',
  authenticateJWT,
  validateParams(faceIdSchema),
  validateRequest(tagFaceSchema),
  facesController.tagFace
);

/**
 * DELETE /faces/:id/tag
 *
 * Remove face tag (unlink from person, remove from AWS collection)
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Face tag removed"
 * }
 */
router.delete('/:id/tag', authenticateJWT, validateParams(faceIdSchema), facesController.untagFace);

export default router;
