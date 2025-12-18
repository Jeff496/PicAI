// src/middleware/upload.middleware.ts
// Multer configuration for photo uploads
// Handles file validation, size limits, and memory storage for Sharp processing

import multer from 'multer';
import path from 'path';
import type { Request } from 'express';
import { env } from '../config/env.js';

/**
 * Allowed MIME types for photo uploads
 * Supports JPEG, PNG, and HEIC/HEIF (iPhone photos)
 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

/**
 * Allowed file extensions for photo uploads
 * Must match ALLOWED_MIME_TYPES - provides defense in depth against spoofed MIME types
 */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];

/**
 * Maximum number of files per upload request
 */
const MAX_FILES = 50;

/**
 * File filter to validate uploaded file types
 * Validates both MIME type AND file extension for defense in depth
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(
      new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and HEIC/HEIF are allowed.`)
    );
    return;
  }

  // Check file extension (defense in depth against spoofed MIME types)
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(
      new Error(
        `Invalid file extension: ${ext}. Only ${ALLOWED_EXTENSIONS.join(', ')} are allowed.`
      )
    );
    return;
  }

  cb(null, true);
};

/**
 * Multer configuration for photo uploads
 *
 * Features:
 * - Memory storage: Files stored in buffer for Sharp processing
 * - File type validation: Only JPEG, PNG, HEIC/HEIF allowed
 * - Size limit: MAX_FILE_SIZE from env (default 25MB)
 * - File count limit: 50 files per request
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: MAX_FILES,
  },
});

/**
 * Export constants for use in other modules
 */
export { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_FILES };
