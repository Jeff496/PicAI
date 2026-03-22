import { supabase } from '../shared/supabase.js';

/**
 * No-op — table and indexes are created via Supabase SQL editor.
 * Kept for API compatibility with the ingest handler.
 */
export async function ensureIndex(): Promise<void> {
  // Table created in Supabase; nothing to do at runtime.
}

/**
 * Upsert a photo document with its embedding vector into Supabase pgvector.
 * Uses photo_id as primary key for idempotent updates.
 */
export async function indexPhoto(doc: {
  photoId: string;
  userId: string;
  groupId?: string;
  filename?: string;
  originalName?: string;
  tags?: string;
  people?: string;
  groupName?: string;
  takenAt?: string;
  uploadedAt?: string;
  embeddingText: string;
  vector: number[];
}): Promise<void> {
  const { error } = await supabase
    .from('photo_vectors')
    .upsert({
      photo_id: doc.photoId,
      user_id: doc.userId,
      group_id: doc.groupId || null,
      filename: doc.filename || null,
      original_name: doc.originalName || null,
      tags: doc.tags || null,
      people: doc.people || null,
      group_name: doc.groupName || null,
      taken_at: doc.takenAt || null,
      uploaded_at: doc.uploadedAt || null,
      embedding_text: doc.embeddingText,
      embedding: JSON.stringify(doc.vector),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'photo_id' });

  if (error) {
    throw new Error(`Failed to index photo ${doc.photoId}: ${error.message}`);
  }
}

/**
 * Delete a photo document from the vector store.
 */
export async function deletePhoto(photoId: string): Promise<void> {
  const { error } = await supabase
    .from('photo_vectors')
    .delete()
    .eq('photo_id', photoId);

  if (error) {
    throw new Error(`Failed to delete photo ${photoId}: ${error.message}`);
  }
}
