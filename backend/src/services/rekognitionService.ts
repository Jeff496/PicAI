// src/services/rekognitionService.ts
// AWS Rekognition Face Collections Service
// Uses IAM Roles Anywhere for authentication (certificate-based, no static credentials)

import {
  RekognitionClient,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  DetectFacesCommand,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
  type BoundingBox as AWSBoundingBox,
} from '@aws-sdk/client-rekognition';
import { fromProcess } from '@aws-sdk/credential-providers';
import { env } from '../config/env.js';
import prisma from '../prisma/client.js';
import logger from '../utils/logger.js';

/**
 * Bounding box for a detected face (percentages 0-1)
 */
export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Detected face from Rekognition (not yet indexed)
 */
export interface DetectedFace {
  boundingBox: BoundingBox;
  confidence: number;
}

/**
 * Indexed face result
 */
export interface IndexedFace {
  awsFaceId: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

/**
 * Face search match result
 */
export interface FaceMatch {
  awsFaceId: string;
  similarity: number;
  externalImageId?: string;
}

/**
 * Configuration constants
 */
const FACE_DETECTION_THRESHOLD = 90; // Only store faces with >90% confidence
const FACE_MATCH_THRESHOLD = 80; // Consider match if >80% similarity
const MAX_FACES_TO_DETECT = 10; // Limit faces per photo

/**
 * Convert AWS BoundingBox to our format
 */
function convertBoundingBox(awsBox: AWSBoundingBox | undefined): BoundingBox | undefined {
  if (!awsBox) return undefined;
  return {
    left: awsBox.Left ?? 0,
    top: awsBox.Top ?? 0,
    width: awsBox.Width ?? 0,
    height: awsBox.Height ?? 0,
  };
}

/**
 * AWS Rekognition Service for Face Collections
 *
 * Uses IAM Roles Anywhere with X.509 certificates for authentication.
 * The AWS_PROFILE environment variable references a profile in ~/.aws/config
 * that uses credential_process to obtain temporary credentials.
 */
class RekognitionService {
  private client: RekognitionClient;

  constructor() {
    this.client = new RekognitionClient({
      region: env.AWS_REGION,
      credentials: fromProcess({
        profile: env.AWS_PROFILE,
      }),
    });

    logger.info('RekognitionService initialized', {
      region: env.AWS_REGION,
      profile: env.AWS_PROFILE,
    });
  }

  /**
   * Ensure a user's face collection exists (lazy creation)
   * Called when first face is indexed for a user
   *
   * @param userId - User UUID
   * @returns AWS collection ID
   */
  async ensureUserCollection(userId: string): Promise<string> {
    // Check if collection exists in database
    let collection = await prisma.faceCollection.findUnique({
      where: { userId },
    });

    if (collection) {
      return collection.awsCollectionId;
    }

    // Create new collection
    const awsCollectionId = `picai-user-${userId}`;

    try {
      await this.client.send(
        new CreateCollectionCommand({
          CollectionId: awsCollectionId,
        })
      );

      logger.info('Created AWS face collection', { userId, awsCollectionId });
    } catch (error) {
      // Collection might already exist in AWS (from previous failed DB save)
      if (error instanceof ResourceAlreadyExistsException) {
        logger.warn('AWS collection already exists, continuing', { awsCollectionId });
      } else {
        throw error;
      }
    }

    // Save to database
    collection = await prisma.faceCollection.create({
      data: {
        userId,
        awsCollectionId,
      },
    });

    logger.info('Face collection created', { userId, awsCollectionId, collectionId: collection.id });

    return collection.awsCollectionId;
  }

  /**
   * Detect faces in an image (does NOT index, just detects)
   * Called when user manually triggers face detection
   *
   * @param imageBuffer - Image data as Buffer
   * @returns Array of detected faces with bounding boxes
   */
  async detectFaces(imageBuffer: Buffer): Promise<DetectedFace[]> {
    const response = await this.client.send(
      new DetectFacesCommand({
        Image: { Bytes: imageBuffer },
        Attributes: ['DEFAULT'], // Returns bounding box, confidence, landmarks
      })
    );

    const faces: DetectedFace[] = [];

    if (response.FaceDetails) {
      for (const face of response.FaceDetails) {
        const confidence = face.Confidence ?? 0;

        // Only include faces above threshold
        if (confidence >= FACE_DETECTION_THRESHOLD) {
          const boundingBox = convertBoundingBox(face.BoundingBox);
          if (boundingBox) {
            faces.push({
              boundingBox,
              confidence,
            });
          }
        }
      }
    }

    logger.info('Face detection complete', {
      totalDetected: response.FaceDetails?.length ?? 0,
      aboveThreshold: faces.length,
    });

    // Limit to max faces
    return faces.slice(0, MAX_FACES_TO_DETECT);
  }

