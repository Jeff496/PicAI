#!/usr/bin/env npx tsx
// scripts/export-photo-catalog.ts
// Exports all photo metadata for browsing when building RAG golden datasets.
// Run from backend/: npx tsx scripts/export-photo-catalog.ts
//
// Output: ../eval/datasets/photo_catalog.json

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();
const BATCH_SIZE = 50;
const OUTPUT_PATH = path.resolve(process.cwd(), '../eval/datasets/photo_catalog.json');

interface CatalogEntry {
  photoId: string;
  userId: string;
  groupId: string | null;
  groupName: string | null;
  originalName: string;
  uploadedAt: string;
  takenAt: string | null;
  aiTags: { tag: string; confidence: number; category: string }[];
  people: string[];
}

async function main() {
  console.log('Exporting photo catalog for RAG evaluation...');

  const totalPhotos = await prisma.photo.count();
  console.log(`Total photos in database: ${totalPhotos}`);

  const catalog: CatalogEntry[] = [];
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

      catalog.push({
        photoId: photo.id,
        userId: photo.userId,
        groupId: photo.groupId,
        groupName: photo.group?.name || null,
        originalName: photo.originalName,
        uploadedAt: photo.uploadedAt.toISOString(),
        takenAt: photo.takenAt?.toISOString() || null,
        aiTags: photo.aiTags.map((t) => ({
          tag: t.tag,
          confidence: t.confidence,
          category: t.category,
        })),
        people,
      });
    }

    skip += BATCH_SIZE;
    console.log(`  Processed ${Math.min(skip, totalPhotos)}/${totalPhotos}`);
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2));

  console.log(`\nExported ${catalog.length} photos to ${OUTPUT_PATH}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
