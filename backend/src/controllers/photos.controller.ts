// src/controllers/photos.controller.ts
// Photo controller handling upload, retrieval, and deletion of photos
// Uses fileService for file operations and Prisma for database access

import type { Request, Response } from 'express';
import type { Prisma } from '../generated/prisma/client.js';
import prisma from '../prisma/client.js';
import { fileService, type SavePhotoResult } from '../services/fileService.js';
import { rekognitionService, type DetectedFaceWithMatch } from '../services/rekognitionService.js';
import { ingestService } from '../services/ingestService.js';
import logger from '../utils/logger.js';
import type { UploadPhotoRequest, GetPhotosQuery } from '../schemas/photo.schema.js';

/**
 * Upload one or more photos
 *
 * POST /photos/upload
 * POST /photos/upload?detectFaces=true (optional: run face detection after upload)
 * Headers: Authorization: Bearer <token>
 * Body: multipart/form-data with 'photos' field (1-50 files)
 * Optional body fields: groupId
 *
 * Response (201):
 * {
 *   "success": true,
 *   "message": "X photo(s) uploaded successfully",
 *   "photos": [{
 *     id, filename, originalName, uploadedAt, thumbnailUrl,
 *     faces?: [{ id, boundingBox, confidence, indexed, person, match }] // only if detectFaces=true
 *   }]
 * }
 *
 * When detectFaces=true:
 * - Face detection runs on each uploaded photo
 * - If user has tagged faces before, matches are found and auto-tagged (>90%) or suggested (80-90%)
 * - Response includes face data for each photo
 *
 * Errors:
 * - 400 NO_FILES: No files provided
 * - 401 NO_USER: Authentication required
 * - 403 NOT_GROUP_MEMBER: User is not a member of the specified group
 */
export const uploadPhotos = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({
      success: false,
      error: 'No files provided',
      code: 'NO_FILES',
    });
    return;
  }

  const { groupId } = req.body as UploadPhotoRequest;

  // If groupId provided, verify user is a member
  if (groupId) {
    const membership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId: req.user.id,
      },
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        error: 'Not a member of this group',
        code: 'NOT_GROUP_MEMBER',
      });
      return;
    }
  }

  // Process each file - track saved files for cleanup on failure
  const uploadedPhotos = [];
  const savedFiles: SavePhotoResult[] = [];

  try {
    for (const file of files) {
      // Save photo and generate thumbnail
      const result = await fileService.savePhoto(file.buffer, file.originalname, file.mimetype);
      savedFiles.push(result);

      // Create database record
      const photo = await prisma.photo.create({
        data: {
          userId: req.user.id,
          groupId: groupId || null,
          filename: result.metadata.filename,
          originalName: file.originalname,
          filePath: result.originalPath,
          thumbnailPath: result.thumbnailPath,
          mimeType: result.metadata.mimeType,
          fileSize: result.metadata.fileSize,
          width: result.metadata.width,
          height: result.metadata.height,
        },
      });

      logger.info('Photo uploaded', {
        photoId: photo.id,
        userId: req.user.id,
        filename: photo.filename,
      });

      uploadedPhotos.push(photo);
    }

    // AI analysis is NOT triggered here — the frontend handles it via SSE
    // (/ai/analyze-bulk-progress) so the user sees per-photo progress in real-time

    // Check if face detection is requested
    const detectFaces = req.query.detectFaces === 'true';
    const facesMap: Map<string, DetectedFaceWithMatch[]> = new Map();
    let totalFaces = 0;
    let totalAutoTagged = 0;
    let totalSuggestions = 0;

    if (detectFaces) {
      logger.info('Running face detection on uploaded photos', {
        photoCount: uploadedPhotos.length,
        userId: req.user.id,
      });

      // Run face detection on each photo
      for (const photo of uploadedPhotos) {
        try {
          const faces = await rekognitionService.detectFacesForPhoto(photo.id);
          facesMap.set(photo.id, faces);
          totalFaces += faces.length;
          totalAutoTagged += faces.filter((f) => f.indexed && f.person).length;
          totalSuggestions += faces.filter((f) => f.match).length;
        } catch (err) {
          logger.error('Face detection failed for photo', {
            photoId: photo.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
          // Continue with other photos even if one fails
          facesMap.set(photo.id, []);
        }
      }

      logger.info('Face detection complete for batch upload', {
        photoCount: uploadedPhotos.length,
        totalFaces,
        autoTagged: totalAutoTagged,
        suggestions: totalSuggestions,
      });
    }

    // Build response message
    let message = `${uploadedPhotos.length} photo(s) uploaded successfully`;
    if (detectFaces && totalFaces > 0) {
      const recognized = totalAutoTagged + totalSuggestions;
      message += `, detected ${totalFaces} face(s)`;
      if (recognized > 0) {
        message += `, ${recognized} recognized`;
        if (totalAutoTagged > 0) {
          message += ` (${totalAutoTagged} auto-tagged)`;
        }
      }
    }

    res.status(201).json({
      success: true,
      message,
      photos: uploadedPhotos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
        originalName: photo.originalName,
        uploadedAt: photo.uploadedAt,
        thumbnailUrl: `/api/photos/${photo.id}/thumbnail`,
        ...(detectFaces && { faces: facesMap.get(photo.id) || [] }),
      })),
    });
  } catch (error) {
    // Clean up any files that were saved before the error
    if (savedFiles.length > 0) {
      logger.warn('Batch upload failed, cleaning up partial uploads', {
        savedCount: savedFiles.length,
        totalFiles: files.length,
      });
      await fileService.cleanupPartialUpload(savedFiles);

      // Also clean up any database records that were created
      // (photos that succeeded before the failure)
      if (uploadedPhotos.length > 0) {
        const photoIds = uploadedPhotos.map((p) => p.id);
        await prisma.photo.deleteMany({
          where: { id: { in: photoIds } },
        });
        logger.info('Cleaned up partial database records', { count: uploadedPhotos.length });
      }
    }

    // Re-throw to let error middleware handle it
    throw error;
  }
};

