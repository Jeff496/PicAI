// src/services/ingestService.ts
// Sends photo metadata to the RAG chatbot ingest Lambda for vector indexing.
// Fire-and-forget: failures are logged but never block the main flow.

import { env } from '../config/env.js';
import prisma from '../prisma/client.js';
import logger from '../utils/logger.js';

class IngestService {
  private enabled: boolean;
  private apiUrl: string;

  constructor() {
    this.enabled = !!env.INGEST_API_URL;
    this.apiUrl = env.INGEST_API_URL || '';

    if (this.enabled) {
      logger.info('RAG ingest service enabled', { apiUrl: this.apiUrl });
    } else {
      logger.info('RAG ingest service disabled (INGEST_API_URL not set)');
    }
  }

  /**
   * Index a photo's metadata for RAG search.
   * Fetches the full photo with tags, people, and group from the database,
   * then sends it to the ingest Lambda.
   */
  async indexPhoto(photoId: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const photo = await prisma.photo.findUnique({
        where: { id: photoId },
        include: {
          aiTags: { select: { tag: true, confidence: true, category: true } },
          faces: {
            where: { personId: { not: null } },
            include: { person: { select: { name: true } } },
          },
          group: { select: { name: true } },
        },
      });

      if (!photo) {
        logger.warn('Ingest: photo not found', { photoId });
        return;
      }

      const people = photo.faces
        .map((f) => f.person?.name)
        .filter((name): name is string => !!name);

      const payload = {
        action: 'index' as const,
        photoId: photo.id,
        userId: photo.userId,
        groupId: photo.groupId || undefined,
        filename: photo.filename,
        originalName: photo.originalName,
        tags: photo.aiTags,
        people: people.length > 0 ? people : undefined,
        groupName: photo.group?.name || undefined,
        takenAt: photo.takenAt?.toISOString(),
        uploadedAt: photo.uploadedAt.toISOString(),
      };

      await this.send(payload);
      logger.debug('Ingest: photo indexed', { photoId });
    } catch (error) {
      logger.error('Ingest: failed to index photo', {
        photoId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete a photo from the RAG search index.
   */
  async deletePhoto(photoId: string, userId: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.send({ action: 'delete', photoId, userId });
      logger.debug('Ingest: photo deleted from index', { photoId });
    } catch (error) {
      logger.error('Ingest: failed to delete photo from index', {
        photoId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send a payload to the ingest Lambda via API Gateway.
   * Uses native fetch (available in Node.js 24).
   */
  private async send(payload: Record<string, unknown>): Promise<void> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ingest API returned ${response.status}: ${body}`);
    }
  }
}

export const ingestService = new IngestService();
