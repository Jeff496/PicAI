// src/routes/ai.routes.ts
// AI analysis routes for photo tagging and re-analysis
// All routes require JWT authentication

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as aiController from '../controllers/ai.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * Rate limiting for AI analysis requests
 * Prevents abuse of Azure API (free tier: 20/min, 5000/month)
 *
 * Limits: 30 analysis requests per 15 minutes per IP
 * This is conservative to protect the Azure free tier quota
 */
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: {
    success: false,
    error: 'Too many analysis requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI Analysis Routes
 *
 * All routes require JWT authentication via Authorization header:
 * Authorization: Bearer <access_token>
 *
 * Response format:
 * Success: { success: true, data: {...} }
 * Error: { success: false, error: "message", code: "ERROR_CODE" }
 */

// ============================================
// Bulk Operations (must come before /:photoId routes)
// ============================================

/**
 * POST /ai/analyze/bulk
 *
 * Bulk analyze multiple photos using Azure Computer Vision
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Body:
 * {
 *   "photoIds": ["uuid1", "uuid2", ...]
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Bulk analysis complete: X succeeded, Y failed",
 *   "results": [{ "photoId": "...", "success": true|false, "error": "..." }],
 *   "summary": { "total": 10, "succeeded": 8, "failed": 2 }
 * }
 *
 * Errors:
 * - 400 INVALID_REQUEST: Invalid photoIds
 * - 400 TOO_MANY_PHOTOS: More than 50 photos
 * - 401 NO_USER: Authentication required
 * - 429 RATE_LIMIT_EXCEEDED: Too many requests
 */
router.post('/analyze/bulk', analysisLimiter, authenticateJWT, aiController.bulkAnalyzePhotos);

// ============================================
// Single Photo Routes
// ============================================

/**
 * POST /ai/analyze/:photoId
 *
 * Analyze or re-analyze a single photo using Azure Computer Vision
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Analysis complete",
 *   "tags": [{
 *     "tag": "dog",
 *     "confidence": 0.95,
 *     "category": "object"
 *   }]
 * }
 *
 * Errors:
 * - 401 NO_USER: Authentication required
 * - 403 FORBIDDEN: No access to this photo
 * - 404 NOT_FOUND: Photo not found
 * - 429 RATE_LIMIT_EXCEEDED: Too many requests
 */
router.post('/analyze/:photoId', analysisLimiter, authenticateJWT, aiController.analyzePhoto);

/**
 * POST /ai/analyze-missing
 *
 * Queue all user's photos without AI tags for analysis
 * Analysis runs asynchronously in background
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Queued 15 photo(s) for analysis",
 *   "queued": 15,
 *   "alreadyTagged": 42,
 *   "total": 57
 * }
 *
 * Errors:
 * - 401 NO_USER: Authentication required
 * - 429 RATE_LIMIT_EXCEEDED: Too many requests
 */
router.post(
  '/analyze-missing',
  analysisLimiter,
  authenticateJWT,
  aiController.analyzeMissingPhotos
);

/**
 * GET /ai/status
 *
 * Get current AI analysis queue status
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "queueLength": 5
 * }
 *
 * Errors:
 * - 401 NO_USER: Authentication required
 */
router.get('/status', authenticateJWT, aiController.getAnalysisStatus);

export default router;