/**
 * List user's photos with pagination
 *
 * GET /photos
 * Headers: Authorization: Bearer <token>
 * Query: ?groupId=uuid&limit=50&offset=0
 *
 * Response (200):
 * {
 *   "success": true,
 *   "photos": [{ id, filename, originalName, uploadedAt, thumbnailUrl, fileUrl, tags }],
 *   "pagination": { limit, offset, total }
 * }
 */
export const getPhotos = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  // Get parsed query params from validateQuery middleware (Express 5 req.query is read-only)
  const { groupId, tag, limit, offset } = req.parsedQuery as GetPhotosQuery;

  // Build where clause with support for group filtering
  let whereClause: Prisma.PhotoWhereInput;

  if (groupId === 'all') {
    // All photos user has access to (personal + all groups they're in)
    const memberships = await prisma.groupMembership.findMany({
      where: { userId: req.user.id },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    whereClause = {
      OR: [
        { userId: req.user.id, groupId: null }, // Personal photos
        { groupId: { in: groupIds } }, // Group photos
      ],
    };
  } else if (groupId) {
    // Specific group - verify membership
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } },
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        error: 'Not a member of this group',
        code: 'NOT_GROUP_MEMBER',
      });
      return;
    }

    whereClause = { groupId };
  } else {
    // Default: personal photos only
    whereClause = { userId: req.user.id, groupId: null };
  }

  // Add tag filter if provided (case-insensitive partial match)
  if (tag) {
    whereClause = {
      ...whereClause,
      aiTags: {
        some: {
          tag: {
            contains: tag,
            mode: 'insensitive',
          },
          confidence: { gte: 0.5 },
        },
      },
    };
  }

  const photos = await prisma.photo.findMany({
    where: whereClause,
    include: {
      aiTags: {
        where: {
          confidence: { gte: 0.5 },
        },
        orderBy: {
          confidence: 'desc',
        },
      },
    },
    orderBy: {
      uploadedAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  // Get total count for pagination
  const total = await prisma.photo.count({ where: whereClause });

  res.json({
    success: true,
    photos: photos.map((photo) => ({
      id: photo.id,
      filename: photo.filename,
      originalName: photo.originalName,
      uploadedAt: photo.uploadedAt,
      width: photo.width,
      height: photo.height,
      thumbnailUrl: `/api/photos/${photo.id}/thumbnail`,
      fileUrl: `/api/photos/${photo.id}/file`,
      tags: photo.aiTags.map((tag) => ({
        id: tag.id,
        tag: tag.tag,
        confidence: tag.confidence,
        category: tag.category,
      })),
    })),
    pagination: {
      limit,
      offset,
      total,
    },
  });
};

/**
 * Get single photo by ID
 *
 * GET /photos/:id
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "photo": { id, filename, originalName, uploadedAt, ..., tags, albums }
 * }
 *
 * Errors:
 * - 404 NOT_FOUND: Photo not found
 * - 403 FORBIDDEN: User doesn't have access to this photo
 */
export const getPhotoById = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const { id } = req.params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: {
      aiTags: {
        orderBy: {
          confidence: 'desc',
        },
      },
      albums: {
        include: {
          album: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
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

  res.json({
    success: true,
    photo: {
      id: photo.id,
      filename: photo.filename,
      originalName: photo.originalName,
      uploadedAt: photo.uploadedAt,
      takenAt: photo.takenAt,
      width: photo.width,
      height: photo.height,
      fileSize: photo.fileSize,
      mimeType: photo.mimeType,
      thumbnailUrl: `/api/photos/${photo.id}/thumbnail`,
      fileUrl: `/api/photos/${photo.id}/file`,
      tags: photo.aiTags.map((tag) => ({
        id: tag.id,
        tag: tag.tag,
        confidence: tag.confidence,
        category: tag.category,
      })),
      albums: photo.albums.map((ap) => ({
        id: ap.album.id,
        name: ap.album.name,
      })),
    },
  });
};

/**
 * Stream original photo file
 *
 * GET /photos/:id/file
 * Headers: Authorization: Bearer <token>
 *
 * Response: Image file stream with appropriate Content-Type
 *
 * Errors:
 * - 404 NOT_FOUND: Photo not found
 * - 403 FORBIDDEN: User doesn't have access to this photo
 */
export const getPhotoFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const { id } = req.params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: {
      userId: true,
      groupId: true,
      filePath: true,
      mimeType: true,
      originalName: true,
    },
  });

  if (!photo) {
    res.status(404).json({
      success: false,
      error: 'Photo not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Check permission
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

  // Set content disposition for download
  res.setHeader('Content-Disposition', `inline; filename="${photo.originalName}"`);

  // Stream file to response
  fileService.streamFile(photo.filePath, photo.mimeType, res);
};

/**
 * Stream thumbnail image
 *
 * GET /photos/:id/thumbnail
 * Headers: Authorization: Bearer <token>
 *
 * Response: JPEG thumbnail stream
 *
 * Errors:
 * - 404 NOT_FOUND: Photo or thumbnail not found
 * - 403 FORBIDDEN: User doesn't have access to this photo
 */
export const getThumbnail = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const { id } = req.params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: {
      userId: true,
      groupId: true,
      thumbnailPath: true,
    },
  });

  if (!photo || !photo.thumbnailPath) {
    res.status(404).json({
      success: false,
      error: 'Thumbnail not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Check permission
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

  // Stream thumbnail (always JPEG)
  fileService.streamFile(photo.thumbnailPath, 'image/jpeg', res);
};

/**
 * Delete photo
 *
 * DELETE /photos/:id
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Photo deleted successfully"
 * }
 *
 * Errors:
 * - 404 NOT_FOUND: Photo not found
 * - 403 FORBIDDEN: Only photo owner can delete
 */
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const { id } = req.params;

  if (!id) {
    res.status(400).json({
      success: false,
      error: 'Photo ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: {
      userId: true,
    },
  });

  if (!photo) {
    res.status(404).json({
      success: false,
      error: 'Photo not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Only owner can delete
  if (photo.userId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'Only photo owner can delete',
      code: 'FORBIDDEN',
    });
    return;
  }

  // Delete files and database record
  await fileService.deletePhoto(id);

  // Remove from RAG index (fire-and-forget)
  ingestService.deletePhoto(id, req.user.id).catch(() => {});

  logger.info('Photo deleted', {
    photoId: id,
    userId: req.user.id,
  });

  res.json({
    success: true,
    message: 'Photo deleted successfully',
  });
};

/**
 * Bulk delete multiple photos
 *
 * DELETE /photos/bulk
 * Headers: Authorization: Bearer <token>
 * Body: { "photoIds": ["uuid1", "uuid2", ...] }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Bulk delete complete",
 *   "results": [{ "photoId": "...", "success": true|false, "error": "..." }],
 *   "summary": { "total": 10, "succeeded": 8, "failed": 2 }
 * }
 */
export const bulkDeletePhotos = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const { photoIds } = req.body as { photoIds: string[] };

  if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
    res.status(400).json({
      success: false,
      error: 'photoIds array is required',
      code: 'INVALID_REQUEST',
    });
    return;
  }

  // Limit to 50 photos per request
  if (photoIds.length > 50) {
    res.status(400).json({
      success: false,
      error: 'Maximum 50 photos per bulk delete request',
      code: 'TOO_MANY_PHOTOS',
    });
    return;
  }

  // Only allow deletion of user's own photos (not group photos)
  const photos = await prisma.photo.findMany({
    where: {
      id: { in: photoIds },
      userId: req.user.id, // Only owner can delete
    },
    select: { id: true },
  });

  const ownedPhotoIds = new Set(photos.map((p) => p.id));
  const results: Array<{ photoId: string; success: boolean; error?: string }> = [];

  // Process each photo
  for (const photoId of photoIds) {
    if (!ownedPhotoIds.has(photoId)) {
      results.push({ photoId, success: false, error: 'Photo not found or access denied' });
      continue;
    }

    try {
      await fileService.deletePhoto(photoId);
      ingestService.deletePhoto(photoId, req.user!.id).catch(() => {});
      results.push({ photoId, success: true });
    } catch (error) {
      results.push({
        photoId,
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info('Bulk photo delete completed', {
    userId: req.user.id,
    total: photoIds.length,
    succeeded,
    failed,
  });

  res.json({
    success: true,
    message: `Bulk delete complete: ${succeeded} succeeded, ${failed} failed`,
    results,
    summary: {
      total: photoIds.length,
      succeeded,
      failed,
    },
  });
};
