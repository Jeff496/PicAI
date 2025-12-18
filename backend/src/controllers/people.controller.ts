// src/controllers/people.controller.ts
// People (persons) controller for managing known faces in a user's collection

import type { Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { rekognitionService } from '../services/rekognitionService.js';
import logger from '../utils/logger.js';
import type { GetPeopleQuery } from '../schemas/people.schema.js';

/**
 * List all people in user's face collection
 *
 * GET /people
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "people": [{
 *     "id": "uuid",
 *     "name": "Mom",
 *     "photoCount": 5,
 *     "createdAt": "2025-12-01T..."
 *   }],
 *   "pagination": { "limit": 50, "offset": 0, "total": 10 }
 * }
 */
export const getPeople = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const { limit, offset } = req.parsedQuery as GetPeopleQuery;

  // Get user's face collection
  const collection = await prisma.faceCollection.findUnique({
    where: { userId: req.user.id },
  });

  if (!collection) {
    // No collection yet = no people
    res.json({
      success: true,
      people: [],
      pagination: { limit, offset, total: 0 },
    });
    return;
  }

  // Get people with face count
  const people = await prisma.person.findMany({
    where: { collectionId: collection.id },
    include: {
      _count: {
        select: { faces: true },
      },
    },
    orderBy: { name: 'asc' },
    take: limit,
    skip: offset,
  });

  const total = await prisma.person.count({
    where: { collectionId: collection.id },
  });

  res.json({
    success: true,
    people: people.map((person) => ({
      id: person.id,
      name: person.name,
      photoCount: person._count.faces,
      createdAt: person.createdAt,
    })),
    pagination: { limit, offset, total },
  });
};

/**
 * Get a single person by ID
 *
 * GET /people/:id
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "person": {
 *     "id": "uuid",
 *     "name": "Mom",
 *     "photoCount": 5,
 *     "createdAt": "2025-12-01T...",
 *     "updatedAt": "2025-12-01T..."
 *   }
 * }
 */
export const getPersonById = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const personId = req.params.id;
  if (!personId) {
    res.status(400).json({
      success: false,
      error: 'Person ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  // Get person and verify ownership
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      collection: {
        select: { userId: true },
      },
      _count: {
        select: { faces: true },
      },
    },
  });

  if (!person) {
    res.status(404).json({
      success: false,
      error: 'Person not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Verify ownership
  if (person.collection.userId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return;
  }

  res.json({
    success: true,
    person: {
      id: person.id,
      name: person.name,
      photoCount: person._count.faces,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    },
  });
};

/**
 * Update a person's name
 *
 * PUT /people/:id
 * Headers: Authorization: Bearer <token>
 *
 * Body:
 * {
 *   "name": "New Name"
 * }
 *
 * Response (200):
 * {
 *   "success": true,
 *   "person": { "id": "uuid", "name": "New Name" }
 * }
 */
export const updatePerson = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const personId = req.params.id;
  if (!personId) {
    res.status(400).json({
      success: false,
      error: 'Person ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  const { name } = req.body as { name: string };

  // Get person and verify ownership
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      collection: {
        select: { userId: true },
      },
    },
  });

  if (!person) {
    res.status(404).json({
      success: false,
      error: 'Person not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  if (person.collection.userId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return;
  }

  // Update person
  const updatedPerson = await prisma.person.update({
    where: { id: personId },
    data: { name },
  });

  logger.info('Person updated', {
    personId,
    name,
    userId: req.user.id,
  });

  res.json({
    success: true,
    person: {
      id: updatedPerson.id,
      name: updatedPerson.name,
    },
  });
};

/**
 * Delete a person (removes all face tags and from AWS collection)
 *
 * DELETE /people/:id
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Person deleted"
 * }
 */
export const deletePerson = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const personId = req.params.id;
  if (!personId) {
    res.status(400).json({
      success: false,
      error: 'Person ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  // Get person with faces and verify ownership
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      collection: {
        select: { userId: true, awsCollectionId: true },
      },
      faces: {
        where: { indexed: true },
        select: { awsFaceId: true },
      },
    },
  });

  if (!person) {
    res.status(404).json({
      success: false,
      error: 'Person not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  if (person.collection.userId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return;
  }

  // Remove all indexed faces from AWS collection
  // Wrap in try-catch to prevent AWS failures from blocking person deletion
  for (const face of person.faces) {
    if (face.awsFaceId) {
      try {
        await rekognitionService.removeFace(person.collection.awsCollectionId, face.awsFaceId);
      } catch (awsError) {
        // Log warning but continue - don't let AWS failure block deletion
        logger.warn('Failed to remove face from AWS collection during person deletion', {
          personId,
          faceId: face.awsFaceId,
          collectionId: person.collection.awsCollectionId,
          error: awsError instanceof Error ? awsError.message : 'Unknown error',
        });
      }
    }
  }

  // Delete person (faces will be unlinked via onDelete: SetNull)
  await prisma.person.delete({
    where: { id: personId },
  });

  logger.info('Person deleted', {
    personId,
    name: person.name,
    facesRemoved: person.faces.length,
    userId: req.user.id,
  });

  res.json({
    success: true,
    message: 'Person deleted',
  });
};

/**
 * Get all photos containing a person
 *
 * GET /people/:id/photos
 * Headers: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   "success": true,
 *   "photos": [{
 *     "id": "uuid",
 *     "thumbnailUrl": "/api/photos/uuid/thumbnail",
 *     "uploadedAt": "2025-12-01T..."
 *   }]
 * }
 */
export const getPersonPhotos = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  const personId = req.params.id;
  if (!personId) {
    res.status(400).json({
      success: false,
      error: 'Person ID is required',
      code: 'MISSING_ID',
    });
    return;
  }

  // Get person and verify ownership
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      collection: {
        select: { userId: true },
      },
    },
  });

  if (!person) {
    res.status(404).json({
      success: false,
      error: 'Person not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  if (person.collection.userId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return;
  }

  // Get photos containing this person
  const faces = await prisma.face.findMany({
    where: { personId },
    include: {
      photo: {
        select: {
          id: true,
          filename: true,
          originalName: true,
          uploadedAt: true,
        },
      },
    },
    orderBy: {
      photo: {
        uploadedAt: 'desc',
      },
    },
  });

  // Deduplicate photos (a person might have multiple faces in one photo)
  const photoMap = new Map<string, (typeof faces)[0]['photo']>();
  for (const face of faces) {
    if (!photoMap.has(face.photo.id)) {
      photoMap.set(face.photo.id, face.photo);
    }
  }

  const photos = Array.from(photoMap.values());

  res.json({
    success: true,
    photos: photos.map((photo) => ({
      id: photo.id,
      filename: photo.filename,
      originalName: photo.originalName,
      thumbnailUrl: `/api/photos/${photo.id}/thumbnail`,
      uploadedAt: photo.uploadedAt,
    })),
  });
};
