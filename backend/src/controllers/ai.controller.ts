// src/controllers/ai.controller.ts
// Controller for AI-related endpoints: analysis and tag management

import type { Request, Response } from 'express';
import { aiService } from '../services/aiService.js';
import prisma from '../prisma/client.js';
import logger from '../utils/logger.js';
import type { AddTagRequest } from '../schemas/ai.schema.js';

/**
 * Analyze a single photo
 *
 * POST /ai/analyze/:photoId
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Analysis complete",
 *   "tags": [{ "tag": "...", "confidence": 0.95, "category": "..." }]
 * }
 *
 * Errors:
 * - 401 NO_USER: Authentication required
 * - 403 FORBIDDEN: User doesn't have access to this photo
 * - 404 NOT_FOUND: Photo not found
 */
export const analyzePhoto = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const photoId = req.params.photoId as string;

  // Verify photo exists and user has access
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { userId: true, groupId: true },
  });

  if (!photo) {
    res.status(404).json({
      success: false,
      error: 'Photo not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Check permission: user owns photo OR is group member
  const isOwner = photo.userId === req.user.id;
  const isGroupMember = photo.groupId
    ? await prisma.groupMembership.findFirst({
        where: {
          groupId: photo.groupId,
          userId: req.user.id,
        },
      })
    : null;

  if (!isOwner && !isGroupMember) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return;
  }

  const tags = await aiService.analyzePhoto(photoId);

  logger.info('Photo analyzed via API', { photoId, userId: req.user.id, tagCount: tags.length });

  res.json({
    success: true,
    message: 'Analysis complete',
    tags: tags.map((tag) => ({
      tag: tag.tag,
      confidence: tag.confidence,
      category: tag.category,
    })),
  });
};

/**
 * Analyze all photos without AI tags
 *
 * POST /ai/analyze-missing
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Queued X photos for analysis",
 *   "queued": 15,
 *   "alreadyTagged": 42,
 *   "total": 57
 * }
 */
export const analyzeMissingPhotos = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  // Only analyze the user's own photos (not group photos)
  const result = await aiService.analyzePhotosWithoutTags(req.user.id);

  logger.info('Batch analysis requested', {
    userId: req.user.id,
    ...result,
  });

  res.json({
    success: true,
    message: result.queued > 0 ? `Queued ${result.queued} photo(s) for analysis` : 'All photos already have tags',
    queued: result.queued,
    alreadyTagged: result.alreadyTagged,
    total: result.total,
  });
};

/**
 * Get AI analysis queue status
 *
 * GET /ai/status
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "queueLength": 5
 * }
 */
export const getAnalysisStatus = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const status = aiService.getQueueStatus();

  res.json({
    success: true,
    ...status,
  });
};

/**
 * Add a manual tag to a photo
 *
 * POST /photos/:id/tags
 * Headers: Authorization: Bearer <token>
 * Body: { "tag": "vacation", "category": "manual" }
 *
 * Response (201):
 * {
 *   "success": true,
 *   "tag": { "id": "...", "tag": "vacation", "confidence": 1.0, "category": "manual" }
 * }
 *
 * Errors:
 * - 401 NO_USER: Authentication required
 * - 403 FORBIDDEN: User doesn't have access to this photo
 * - 404 NOT_FOUND: Photo not found
 */
export const addTag = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const id = req.params.id as string;
  const { tag, category } = req.body as AddTagRequest;

  // Verify photo exists and user has access
  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { userId: true, groupId: true },
  });

  if (!photo) {
    res.status(404).json({
      success: false,
      error: 'Photo not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Check permission: user owns photo OR is group member
  const isOwner = photo.userId === req.user.id;
  const isGroupMember = photo.groupId
    ? await prisma.groupMembership.findFirst({
        where: {
          groupId: photo.groupId,
          userId: req.user.id,
        },
      })
    : null;

  if (!isOwner && !isGroupMember) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return;
  }

  const newTag = await aiService.addManualTag(id, tag, category);

  logger.info('Manual tag added via API', { photoId: id, userId: req.user.id, tag });

  res.status(201).json({
    success: true,
    tag: newTag,
  });
};

/**
 * Remove a tag from a photo
 *
 * DELETE /photos/:id/tags/:tagId
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Tag removed"
 * }
 *
 * Errors:
 * - 401 NO_USER: Authentication required
 * - 403 FORBIDDEN: User doesn't have access to this photo
 * - 404 NOT_FOUND: Photo or tag not found
 */
export const removeTag = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const id = req.params.id as string;
  const tagId = req.params.tagId as string;

  // Verify photo exists and user has access
  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { userId: true, groupId: true },
  });

  if (!photo) {
    res.status(404).json({
      success: false,
      error: 'Photo not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Check permission: user owns photo OR is group member
  const isOwner = photo.userId === req.user.id;
  const isGroupMember = photo.groupId
    ? await prisma.groupMembership.findFirst({
        where: {
          groupId: photo.groupId,
          userId: req.user.id,
        },
      })
    : null;

  if (!isOwner && !isGroupMember) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return;
  }

  try {
    await aiService.removeTag(id, tagId);

    logger.info('Tag removed via API', { photoId: id, tagId, userId: req.user.id });

    res.json({
      success: true,
      message: 'Tag removed',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Tag not found') {
      res.status(404).json({
        success: false,
        error: 'Tag not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    throw error;
  }
};
