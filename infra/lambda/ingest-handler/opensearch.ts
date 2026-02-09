import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';

const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT || '';
const INDEX_NAME = process.env.OPENSEARCH_INDEX || 'photo-vectors';

const signer = new SignatureV4({
  service: 'es',
  region: 'us-east-1',
  credentials: defaultProvider(),
  sha256: Sha256,
});

/**
 * Send a signed HTTP request to OpenSearch.
 */
async function signedRequest(
  method: string,
  path: string,
  body?: string
): Promise<{ statusCode: number; body: string }> {
  const url = new URL(`https://${OPENSEARCH_ENDPOINT}${path}`);

  const request = new HttpRequest({
    method,
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      host: url.hostname,
      'Content-Type': 'application/json',
    },
    body,
  });

  const signedReq = await signer.sign(request);

  const response = await fetch(`https://${url.hostname}${url.pathname}`, {
    method: signedReq.method,
    headers: signedReq.headers as Record<string, string>,
    body: signedReq.body,
  });

  const responseBody = await response.text();
  return { statusCode: response.status, body: responseBody };
}

/**
 * Create the photo-vectors index with k-NN mapping if it doesn't exist.
 * Uses 1024 dimensions to match Titan Embeddings V2 output.
 */
export async function ensureIndex(): Promise<void> {
  // Check if index exists
  const check = await signedRequest('HEAD', `/${INDEX_NAME}`);
  if (check.statusCode === 200) return;

  const mapping = {
    settings: {
      index: {
        knn: true,
        'knn.algo_param.ef_search': 100,
      },
    },
    mappings: {
      properties: {
        photoId: { type: 'keyword' },
        userId: { type: 'keyword' },
        groupId: { type: 'keyword' },
        filename: { type: 'text' },
        originalName: { type: 'text' },
        tags: { type: 'text' },
        people: { type: 'text' },
        groupName: { type: 'keyword' },
        takenAt: { type: 'date' },
        uploadedAt: { type: 'date' },
        embeddingText: { type: 'text' },
        vector: {
          type: 'knn_vector',
          dimension: 1024,
          method: {
            name: 'hnsw',
            space_type: 'cosinesimil',
            engine: 'nmslib',
            parameters: {
              ef_construction: 128,
              m: 16,
            },
          },
        },
      },
    },
  };

  const result = await signedRequest('PUT', `/${INDEX_NAME}`, JSON.stringify(mapping));
  if (result.statusCode !== 200) {
    throw new Error(`Failed to create index: ${result.body}`);
  }
  console.log('Created OpenSearch index:', INDEX_NAME);
}

/**
 * Index (upsert) a photo document with its embedding vector.
 * Uses the photoId as the document ID for idempotent updates.
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
  const result = await signedRequest(
    'PUT',
    `/${INDEX_NAME}/_doc/${doc.photoId}`,
    JSON.stringify(doc)
  );

  if (result.statusCode !== 200 && result.statusCode !== 201) {
    throw new Error(`Failed to index photo ${doc.photoId}: ${result.body}`);
  }
}

/**
 * Delete a photo document from the index.
 */
export async function deletePhoto(photoId: string): Promise<void> {
  const result = await signedRequest('DELETE', `/${INDEX_NAME}/_doc/${photoId}`);
  if (result.statusCode !== 200 && result.statusCode !== 404) {
    throw new Error(`Failed to delete photo ${photoId}: ${result.body}`);
  }
}
