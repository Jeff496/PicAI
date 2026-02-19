#!/usr/bin/env npx tsx
// scripts/export-photo-paths.ts
// Exports photoId -> filePath mapping for eval scripts that need to read photo bytes.
// Run from backend/: npx tsx scripts/export-photo-paths.ts
//
// Output: ../eval/datasets/photo_paths.json

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();
const OUTPUT_PATH = path.resolve(process.cwd(), '../eval/datasets/photo_paths.json');

async function main() {
  console.log('Exporting photo file paths for eval...');

  const photos = await prisma.photo.findMany({
    select: {
      id: true,
      filePath: true,
      thumbnailPath: true,
      originalName: true,
      mimeType: true,
    },
    orderBy: { uploadedAt: 'asc' },
  });

  const mapping: Record<string, { filePath: string; thumbnailPath: string | null; originalName: string; mimeType: string }> = {};
  for (const photo of photos) {
    mapping[photo.id] = {
      filePath: photo.filePath,
      thumbnailPath: photo.thumbnailPath,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
    };
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mapping, null, 2));

  console.log(`Exported ${photos.length} photo paths to ${OUTPUT_PATH}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
