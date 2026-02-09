import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { generateEmbedding, buildPhotoText } from './embeddings';
import { ensureIndex, indexPhoto, deletePhoto } from './opensearch';

let indexReady = false;

interface IngestPayload {
  action?: 'index' | 'delete';
  photoId: string;
  userId: string;
  groupId?: string;
  filename?: string;
  originalName?: string;
  tags?: Array<{ tag: string; confidence: number; category: string }>;
  people?: string[];
  groupName?: string;
  takenAt?: string;
  uploadedAt?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Ingest handler invoked');

  try {
    const body: IngestPayload = JSON.parse(event.body || '{}');
    const { action = 'index', photoId, userId } = body;

    if (!photoId || !userId) {
      return respond(400, { success: false, error: 'photoId and userId are required' });
    }

    // Handle delete
    if (action === 'delete') {
      await deletePhoto(photoId);
      console.log(`Deleted photo ${photoId} from index`);
      return respond(200, { success: true, message: `Photo ${photoId} deleted from index` });
    }

    // Ensure index exists (cached after first call per Lambda instance)
    if (!indexReady) {
      await ensureIndex();
      indexReady = true;
    }

    // Build text representation and generate embedding
    const embeddingText = buildPhotoText(body);
    console.log(`Embedding text for photo ${photoId}: "${embeddingText}"`);

    const { vector, inputTextTokenCount } = await generateEmbedding(embeddingText);
    console.log(`Generated embedding: ${vector.length} dimensions, ${inputTextTokenCount} tokens`);

    // Index to OpenSearch
    await indexPhoto({
      photoId,
      userId,
      groupId: body.groupId,
      filename: body.filename,
      originalName: body.originalName,
      tags: body.tags?.map(t => t.tag).join(', '),
      people: body.people?.join(', '),
      groupName: body.groupName,
      takenAt: body.takenAt,
      uploadedAt: body.uploadedAt,
      embeddingText,
      vector,
    });

    console.log(`Successfully indexed photo ${photoId}`);
    return respond(200, {
      success: true,
      message: `Photo ${photoId} indexed`,
      tokens: inputTextTokenCount,
    });
  } catch (error) {
    console.error('Ingest handler error:', error);
    return respond(500, {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};

function respond(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
