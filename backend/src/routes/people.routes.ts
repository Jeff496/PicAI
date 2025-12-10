// src/routes/people.routes.ts
// People (persons) routes for managing known faces
// All routes require JWT authentication

import { Router } from 'express';
import * as peopleController from '../controllers/people.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import {
  validateParams,
  validateQuery,
  validateRequest,
} from '../middleware/validate.middleware.js';
import {
  personIdSchema,
  updatePersonSchema,
  getPeopleQuerySchema,
} from '../schemas/people.schema.js';

const router = Router();

/**
 * People Routes
 *
 * All routes require JWT authentication via Authorization header:
 * Authorization: Bearer <access_token>
 */

/**
 * GET /people
 *
 * List all people in user's face collection
 *
 * Query Parameters:
 * - limit: number (1-100, default 50)
 * - offset: number (default 0)
 *
 * Response (200):
 * {
 *   "success": true,
 *   "people": [{ id, name, photoCount, createdAt }],
 *   "pagination": { limit, offset, total }
 * }
 */
router.get('/', authenticateJWT, validateQuery(getPeopleQuerySchema), peopleController.getPeople);

/**
 * GET /people/:id
 *
 * Get a single person by ID
 *
 * Response (200):
 * {
 *   "success": true,
 *   "person": { id, name, photoCount, createdAt, updatedAt }
 * }
 */
router.get('/:id', authenticateJWT, validateParams(personIdSchema), peopleController.getPersonById);

/**
 * PUT /people/:id
 *
 * Update a person's name
 *
 * Body:
 * {
 *   "name": "New Name"
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "person": { id, name }
 * }
 */
router.put(
  '/:id',
  authenticateJWT,
  validateParams(personIdSchema),
  validateRequest(updatePersonSchema),
  peopleController.updatePerson
);

/**
 * DELETE /people/:id
 *
 * Delete a person (removes all face tags and from AWS collection)
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Person deleted"
 * }
 */
router.delete(
  '/:id',
  authenticateJWT,
  validateParams(personIdSchema),
  peopleController.deletePerson
);

/**
 * GET /people/:id/photos
 *
 * Get all photos containing a person
 *
 * Response (200):
 * {
 *   "success": true,
 *   "photos": [{ id, thumbnailUrl, uploadedAt }]
 * }
 */
router.get(
  '/:id/photos',
  authenticateJWT,
  validateParams(personIdSchema),
  peopleController.getPersonPhotos
);

export default router;
