import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });
const MODEL_ID = process.env.EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';

export interface EmbeddingResult {
  vector: number[];
  inputTextTokenCount: number;
}

/**
 * Generate an embedding vector from text using Amazon Titan Embeddings V2.
 * Returns a 1024-dimensional vector by default.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text,
      dimensions: 1024,
      normalize: true,
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));

  return {
    vector: result.embedding,
    inputTextTokenCount: result.inputTextTokenCount,
  };
}

/**
 * Build a text representation of photo metadata for embedding.
 * Combines tags, people, filename, dates, and group info into
 * a single descriptive string.
 */
export function buildPhotoText(metadata: {
  photoId: string;
  filename?: string;
  originalName?: string;
  tags?: Array<{ tag: string; confidence: number; category: string }>;
  people?: string[];
  groupName?: string;
  takenAt?: string;
  uploadedAt?: string;
}): string {
  const parts: string[] = [];

  // Original filename often contains context (e.g., "beach_sunset_2024.jpg")
  if (metadata.originalName) {
    const nameWithoutExt = metadata.originalName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    parts.push(`Photo: ${nameWithoutExt}`);
  }

  // AI tags grouped by category
  if (metadata.tags && metadata.tags.length > 0) {
    const tagsByCategory = new Map<string, string[]>();
    for (const t of metadata.tags) {
      const existing = tagsByCategory.get(t.category) || [];
      existing.push(t.tag);
      tagsByCategory.set(t.category, existing);
    }

    const generalTags = tagsByCategory.get('tag');
    if (generalTags?.length) parts.push(`Tags: ${generalTags.join(', ')}`);

    const objects = tagsByCategory.get('object');
    if (objects?.length) parts.push(`Objects: ${objects.join(', ')}`);

    const text = tagsByCategory.get('text');
    if (text?.length) parts.push(`Text in photo: ${text.join(', ')}`);

    const people = tagsByCategory.get('people');
    if (people?.length) parts.push(`People detected: ${people.join(', ')}`);

    const manualTags = tagsByCategory.get('manual');
    if (manualTags?.length) parts.push(`User tags: ${manualTags.join(', ')}`);
  }

  // Named people from face recognition
  if (metadata.people && metadata.people.length > 0) {
    parts.push(`People: ${metadata.people.join(', ')}`);
  }

  // Group context
  if (metadata.groupName) {
    parts.push(`Group: ${metadata.groupName}`);
  }

  // Date context
  if (metadata.takenAt) {
    const date = new Date(metadata.takenAt);
    parts.push(`Taken: ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  } else if (metadata.uploadedAt) {
    const date = new Date(metadata.uploadedAt);
    parts.push(`Uploaded: ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  }

  return parts.join('. ');
}
