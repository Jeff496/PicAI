// src/routes/photos.routes.ts
// Photo routes for upload, retrieval, and deletion
// All routes require JWT authentication

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as photosController from '../controllers/photos.controller.js';
import * as aiController from '../controllers/ai.controller.js';
import * as facesController from '../controllers/faces.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { uploadMiddleware } from '../middleware/upload.middleware.js';
import {
  validateQuery,
  validateParams,
  validateRequest,
} from '../middleware/validate.middleware.js';
import { getPhotosQuerySchema, photoIdSchema } from '../schemas/photo.schema.js';
import { addTagSchema, tagIdParamSchema } from '../schemas/ai.schema.js';

const router = Router();

/**
 * Create a rate limiter with standard configuration
 * @param max - Maximum requests per 15 minute window
 * @param context - Description for error message (e.g., "upload", "face detection")
 */
const createLimiter = (max: number, context: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    message: {
      success: false,
      error: `Too many ${context} requests. Please try again later.`,
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

// Rate limiters for different operations
const uploadLimiter = createLimiter(20, 'upload'); // 20 uploads/15min (each can have 50 files)
const faceDetectionLimiter = createLimiter(50, 'face detection'); // 50/15min (protects AWS free tier)
const tagLimiter = createLimiter(100, 'tag'); // 100 tags/15min

/**
 * Photo Routes
 *
 * All routes require JWT authentication via Authorization header:
 * Authorization: Bearer <access_token>
 *
 * Response format:
 * Success: { success: true, data: {...} }
 * Error: { success: false, error: "message", code: "ERROR_CODE" }
 */

/**
 * POST /photos/upload
 *
 * Upload one or more photos (max 50 per request)
 *
 * Headers:
 * Authorization: Bearer <access_token>
 * Content-Type: multipart/form-data
 *
 * Body (multipart/form-data):
 * - photos: File[] (1-50 image files)
 * - groupId: string (optional, UUID of group to upload to)
 *
 * Response (201):
 * {
 *   "success": true,
 *   "message": "X photo(s) uploaded successfully",
 *   "photos": [{
 *     "id": "uuid",
 *     "filename": "uuid.jpg",
 *     "originalName": "vacation.jpg",
 *     "uploadedAt": "2025-11-25T...",
 *     "thumbnailUrl": "/api/photos/uuid/thumbnail"
 *   }]
 * }
 *
 * Errors:
 * - 400 NO_FILES: No files provided
 * - 400 LIMIT_FILE_SIZE: File exceeds 25MB limit
 * - 400 Invalid file type: Only JPEG, PNG, HEIC/HEIF allowed
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 NOT_GROUP_MEMBER: Not a member of specified group
 * - 429 RATE_LIMIT_EXCEEDED: Too many upload requests
 */
router.post(
  '/upload',
  uploadLimiter, // Rate limit first to block abuse before auth processing
  authenticateJWT,
  uploadMiddleware.array('photos', 50),
  photosController.uploadPhotos
);

/**
 * GET /photos
 *
 * List user's photos with pagination
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Query Parameters:
 * - groupId: string (optional, filter by group)
 * - limit: number (1-100, default 50)
 * - offset: number (default 0)
 *
 * Response (200):
 * {
 *   "success": true,
 *   "photos": [{
 *     "id": "uuid",
 *     "filename": "uuid.jpg",
 *     "originalName": "vacation.jpg",
 *     "uploadedAt": "2025-11-25T...",
 *     "width": 1920,
 *     "height": 1080,
 *     "thumbnailUrl": "/api/photos/uuid/thumbnail",
 *     "fileUrl": "/api/photos/uuid/file",
 *     "tags": [{ "tag": "beach", "confidence": 0.95, "category": "scene" }]
 *   }],
 *   "pagination": { "limit": 50, "offset": 0, "total": 123 }
 * }
 *
 * Errors:
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 NOT_GROUP_MEMBER: Not a member of specified group
 */
router.get('/', authenticateJWT, validateQuery(getPhotosQuerySchema), photosController.getPhotos);

/**
 * GET /photos/:id
 *
 * Get single photo metadata with AI tags and albums
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "photo": {
 *     "id": "uuid",
 *     "filename": "uuid.jpg",
 *     "originalName": "vacation.jpg",
 *     "uploadedAt": "2025-11-25T...",
 *     "takenAt": null,
 *     "width": 1920,
 *     "height": 1080,
 *     "fileSize": 2048576,
 *     "mimeType": "image/jpeg",
 *     "thumbnailUrl": "/api/photos/uuid/thumbnail",
 *     "fileUrl": "/api/photos/uuid/file",
 *     "tags": [{ "tag": "beach", "confidence": 0.95, "category": "scene" }],
 *     "albums": [{ "id": "uuid", "name": "Summer 2025" }]
 *   }
 * }
 *
 * Errors:
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 FORBIDDEN: No access to this photo
 * - 404 NOT_FOUND: Photo not found
 */
router.get('/:id', authenticateJWT, validateParams(photoIdSchema), photosController.getPhotoById);

/**
 * GET /photos/:id/file
 *
 * Stream original photo file
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response: Image file stream with Content-Type header
 *
 * Errors:
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 FORBIDDEN: No access to this photo
 * - 404 NOT_FOUND: Photo not found
 */
router.get(
  '/:id/file',
  authenticateJWT,
  validateParams(photoIdSchema),
  photosController.getPhotoFile
);

/**
 * GET /photos/:id/thumbnail
 *
 * Stream thumbnail image (200x200 JPEG)
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response: JPEG thumbnail stream
 *
 * Errors:
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 FORBIDDEN: No access to this photo
 * - 404 NOT_FOUND: Photo or thumbnail not found
 */
router.get(
  '/:id/thumbnail',
  authenticateJWT,
  validateParams(photoIdSchema),
  photosController.getThumbnail
);

/**
 * DELETE /photos/:id
 *
 * Delete a photo (owner only)
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Photo deleted successfully"
 * }
 *
 * Errors:
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 FORBIDDEN: Only photo owner can delete
 * - 404 NOT_FOUND: Photo not found
 */
router.delete('/:id', authenticateJWT, validateParams(photoIdSchema), photosController.deletePhoto);

/**
 * POST /photos/:id/tags
 *
 * Add a manual tag to a photo
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Body:
 * {
 *   "tag": "vacation",
 *   "category": "manual" (optional, defaults to "manual")
 * }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "tag": {
 *     "id": "uuid",
 *     "tag": "vacation",
 *     "confidence": 1.0,
 *     "category": "manual"
 *   }
 * }
 *
 * Errors:
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 FORBIDDEN: No access to this photo
 * - 404 NOT_FOUND: Photo not found
 */
router.post(
  '/:id/tags',
  tagLimiter,
  authenticateJWT,
  validateParams(photoIdSchema),
  validateRequest(addTagSchema),
  aiController.addTag
);

/**
 * DELETE /photos/:id/tags/:tagId
 *
 * Remove a tag from a photo
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Tag removed"
 * }
 *
 * Errors:
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 FORBIDDEN: No access to this photo
 * - 404 NOT_FOUND: Photo or tag not found
 */
router.delete(
  '/:id/tags/:tagId',
  authenticateJWT,
  validateParams(tagIdParamSchema),
  aiController.removeTag
);

/**
 * POST /photos/:id/detect-faces
 *
 * Manually trigger face detection for a photo
 * Detected faces are stored but NOT indexed to AWS until tagged
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "X face(s) detected",
 *   "faces": [{
 *     "id": "uuid",
 *     "boundingBox": { "left": 0.1, "top": 0.2, "width": 0.3, "height": 0.4 },
 *     "confidence": 95.5
 *   }]
 * }
 *
 * Errors:
 * - 401 NO_TOKEN/TOKEN_EXPIRED: Authentication required
 * - 403 FORBIDDEN: No access to this photo
 * - 404 NOT_FOUND: Photo not found
 */
router.post(
  '/:id/detect-faces',
  faceDetectionLimiter,
  authenticateJWT,
  validateParams(photoIdSchema),
  facesController.detectFaces
);

/**
 * GET /photos/:id/faces
 *
 * Get detected faces in a photo
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "faces": [{
 *     "id": "uuid",
 *     "boundingBox": { "left": 0.1, "top": 0.2, "width": 0.3, "height": 0.4 },
 *     "confidence": 95.5,
 *     "indexed": false,
 *     "person": null | { "id": "uuid", "name": "Mom" }
 *   }]
 * }
 */
router.get('/:id/faces', authenticateJWT, validateParams(photoIdSchema), facesController.getFaces);

export default router;