  /**
   * Index a face from an image into a collection
   * Called when user tags/confirms a face
   *
   * @param collectionId - AWS collection ID
   * @param imageBuffer - Image data as Buffer
   * @param externalImageId - External reference (face table UUID)
   * @returns Indexed face info or null if no face found
   */
  async indexFace(
    collectionId: string,
    imageBuffer: Buffer,
    externalImageId: string
  ): Promise<IndexedFace | null> {
    const response = await this.client.send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: imageBuffer },
        ExternalImageId: externalImageId,
        MaxFaces: 1, // Only index one face per call
        QualityFilter: 'AUTO',
        DetectionAttributes: ['DEFAULT'],
      })
    );

    if (!response.FaceRecords || response.FaceRecords.length === 0) {
      logger.warn('No faces indexed', { collectionId, externalImageId });
      return null;
    }

    const record = response.FaceRecords[0];
    if (!record) {
      logger.warn('No face record found', { collectionId, externalImageId });
      return null;
    }

    const face = record.Face;

    if (!face || !face.FaceId) {
      logger.warn('Invalid face record', { collectionId, externalImageId });
      return null;
    }

    logger.info('Face indexed', {
      collectionId,
      externalImageId,
      awsFaceId: face.FaceId,
      confidence: face.Confidence,
    });

    return {
      awsFaceId: face.FaceId,
      confidence: face.Confidence ?? 0,
      boundingBox: convertBoundingBox(face.BoundingBox),
    };
  }

  /**
   * Search for matching faces in a collection using an image
   * Used to suggest "Is this [Person Name]?" when viewing photos
   *
   * @param collectionId - AWS collection ID to search in
   * @param imageBuffer - Image containing face to search for
   * @param threshold - Minimum similarity threshold (default 80%)
   * @returns Array of matching faces with similarity scores
   */
  async searchFacesByImage(
    collectionId: string,
    imageBuffer: Buffer,
    threshold: number = FACE_MATCH_THRESHOLD
  ): Promise<FaceMatch[]> {
    try {
      const response = await this.client.send(
        new SearchFacesByImageCommand({
          CollectionId: collectionId,
          Image: { Bytes: imageBuffer },
          MaxFaces: 5,
          FaceMatchThreshold: threshold,
        })
      );

      const matches: FaceMatch[] = [];

      if (response.FaceMatches) {
        for (const match of response.FaceMatches) {
          if (match.Face?.FaceId && match.Similarity) {
            matches.push({
              awsFaceId: match.Face.FaceId,
              similarity: match.Similarity,
              externalImageId: match.Face.ExternalImageId,
            });
          }
        }
      }

      logger.info('Face search complete', {
        collectionId,
        matchesFound: matches.length,
      });

      return matches;
    } catch (error) {
      // No faces in collection yet - return empty
      if (error instanceof ResourceNotFoundException) {
        logger.warn('Collection not found for search', { collectionId });
        return [];
      }
      throw error;
    }
  }

  /**
   * Remove a face from a collection
   * Called when user removes a face tag or photo is deleted
   *
   * @param collectionId - AWS collection ID
   * @param faceId - AWS face ID to remove
   */
  async removeFace(collectionId: string, faceId: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteFacesCommand({
          CollectionId: collectionId,
          FaceIds: [faceId],
        })
      );

      logger.info('Face removed from collection', { collectionId, faceId });
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        logger.warn('Face or collection not found for deletion', { collectionId, faceId });
        return; // Already deleted, consider success
      }
      throw error;
    }
  }

  /**
   * Delete an entire collection
   * Called when user is deleted
   *
   * @param collectionId - AWS collection ID to delete
   */
  async deleteCollection(collectionId: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteCollectionCommand({
          CollectionId: collectionId,
        })
      );

      logger.info('AWS collection deleted', { collectionId });
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        logger.warn('Collection not found for deletion', { collectionId });
        return; // Already deleted, consider success
      }
      throw error;
    }
  }

  /**
   * Detect faces in a photo and save to database
   * Main entry point for face detection on a photo
   *
   * @param photoId - Photo UUID
   * @returns Array of created Face records
   */
  async detectFacesForPhoto(photoId: string): Promise<
    Array<{
      id: string;
      boundingBox: BoundingBox;
      confidence: number;
    }>
  > {
    // Get photo from database
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { id: true, filePath: true, filename: true, userId: true },
    });

    if (!photo) {
      throw new Error('Photo not found');
    }

    // Read image file
    const fs = await import('fs/promises');
    const imageBuffer = await fs.readFile(photo.filePath);

    // Detect faces using AWS
    const detectedFaces = await this.detectFaces(imageBuffer);

    if (detectedFaces.length === 0) {
      logger.info('No faces detected in photo', { photoId });
      return [];
    }

    // Delete existing non-indexed faces for this photo (re-detection)
    await prisma.face.deleteMany({
      where: {
        photoId,
        indexed: false,
      },
    });

    // Create face records
    const createdFaces = await Promise.all(
      detectedFaces.map((face) =>
        prisma.face.create({
          data: {
            photoId,
            boundingBox: JSON.parse(JSON.stringify(face.boundingBox)),
            confidence: face.confidence,
            indexed: false,
          },
        })
      )
    );

    logger.info('Faces saved to database', {
      photoId,
      faceCount: createdFaces.length,
    });

    return createdFaces.map((face) => ({
      id: face.id,
      boundingBox: face.boundingBox as unknown as BoundingBox,
      confidence: face.confidence,
    }));
  }

  /**
   * Get configuration constants (for API responses)
   */
  getConfig() {
    return {
      detectionThreshold: FACE_DETECTION_THRESHOLD,
      matchThreshold: FACE_MATCH_THRESHOLD,
      maxFacesPerPhoto: MAX_FACES_TO_DETECT,
    };
  }
}

// Export singleton instance
export const rekognitionService = new RekognitionService();
