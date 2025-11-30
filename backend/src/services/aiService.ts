// src/services/aiService.ts
// Azure Computer Vision integration for automatic photo tagging
// Handles async analysis, rate limiting, exponential backoff retries, and tag extraction

import axios, { AxiosError } from 'axios';
import fs from 'fs/promises';
import { env } from '../config/env.js';
import prisma from '../prisma/client.js';
import logger from '../utils/logger.js';

/**
 * Retry configuration for exponential backoff
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000, // Start with 1 second
  maxDelayMs: 30000, // Max 30 seconds
  retryableStatuses: [429, 500, 502, 503, 504], // Rate limit + server errors
};

/**
 * Azure Computer Vision API response types
 */
interface AzureTag {
  name: string;
  confidence: number;
}

interface AzureObject {
  tags?: AzureTag[];
  boundingBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface AzureCaption {
  text: string;
  confidence: number;
}

interface AzurePerson {
  boundingBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  confidence: number;
}

interface AzureReadResult {
  content: string;
}

interface AzureAnalysisResult {
  tagsResult?: { values: AzureTag[] };
  objectsResult?: { values: AzureObject[] };
  captionResult?: AzureCaption;
  readResult?: AzureReadResult;
  peopleResult?: { values: AzurePerson[] };
}

/**
 * Tag to be stored in database
 */
interface ExtractedTag {
  tag: string;
  confidence: number;
  category: string;
}

/**
 * Analysis queue item
 */
interface QueueItem {
  photoId: string;
  resolve: (value: ExtractedTag[]) => void;
  reject: (reason: Error) => void;
}

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 * Formula: min(maxDelay, baseDelay * 2^attempt) + random jitter
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Add random jitter (0-25% of delay) to prevent thundering herd
  const jitter = Math.random() * 0.25 * cappedDelay;
  return Math.floor(cappedDelay + jitter);
}

/**
 * Check if an error is retryable based on status code
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status && config.retryableStatuses.includes(status)) {
      return true;
    }
    // Also retry on network errors (no response)
    if (!error.response && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND')) {
      return true;
    }
  }
  return false;
}

/**
 * Get Retry-After header value in milliseconds (if present)
 */
function getRetryAfterMs(error: AxiosError): number | null {
  const retryAfter = error.response?.headers?.['retry-after'];
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  return null;
}

/**
 * Rate limiter for Azure API calls
 * Free tier: 20 calls/minute = 1 call per 3 seconds
 */
class RateLimiter {
  private queue: QueueItem[] = [];
  private processing = false;
  private lastCall = 0;
  private minInterval = 3100; // 3.1 seconds between calls (safe margin for 20/min)

  /**
   * Add a photo analysis job to the queue
   */
  async enqueue(photoId: string): Promise<ExtractedTag[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ photoId, resolve, reject });
      logger.debug('AI analysis queued', { photoId, queueLength: this.queue.length });
      this.processQueue();
    });
  }

  /**
   * Process the queue one item at a time with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      // Wait for rate limit
      const now = Date.now();
      const waitTime = Math.max(0, this.minInterval - (now - this.lastCall));
      if (waitTime > 0) {
        await delay(waitTime);
      }

      this.lastCall = Date.now();

      try {
        const tags = await aiService.performAnalysis(item.photoId);
        item.resolve(tags);
      } catch (error) {
        item.reject(error as Error);
      }
    }

    this.processing = false;
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * AI Service for Azure Computer Vision integration
 */
class AIService {
  private rateLimiter = new RateLimiter();
  private readonly CONFIDENCE_THRESHOLD = 0.5;
  private readonly API_VERSION = '2023-10-01';
  // Note: 'caption' and 'denseCaptions' features are only available in specific regions
  // (East US, France Central, Korea Central, North Europe, Southeast Asia, West Europe, West US)
  // If your Azure resource is in a different region, those features will return 400 errors.
  // Using only universally supported features for broad compatibility.
  private readonly FEATURES = 'tags,objects,read,people';
  private readonly retryConfig = DEFAULT_RETRY_CONFIG;

  /**
   * Analyze a photo and save tags to database
   * This is the main entry point - handles rate limiting
   *
   * @param photoId - UUID of the photo to analyze
   * @returns Array of extracted tags
   */
  async analyzePhoto(photoId: string): Promise<ExtractedTag[]> {
    logger.info('Queuing photo for AI analysis', { photoId });
    return this.rateLimiter.enqueue(photoId);
  }

