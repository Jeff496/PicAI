#!/usr/bin/env npx tsx
// scripts/backfill-ingest.ts
// Sends all existing photos with AI tags to the RAG ingest endpoint.
// Run from backend/: npx tsx scripts/backfill-ingest.ts
//
// Environment: Requires INGEST_API_URL and DATABASE_URL in .env

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '../src/generated/prisma/client.js';

const INGEST_API_URL = process.env.INGEST_API_URL;
if (!INGEST_API_URL) {
  console.error('ERROR: INGEST_API_URL environment variable is required');
  process.exit(1);
}

const prisma = new PrismaClient();
const BATCH_SIZE = 10;
const DELAY_MS = 500; // 500ms between batches to avoid overwhelming Lambda

async function main() {
  console.log('Starting backfill...');
  console.log(`Ingest API URL: ${INGEST_API_URL}`);

  const totalPhotos = await prisma.photo.count();
  console.log(`Total photos in database: ${totalPhotos}`);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skip = 0;

  while (true) {
    const photos = await prisma.photo.findMany({
      skip,
      take: BATCH_SIZE,
      orderBy: { uploadedAt: 'asc' },
      include: {
        aiTags: { select: { tag: true, confidence: true, category: true } },
        faces: {
          where: { personId: { not: null } },
          include: { person: { select: { name: true } } },
        },
        group: { select: { name: true } },
      },
    });

    if (photos.length === 0) break;

    for (const photo of photos) {
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

      try {
        const response = await fetch(INGEST_API_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          succeeded++;
        } else {
          const body = await response.text();
          console.error(`  FAIL [${photo.id}]: ${response.status} - ${body}`);
          failed++;
        }
      } catch (error) {
        console.error(`  ERROR [${photo.id}]: ${error instanceof Error ? error.message : error}`);
        failed++;
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`  Progress: ${processed}/${totalPhotos} (${succeeded} ok, ${failed} failed)`);
      }
    }

    skip += BATCH_SIZE;

    // Rate limit between batches
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log('\nBackfill complete!');
  console.log(`  Total:     ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
