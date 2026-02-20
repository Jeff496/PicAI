#!/usr/bin/env npx tsx
// scripts/export-tagging-data.ts
// Exports all photos with their AI tags for building tagging ground truth.
// Run from backend/: npx tsx scripts/export-tagging-data.ts
//
// Output: ../eval/datasets/tagging_export.jsonl
// User copies to tagging_ground_truth.jsonl and adds corrections.

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();
const BATCH_SIZE = 50;
const OUTPUT_PATH = path.resolve(process.cwd(), '../eval/datasets/tagging_export.jsonl');

interface TaggingEntry {
  photoId: string;
  originalName: string;
  thumbnailUrl: string;
  ai_tags: { tag: string; confidence: number; category: string }[];
}

async function main() {
  console.log('Exporting tagging data for ground truth labeling...');

  const totalPhotos = await prisma.photo.count();
  console.log(`Total photos in database: ${totalPhotos}`);

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  const stream = fs.createWriteStream(OUTPUT_PATH);
  let skip = 0;
  let exported = 0;

  while (true) {
    const photos = await prisma.photo.findMany({
      skip,
      take: BATCH_SIZE,
      orderBy: { uploadedAt: 'asc' },
      include: {
        aiTags: { select: { tag: true, confidence: true, category: true } },
      },
    });

    if (photos.length === 0) break;

    for (const photo of photos) {
      const entry: TaggingEntry = {
        photoId: photo.id,
        originalName: photo.originalName,
        thumbnailUrl: `/api/photos/${photo.id}/thumbnail`,
        ai_tags: photo.aiTags.map((t) => ({
          tag: t.tag,
          confidence: t.confidence,
          category: t.category,
        })),
      };

      stream.write(JSON.stringify(entry) + '\n');
      exported++;
    }

    skip += BATCH_SIZE;
    console.log(`  Processed ${Math.min(skip, totalPhotos)}/${totalPhotos}`);
  }

  stream.end();
  console.log(`\nExported ${exported} photos to ${OUTPUT_PATH}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
