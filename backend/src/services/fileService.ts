// src/services/fileService.ts
// File storage service for photo uploads
// Handles saving originals, generating thumbnails, and streaming files

import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import heicConvert from 'heic-convert';
import type { Response } from 'express';
import { env } from '../config/env.js';
import prisma from '../prisma/client.js';
import logger from '../utils/logger.js';

/**
 * Thumbnail dimensions and quality settings
 */
const THUMBNAIL_SIZE = 200;
const THUMBNAIL_QUALITY = 80;

/**
 * Result of saving a photo
 */
export interface SavePhotoResult {
  originalPath: string;
  thumbnailPath: string;
  metadata: {
    filename: string;
    mimeType: string;
    fileSize: number;
    width: number;
    height: number;
  };
}

/**
 * FileService Class
 * Handles all file operations for photo storage
 */
class FileService {
  /**
   * Ensure storage directories exist
   * Should be called at application startup
   */
  async ensureDirectories(): Promise<void> {
    await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
    await fs.mkdir(env.THUMBNAIL_DIR, { recursive: true });
    logger.info('Storage directories verified', {
      uploadDir: env.UPLOAD_DIR,
      thumbnailDir: env.THUMBNAIL_DIR,
    });
  }
  /**
   * Save a photo to disk and generate thumbnail
   *
   * @param buffer - File buffer from Multer
   * @param originalName - Original filename from upload
   * @param mimeType - MIME type of the file
   * @returns Path and metadata information
   */
  async savePhoto(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<SavePhotoResult> {
    // Convert HEIC/HEIF to JPEG for processing and storage
    let processedBuffer = buffer;
    let finalMimeType = mimeType;

    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      logger.info('Converting HEIC/HEIF to JPEG', { originalName });
      // Convert Buffer to ArrayBuffer for heic-convert compatibility
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
      processedBuffer = Buffer.from(
        await heicConvert({
          buffer: arrayBuffer,
          format: 'JPEG',
          quality: 0.9,
        })
      );
      finalMimeType = 'image/jpeg';
    }

    // Generate unique filename with appropriate extension
    const extension = this.getExtensionFromMimeType(finalMimeType);
    const filename = `${randomUUID()}${extension}`;

    // Get image metadata using Sharp
    const sharpInstance = sharp(processedBuffer);
    const metadata = await sharpInstance.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    // Resolve absolute paths
    const originalPath = path.join(env.UPLOAD_DIR, filename);
    const thumbnailPath = path.join(env.THUMBNAIL_DIR, filename);

    // Save original file
    await fs.writeFile(originalPath, processedBuffer);
    logger.info('Saved original photo', { filename, path: originalPath });

    // Generate and save thumbnail
    await this.generateThumbnail(processedBuffer, thumbnailPath);

    return {
      originalPath,
      thumbnailPath,
      metadata: {
        filename,
        mimeType: finalMimeType,
        fileSize: processedBuffer.length,
        width: metadata.width,
        height: metadata.height,
      },
    };
  }

  /**
   * Generate a thumbnail from image buffer
   *
   * @param buffer - Image buffer
   * @param outputPath - Path to save thumbnail
   */
  private async generateThumbnail(buffer: Buffer, outputPath: string): Promise<void> {
    await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toFile(outputPath);

    logger.info('Generated thumbnail', { path: outputPath });
  }

  /**
   * Get file path for a photo by ID
   *
   * @param photoId - Photo UUID
   * @returns Full path to original file
   */
  async getPhotoPath(photoId: string): Promise<string> {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { filePath: true },
    });

    if (!photo) {
      throw new Error('Photo not found');
    }

    return photo.filePath;
  }

  /**
   * Get thumbnail path for a photo by ID
   *
   * @param photoId - Photo UUID
   * @returns Full path to thumbnail file
   */
  async getThumbnailPath(photoId: string): Promise<string> {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { thumbnailPath: true },
    });

    if (!photo || !photo.thumbnailPath) {
      throw new Error('Thumbnail not found');
    }

    return photo.thumbnailPath;
  }

  /**
   * Delete a photo and its thumbnail from disk
   * Deletes DB record first to prevent race conditions, then cleans up files
   *
   * @param photoId - Photo UUID
   */
  async deletePhoto(photoId: string): Promise<void> {
    // Delete database record first (CASCADE will delete AI tags)
    // This prevents race conditions - if two requests hit simultaneously,
    // only one will succeed and the other will get "Record not found"
    const photo = await prisma.photo.delete({
      where: { id: photoId },
      select: { filePath: true, thumbnailPath: true },
    });

    logger.info('Deleted photo record', { photoId });

    // Clean up files after DB deletion (orphaned files are acceptable)
    try {
      if (existsSync(photo.filePath)) {
        await fs.unlink(photo.filePath);
        logger.info('Deleted original file', { path: photo.filePath });
      }

      if (photo.thumbnailPath && existsSync(photo.thumbnailPath)) {
        await fs.unlink(photo.thumbnailPath);
        logger.info('Deleted thumbnail', { path: photo.thumbnailPath });
      }
    } catch (err) {
      // Log but don't throw - DB record is already deleted
      logger.warn('Failed to delete photo files', {
        photoId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Stream a photo file to response
   * Uses streaming to avoid loading large files in memory
   *
   * @param filePath - Path to file
   * @param mimeType - MIME type for Content-Type header
   * @param res - Express response object
   */
  streamFile(filePath: string, mimeType: string, res: Response): void {
    if (!existsSync(filePath)) {
      throw new Error('File not found');
    }

    res.setHeader('Content-Type', mimeType);

    const readStream = createReadStream(filePath);
    readStream.pipe(res);

    readStream.on('error', (err) => {
      logger.error('Error streaming file', { filePath, error: err.message });
      // Response may already be partially sent, can't send error JSON
      res.end();
    });
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/heic': '.jpg', // HEIC converted to JPEG
      'image/heif': '.jpg', // HEIF converted to JPEG
    };

    return mimeToExt[mimeType] || '.jpg';
  }

  /**
   * Clean up files from a failed batch upload
   * Removes files that were saved before an error occurred
   *
   * @param savedFiles - Array of SavePhotoResult from successful saves
   */
  async cleanupPartialUpload(savedFiles: SavePhotoResult[]): Promise<void> {
    for (const file of savedFiles) {
      try {
        if (existsSync(file.originalPath)) {
          await fs.unlink(file.originalPath);
          logger.info('Cleaned up partial upload file', { path: file.originalPath });
        }
        if (existsSync(file.thumbnailPath)) {
          await fs.unlink(file.thumbnailPath);
          logger.info('Cleaned up partial upload thumbnail', { path: file.thumbnailPath });
        }
      } catch (err) {
        // Log but don't throw - best effort cleanup
        logger.warn('Failed to cleanup partial upload file', {
          path: file.originalPath,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }
}

// Export singleton instance
export const fileService = new FileService();
