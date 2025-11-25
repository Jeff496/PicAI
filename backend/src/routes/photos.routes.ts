// src/routes/photos.routes.ts
// Photo routes for upload, retrieval, and deletion
// All routes require JWT authentication

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as photosController from '../controllers/photos.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { uploadMiddleware } from '../middleware/upload.middleware.js';
import { validateQuery, validateParams } from '../middleware/validate.middleware.js';
import { getPhotosQuerySchema, photoIdSchema } from '../schemas/photo.schema.js';

const router = Router();

/**
 * Rate limiting for photo uploads
 * Prevents abuse while allowing reasonable batch uploads
 *
 * Limits: 20 upload requests per 15 minutes per IP
 * Note: Each request can contain up to 50 files
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 upload requests per window
  message: {
    success: false,
    error: 'Too many upload requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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

export default router;
