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
import sharp from 'sharp';
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
const AUTO_TAG_THRESHOLD = 90; // Auto-tag if >90% similarity (no confirmation needed)
const MAX_FACES_TO_DETECT = 10; // Limit faces per photo

/**
 * Match suggestion for a detected face
 */
export interface FaceMatchSuggestion {
  personId: string;
  personName: string | null;
  similarity: number;
}

/**
 * Detected face with optional match suggestion (returned from detectFacesForPhoto)
 */
export interface DetectedFaceWithMatch {
  id: string;
  boundingBox: BoundingBox;
  confidence: number;
  indexed: boolean;
  person?: { id: string; name: string | null } | null;
  match?: FaceMatchSuggestion | null;
}

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
 * Crop a face region from an image using Sharp
 * Adds padding around the face for better recognition
 *
 * @param imageBuffer - Original image buffer
 * @param boundingBox - Face bounding box (percentages 0-1)
 * @param padding - Extra padding as percentage (default 20%)
 * @returns Cropped face image buffer
 */
async function cropFaceFromImage(
  imageBuffer: Buffer,
  boundingBox: BoundingBox,
  padding: number = 0.2
): Promise<Buffer> {
  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;

  if (imageWidth === 0 || imageHeight === 0) {
    throw new Error('Could not get image dimensions');
  }

  // Convert percentage bounding box to pixels
  const faceLeft = boundingBox.left * imageWidth;
  const faceTop = boundingBox.top * imageHeight;
  const faceWidth = boundingBox.width * imageWidth;
  const faceHeight = boundingBox.height * imageHeight;

  // Add padding (but keep within image bounds)
  const paddingX = faceWidth * padding;
  const paddingY = faceHeight * padding;

  const left = Math.max(0, Math.floor(faceLeft - paddingX));
  const top = Math.max(0, Math.floor(faceTop - paddingY));
  const width = Math.min(imageWidth - left, Math.ceil(faceWidth + paddingX * 2));
  const height = Math.min(imageHeight - top, Math.ceil(faceHeight + paddingY * 2));

  // Crop the face region
  return sharp(imageBuffer).extract({ left, top, width, height }).toBuffer();
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

    logger.info('Face collection created', {
      userId,
      awsCollectionId,
      collectionId: collection.id,
    });

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
   * Detect faces in a photo, save to database, search for matches, and auto-tag
   * Main entry point for face detection on a photo
   *
   * @param photoId - Photo UUID
   * @returns Array of detected faces with match suggestions
   */
  async detectFacesForPhoto(photoId: string): Promise<DetectedFaceWithMatch[]> {
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

    // Clean up existing faces before creating new ones (re-detection support)
    // This handles both indexed and non-indexed faces
    const existingFaces = await prisma.face.findMany({
      where: { photoId },
      select: { id: true, awsFaceId: true, indexed: true },
    });

    if (existingFaces.length > 0) {
      // Get user's face collection for AWS cleanup
      const userCollection = await prisma.faceCollection.findUnique({
        where: { userId: photo.userId },
      });

      // Remove indexed faces from AWS Rekognition
      if (userCollection) {
        const indexedFaces = existingFaces.filter((f) => f.indexed && f.awsFaceId);
        for (const face of indexedFaces) {
          try {
            await this.removeFace(userCollection.awsCollectionId, face.awsFaceId!);
            logger.info('Removed indexed face from AWS during re-detection', {
              faceId: face.id,
              awsFaceId: face.awsFaceId,
            });
          } catch (err) {
            logger.warn('Failed to remove face from AWS during re-detection', {
              faceId: face.id,
              awsFaceId: face.awsFaceId,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
            // Continue even if AWS removal fails - we still want to clean up the DB
          }
        }
      }

      // Delete ALL existing faces for this photo (not just non-indexed)
      await prisma.face.deleteMany({
        where: { photoId },
      });

      logger.info('Cleaned up existing faces during re-detection', {
        photoId,
        deletedCount: existingFaces.length,
        indexedCount: existingFaces.filter((f) => f.indexed).length,
      });
    }

    if (detectedFaces.length === 0) {
      logger.info('No faces detected in photo', { photoId });
      return [];
    }

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

    // Check if user has a collection with indexed faces
    const collection = await prisma.faceCollection.findUnique({
      where: { userId: photo.userId },
    });

    // If no collection or no indexed faces, return without matching
    if (!collection) {
      logger.info('No face collection found, skipping face matching', {
        photoId,
        userId: photo.userId,
      });
      return createdFaces.map((face) => ({
        id: face.id,
        boundingBox: face.boundingBox as unknown as BoundingBox,
        confidence: face.confidence,
        indexed: false,
        person: null,
        match: null,
      }));
    }

    // Check if there are any indexed faces in the collection
    const indexedFaceCount = await prisma.face.count({
      where: {
        photo: { userId: photo.userId },
        indexed: true,
      },
    });

    if (indexedFaceCount === 0) {
      logger.info('No indexed faces in collection, skipping face matching', { photoId });
      return createdFaces.map((face) => ({
        id: face.id,
        boundingBox: face.boundingBox as unknown as BoundingBox,
        confidence: face.confidence,
        indexed: false,
        person: null,
        match: null,
      }));
    }

    // Search for matches for each detected face
    const results: DetectedFaceWithMatch[] = [];
    let autoTaggedCount = 0;

    for (const face of createdFaces) {
      const boundingBox = face.boundingBox as unknown as BoundingBox;
      let match: FaceMatchSuggestion | null = null;
      let person: { id: string; name: string | null } | null = null;
      let indexed = false;

      try {
        // Crop the face region from the image
        const croppedFace = await cropFaceFromImage(imageBuffer, boundingBox);

        // Search for matches in the user's collection
        const matches = await this.searchFacesByImage(
          collection.awsCollectionId,
          croppedFace,
          FACE_MATCH_THRESHOLD
        );

        if (matches.length > 0 && matches[0]) {
          const bestMatch = matches[0];

          // Look up the Person from the matched face's awsFaceId
          const matchedFace = await prisma.face.findFirst({
            where: { awsFaceId: bestMatch.awsFaceId },
            include: {
              person: {
                select: { id: true, name: true },
              },
            },
          });

          if (matchedFace?.person) {
            const similarity = bestMatch.similarity;

            if (similarity >= AUTO_TAG_THRESHOLD) {
              // Auto-tag: >90% similarity
              const indexResult = await this.indexFace(
                collection.awsCollectionId,
                croppedFace,
                face.id
              );

              if (indexResult) {
                // Update face record with person and indexed status
                await prisma.face.update({
                  where: { id: face.id },
                  data: {
                    personId: matchedFace.person.id,
                    awsFaceId: indexResult.awsFaceId,
                    indexed: true,
                  },
                });

                person = matchedFace.person;
                indexed = true;
                autoTaggedCount++;

                logger.info('Face auto-tagged', {
                  faceId: face.id,
                  personId: matchedFace.person.id,
                  personName: matchedFace.person.name,
                  similarity,
                });
              }
            } else {
              // Suggestion: 80-90% similarity
              match = {
                personId: matchedFace.person.id,
                personName: matchedFace.person.name,
                similarity,
              };

              logger.info('Face match suggestion', {
                faceId: face.id,
                personId: matchedFace.person.id,
                personName: matchedFace.person.name,
                similarity,
              });
            }
          }
        }
      } catch (error) {
        // Log error but continue with other faces
        logger.error('Error searching for face match', {
          faceId: face.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      results.push({
        id: face.id,
        boundingBox,
        confidence: face.confidence,
        indexed,
        person,
        match,
      });
    }

    logger.info('Face detection and matching complete', {
      photoId,
      totalFaces: createdFaces.length,
      autoTagged: autoTaggedCount,
      suggestions: results.filter((r) => r.match).length,
    });

    return results;
  }

  /**
   * Get configuration constants (for API responses)
   */
  getConfig() {
    return {
      detectionThreshold: FACE_DETECTION_THRESHOLD,
      matchThreshold: FACE_MATCH_THRESHOLD,
      autoTagThreshold: AUTO_TAG_THRESHOLD,
      maxFacesPerPhoto: MAX_FACES_TO_DETECT,
    };
  }
}

// Export singleton instance
export const rekognitionService = new RekognitionService();
