// src/controllers/faces.controller.ts
// Face detection and tagging controller
// Handles face detection, tagging, and person management

import type { Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { rekognitionService, type BoundingBox } from '../services/rekognitionService.js';
import logger from '../utils/logger.js';

/**
 * Detect faces in a photo
 *
 * POST /photos/:id/detect-faces
 * Headers: Authorization: Bearer <token>
 *
 * This is a manual trigger for face detection to conserve API calls.
 * Detected faces are stored in the database. If the user has previously tagged faces,
 * the system will search for matches and either auto-tag (>90% similarity) or
 * return suggestions (80-90% similarity).
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "3 face(s) detected, 2 recognized",
 *   "faces": [{
 *     "id": "uuid",
 *     "boundingBox": { "left": 0.1, "top": 0.2, "width": 0.3, "height": 0.4 },
 *     "confidence": 95.5,
 *     "indexed": true,
 *     "person": { "id": "uuid", "name": "Mom" } | null,
 *     "match": { "personId": "uuid", "personName": "Mom", "similarity": 85.5 } | null
 *   }]
 * }
 *
 * - indexed=true + person: Face was auto-tagged (>90% match)
 * - match: Face has a suggestion (80-90% match), user should confirm
 * - Neither: No match found, user can manually tag
 *
 * Errors:
 * - 401 NO_USER: Authentication required
 * - 403 FORBIDDEN: No access to this photo
 * - 404 NOT_FOUND: Photo not found
 */
export const detectFaces = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const photoId = req.params.id;

  if (!photoId) {
    res.status(400).json({
      success: false,
      error: 'Photo ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  // Verify photo exists and user has access
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      userId: true,
      groupId: true,
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

  // Detect faces using AWS Rekognition
  const detectedFaces = await rekognitionService.detectFacesForPhoto(photoId);

  // Count auto-tagged and suggestions
  const autoTagged = detectedFaces.filter((f) => f.indexed && f.person).length;
  const suggestions = detectedFaces.filter((f) => f.match).length;
  const recognized = autoTagged + suggestions;

  logger.info('Face detection completed', {
    photoId,
    userId: req.user.id,
    facesDetected: detectedFaces.length,
    autoTagged,
    suggestions,
  });

  // Build message
  let message = `${detectedFaces.length} face(s) detected`;
  if (recognized > 0) {
    message += `, ${recognized} recognized`;
    if (autoTagged > 0) {
      message += ` (${autoTagged} auto-tagged)`;
    }
  }

  res.json({
    success: true,
    message,
    faces: detectedFaces,
  });
};

/**
 * Get faces detected in a photo
 *
 * GET /photos/:id/faces
 * Headers: Authorization: Bearer <token>
 *
 * Note: This returns stored faces. The `match` field will always be null here
 * since match suggestions are only computed during detection. To get fresh
 * match suggestions, use POST /photos/:id/detect-faces.
 *
 * Response (200):
 * {
 *   "success": true,
 *   "faces": [{
 *     "id": "uuid",
 *     "boundingBox": { "left": 0.1, "top": 0.2, "width": 0.3, "height": 0.4 },
 *     "confidence": 95.5,
 *     "indexed": false,
 *     "person": null | { "id": "uuid", "name": "Mom" },
 *     "match": null
 *   }]
 * }
 */
export const getFaces = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const photoId = req.params.id;
  if (!photoId) {
    res.status(400).json({
      success: false,
      error: 'Photo ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  // Verify photo exists and user has access
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      userId: true,
      groupId: true,
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

  // Get faces with person info
  const faces = await prisma.face.findMany({
    where: { photoId },
    include: {
      person: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  res.json({
    success: true,
    faces: faces.map((face) => ({
      id: face.id,
      boundingBox: face.boundingBox as unknown as BoundingBox,
      confidence: face.confidence,
      indexed: face.indexed,
      person: face.person
        ? {
            id: face.person.id,
            name: face.person.name,
          }
        : null,
      match: null, // Match suggestions are only computed during detection
    })),
  });
};

/**
 * Tag a face (link to person and index to AWS)
 *
 * POST /faces/:id/tag
 * Headers: Authorization: Bearer <token>
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
export const tagFace = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const faceId = req.params.id;
  if (!faceId) {
    res.status(400).json({
      success: false,
      error: 'Face ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  const { personId, personName } = req.body as { personId?: string; personName?: string };

  // Get face with photo info
  const face = await prisma.face.findUnique({
    where: { id: faceId },
    include: {
      photo: {
        select: {
          id: true,
          userId: true,
          groupId: true,
          filePath: true,
        },
      },
    },
  });

  if (!face) {
    res.status(404).json({
      success: false,
      error: 'Face not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Check permission - only photo owner can tag faces (they own the collection)
  if (face.photo.userId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'Only photo owner can tag faces',
      code: 'FORBIDDEN',
    });
    return;
  }

  // Ensure user's face collection exists
  const collectionId = await rekognitionService.ensureUserCollection(req.user.id);

  // Get or create person
  let person;
  if (personId) {
    // Link to existing person
    person = await prisma.person.findFirst({
      where: {
        id: personId,
        collection: { userId: req.user.id },
      },
    });

    if (!person) {
      res.status(404).json({
        success: false,
        error: 'Person not found in your collection',
        code: 'PERSON_NOT_FOUND',
      });
      return;
    }
  } else if (personName) {
    // Create new person
    const userCollection = await prisma.faceCollection.findUnique({
      where: { userId: req.user.id },
    });

    if (!userCollection) {
      res.status(500).json({
        success: false,
        error: 'Face collection not found',
        code: 'COLLECTION_ERROR',
      });
      return;
    }

    person = await prisma.person.create({
      data: {
        name: personName,
        collectionId: userCollection.id,
      },
    });

    logger.info('Person created', {
      personId: person.id,
      name: personName,
      userId: req.user.id,
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'Either personId or personName is required',
      code: 'INVALID_REQUEST',
    });
    return;
  }

  // Index face to AWS collection (if not already indexed)
  let awsFaceId = face.awsFaceId;
  if (!face.indexed) {
    const fs = await import('fs/promises');
    const imageBuffer = await fs.readFile(face.photo.filePath);

    const indexResult = await rekognitionService.indexFace(
      collectionId,
      imageBuffer,
      faceId // Use face ID as external image ID
    );

    if (indexResult) {
      awsFaceId = indexResult.awsFaceId;
    }
  }

  // Update face record
  const updatedFace = await prisma.face.update({
    where: { id: faceId },
    data: {
      personId: person.id,
      awsFaceId,
      indexed: !!awsFaceId,
    },
  });

  logger.info('Face tagged', {
    faceId,
    personId: person.id,
    personName: person.name,
    indexed: updatedFace.indexed,
    userId: req.user.id,
  });

  res.json({
    success: true,
    face: {
      id: updatedFace.id,
      indexed: updatedFace.indexed,
      awsFaceId: updatedFace.awsFaceId,
    },
    person: {
      id: person.id,
      name: person.name,
    },
  });
};

/**
 * Remove face tag (unlink from person, optionally remove from AWS)
 *
 * DELETE /faces/:id/tag
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Face tag removed"
 * }
 */
export const untagFace = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const faceId = req.params.id;
  if (!faceId) {
    res.status(400).json({
      success: false,
      error: 'Face ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  // Get face with photo info
  const face = await prisma.face.findUnique({
    where: { id: faceId },
    include: {
      photo: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!face) {
    res.status(404).json({
      success: false,
      error: 'Face not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Check permission
  if (face.photo.userId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'Only photo owner can untag faces',
      code: 'FORBIDDEN',
    });
    return;
  }

  // Remove from AWS collection if indexed
  if (face.indexed && face.awsFaceId) {
    const collection = await prisma.faceCollection.findUnique({
      where: { userId: req.user.id },
    });

    if (collection) {
      await rekognitionService.removeFace(collection.awsCollectionId, face.awsFaceId);
    }
  }

  // Update face record (keep the detected face, just remove the tag)
  await prisma.face.update({
    where: { id: faceId },
    data: {
      personId: null,
      awsFaceId: null,
      indexed: false,
    },
  });

  logger.info('Face untagged', {
    faceId,
    userId: req.user.id,
  });

  res.json({
    success: true,
    message: 'Face tag removed',
  });
};

/**
 * Bulk detect faces in multiple photos
 *
 * POST /photos/bulk-detect-faces
 * Headers: Authorization: Bearer <token>
 * Body: { "photoIds": ["uuid1", "uuid2", ...] }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Bulk face detection complete",
 *   "results": [{ "photoId": "...", "success": true, "facesDetected": 3 }],
 *   "summary": { "total": 10, "succeeded": 8, "failed": 2, "totalFacesDetected": 25 }
 * }
 */
export const bulkDetectFaces = async (req: Request, res: Response): Promise<void> => {
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

  // Limit to 20 photos per request (face detection is rate limited)
  if (photoIds.length > 20) {
    res.status(400).json({
      success: false,
      error: 'Maximum 20 photos per bulk face detection request',
      code: 'TOO_MANY_PHOTOS',
    });
    return;
  }

  // Verify user has access to all photos
  const photos = await prisma.photo.findMany({
    where: {
      id: { in: photoIds },
      OR: [
        { userId: req.user.id },
        {
          group: {
            members: {
              some: { userId: req.user.id },
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  const accessiblePhotoIds = new Set(photos.map((p) => p.id));
  const results: Array<{
    photoId: string;
    success: boolean;
    facesDetected?: number;
    error?: string;
  }> = [];
  let totalFacesDetected = 0;

  // Process each photo
  for (const photoId of photoIds) {
    if (!accessiblePhotoIds.has(photoId)) {
      results.push({ photoId, success: false, error: 'Photo not found or access denied' });
      continue;
    }

    try {
      const detectedFaces = await rekognitionService.detectFacesForPhoto(photoId);
      const facesDetected = detectedFaces.length;
      totalFacesDetected += facesDetected;
      results.push({ photoId, success: true, facesDetected });
    } catch (error) {
      results.push({
        photoId,
        success: false,
        error: error instanceof Error ? error.message : 'Face detection failed',
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info('Bulk face detection completed', {
    userId: req.user.id,
    total: photoIds.length,
    succeeded,
    failed,
    totalFacesDetected,
  });

  res.json({
    success: true,
    message: `Bulk face detection complete: ${succeeded} succeeded, ${failed} failed, ${totalFacesDetected} faces detected`,
    results,
    summary: {
      total: photoIds.length,
      succeeded,
      failed,
      totalFacesDetected,
    },
  });
};