  /**
   * Perform the actual Azure API call and save results
   * Called by the rate limiter. Uses exponential backoff for retryable errors.
   *
   * @param photoId - UUID of the photo to analyze
   * @returns Array of extracted tags
   */
  async performAnalysis(photoId: string): Promise<ExtractedTag[]> {
    // Get photo from database
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { id: true, filePath: true, filename: true },
    });

    if (!photo) {
      logger.warn('Photo not found for AI analysis', { photoId });
      throw new Error('Photo not found');
    }

    logger.info('Starting AI analysis', { photoId, filename: photo.filename });

    // Read the image file once (don't re-read on retries)
    const imageBuffer = await fs.readFile(photo.filePath);

    // Call Azure API with exponential backoff retries
    const response = await this.callAzureApiWithRetry(photoId, imageBuffer);

    // Extract tags from response
    const tags = this.extractTags(response);
    logger.info('AI analysis complete', { photoId, tagCount: tags.length });

    // Delete existing AI tags for this photo (in case of re-analysis)
    await prisma.aiTag.deleteMany({
      where: {
        photoId,
        category: { not: 'manual' }, // Preserve manual tags
      },
    });

    // Save new tags to database
    if (tags.length > 0) {
      await prisma.aiTag.createMany({
        data: tags.map((tag) => ({
          photoId,
          tag: tag.tag,
          confidence: tag.confidence,
          category: tag.category,
        })),
      });
      logger.info('AI tags saved', { photoId, tagCount: tags.length });
    }

    return tags;
  }

  /**
   * Call Azure Computer Vision API with exponential backoff retry
   *
   * @param photoId - Photo ID for logging
   * @param imageBuffer - Image data to analyze
   * @returns Azure API response
   */
  private async callAzureApiWithRetry(
    photoId: string,
    imageBuffer: Buffer
  ): Promise<AzureAnalysisResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await axios.post<AzureAnalysisResult>(
          `${env.AZURE_VISION_ENDPOINT}/computervision/imageanalysis:analyze`,
          imageBuffer,
          {
            params: {
              'api-version': this.API_VERSION,
              features: this.FEATURES,
            },
            headers: {
              'Ocp-Apim-Subscription-Key': env.AZURE_VISION_KEY,
              'Content-Type': 'application/octet-stream',
            },
            timeout: 30000, // 30 second timeout
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          }
        );

        // Success - return the response data
        if (attempt > 0) {
          logger.info('Azure API call succeeded after retry', {
            photoId,
            attempt: attempt + 1,
          });
        }
        return response.data;
      } catch (error) {
        lastError = error as Error;

        // Check for non-retryable errors (400 Bad Request = invalid image)
        if (error instanceof AxiosError && error.response?.status === 400) {
          logger.warn('Azure API rejected image (not retryable)', {
            photoId,
            status: error.response.status,
            error: error.response.data,
          });
          throw new Error('Invalid image for analysis');
        }

        // Check if this error is retryable
        if (!isRetryableError(error, this.retryConfig)) {
          logger.error('Azure API error (not retryable)', {
            photoId,
            attempt: attempt + 1,
            status: error instanceof AxiosError ? error.response?.status : undefined,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= this.retryConfig.maxRetries) {
          logger.error('Azure API failed after all retries', {
            photoId,
            totalAttempts: attempt + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          break;
        }

        // Calculate delay - use Retry-After header if present (for 429), otherwise exponential backoff
        let delayMs: number;
        if (error instanceof AxiosError) {
          const retryAfterMs = getRetryAfterMs(error);
          if (retryAfterMs) {
            delayMs = retryAfterMs;
            logger.warn('Azure API rate limited, using Retry-After header', {
              photoId,
              attempt: attempt + 1,
              retryAfterMs,
            });
          } else {
            delayMs = calculateBackoffDelay(attempt, this.retryConfig);
          }
        } else {
          delayMs = calculateBackoffDelay(attempt, this.retryConfig);
        }

        logger.warn('Azure API call failed, retrying with backoff', {
          photoId,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delayMs,
          status: error instanceof AxiosError ? error.response?.status : undefined,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await delay(delayMs);
      }
    }

    // All retries exhausted
    throw lastError || new Error('Azure API call failed after all retries');
  }

  /**
   * Extract and categorize tags from Azure API response
   *
   * @param result - Azure Computer Vision API response
   * @returns Array of tags with categories
   */
  private extractTags(result: AzureAnalysisResult): ExtractedTag[] {
    const tags: ExtractedTag[] = [];
    const seenTags = new Set<string>(); // Prevent duplicates

    // Extract general tags
    if (result.tagsResult?.values) {
      for (const tag of result.tagsResult.values) {
        if (tag.confidence >= this.CONFIDENCE_THRESHOLD && !seenTags.has(tag.name.toLowerCase())) {
          tags.push({
            tag: tag.name,
            confidence: tag.confidence,
            category: 'tag',
          });
          seenTags.add(tag.name.toLowerCase());
        }
      }
    }

    // Extract object tags
    if (result.objectsResult?.values) {
      for (const obj of result.objectsResult.values) {
        if (obj.tags) {
          for (const tag of obj.tags) {
            if (
              tag.confidence >= this.CONFIDENCE_THRESHOLD &&
              !seenTags.has(tag.name.toLowerCase())
            ) {
              tags.push({
                tag: tag.name,
                confidence: tag.confidence,
                category: 'object',
              });
              seenTags.add(tag.name.toLowerCase());
            }
          }
        }
      }
    }

    // Extract caption (scene description)
    if (result.captionResult && result.captionResult.confidence >= this.CONFIDENCE_THRESHOLD) {
      tags.push({
        tag: result.captionResult.text,
        confidence: result.captionResult.confidence,
        category: 'caption',
      });
    }

    // Extract OCR text (if any)
    if (result.readResult?.content && result.readResult.content.trim().length > 0) {
      // Truncate to 200 chars and clean up
      const text = result.readResult.content.trim().substring(0, 200);
      tags.push({
        tag: text,
        confidence: 1.0,
        category: 'text',
      });
    }

    // Extract people count
    if (result.peopleResult?.values && result.peopleResult.values.length > 0) {
      const peopleCount = result.peopleResult.values.length;
      tags.push({
        tag: peopleCount === 1 ? '1 person' : `${peopleCount} people`,
        confidence: 0.9,
        category: 'people',
      });
    }

    return tags;
  }

  /**
   * Find and analyze all photos that don't have AI tags
   *
   * @param userId - Optional user ID to filter photos
   * @returns Object with queued count and already tagged count
   */
  async analyzePhotosWithoutTags(userId?: string | null): Promise<{
    queued: number;
    alreadyTagged: number;
    total: number;
  }> {
    // Build where clause
    const where: { userId?: string } = {};
    if (userId != null) {
      where.userId = userId;
    }

    // Find photos without any AI tags (excluding manual tags)
    const photos = await prisma.photo.findMany({
      where: {
        ...where,
        aiTags: {
          none: {
            category: { not: 'manual' },
          },
        },
      },
      select: { id: true },
    });

    // Get total photo count
    const total = await prisma.photo.count({ where });
    const alreadyTagged = total - photos.length;

    logger.info('Batch analysis starting', {
      photosToAnalyze: photos.length,
      alreadyTagged,
      total,
    });

    // Queue all photos for analysis (fire-and-forget)
    for (const photo of photos) {
      this.analyzePhoto(photo.id).catch((err) => {
        logger.error('Batch analysis failed for photo', {
          photoId: photo.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    }

    return {
      queued: photos.length,
      alreadyTagged,
      total,
    };
  }

  /**
   * Get current analysis queue status
   */
  getQueueStatus(): { queueLength: number } {
    return {
      queueLength: this.rateLimiter.getQueueLength(),
    };
  }

  /**
   * Add a manual tag to a photo
   *
   * @param photoId - UUID of the photo
   * @param tag - Tag text
   * @param category - Tag category (defaults to 'manual')
   * @returns Created tag record
   */
  async addManualTag(
    photoId: string,
    tag: string,
    category: string = 'manual'
  ): Promise<{
    id: string;
    tag: string;
    confidence: number;
    category: string;
  }> {
    // Verify photo exists
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { id: true },
    });

    if (!photo) {
      throw new Error('Photo not found');
    }

    // Create tag
    const newTag = await prisma.aiTag.create({
      data: {
        photoId,
        tag,
        confidence: 1.0, // Manual tags have 100% confidence
        category,
      },
    });

    logger.info('Manual tag added', { photoId, tag, category });

    return {
      id: newTag.id,
      tag: newTag.tag,
      confidence: newTag.confidence,
      category: newTag.category,
    };
  }

  /**
   * Remove a tag from a photo
   *
   * @param photoId - UUID of the photo
   * @param tagId - UUID of the tag to remove
   */
  async removeTag(photoId: string, tagId: string): Promise<void> {
    const tag = await prisma.aiTag.findFirst({
      where: { id: tagId, photoId },
    });

    if (!tag) {
      throw new Error('Tag not found');
    }

    await prisma.aiTag.delete({
      where: { id: tagId },
    });

    logger.info('Tag removed', { photoId, tagId, tag: tag.tag });
  }
}

// Export singleton instance
export const aiService = new AIService();
