import { tracer } from './tracing';
import { SpanStatusCode } from '@opentelemetry/api';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
const EMBEDDING_MODEL_ID = process.env.EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT || '';
const INDEX_NAME = process.env.OPENSEARCH_INDEX || 'photo-vectors';

const signer = new SignatureV4({
  service: 'es',
  region: 'us-east-1',
  credentials: defaultProvider(),
  sha256: Sha256,
});

export interface PhotoMatch {
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
  score: number;
}

/**
 * Embed a query string using Titan Embeddings V2.
 */
async function embedQuery(text: string): Promise<number[]> {
  return tracer.startActiveSpan('chat.search.embed', async (span) => {
    try {
      span.setAttributes({
        'embed.model': EMBEDDING_MODEL_ID,
        'embed.dimensions': 1024,
      });
      const start = Date.now();

      const command = new InvokeModelCommand({
        modelId: EMBEDDING_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: text,
          dimensions: 1024,
          normalize: true,
        }),
      });

      const response = await bedrockClient.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));
      span.setAttribute('embed.latency_ms', Date.now() - start);
      return result.embedding;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : 'embed failed' });
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Send a signed request to OpenSearch.
 */
async function signedRequest(
  method: string,
  path: string,
  body?: string
): Promise<{ statusCode: number; body: string }> {
  return tracer.startActiveSpan('chat.search.opensearch', async (span) => {
    try {
      span.setAttributes({
        'opensearch.method': method,
        'opensearch.path': path,
        'opensearch.index': INDEX_NAME,
      });

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
      span.setAttribute('opensearch.status_code', response.status);

      if (response.status === 200) {
        const parsed = JSON.parse(responseBody);
        const hits = parsed.hits?.hits || [];
        span.setAttributes({
          'opensearch.candidate_count': hits.length,
          'opensearch.top_score': hits.length > 0 ? hits[0]._score : 0,
        });
      }

      return { statusCode: response.status, body: responseBody };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : 'opensearch failed' });
      throw err;
    } finally {
      span.end();
    }
  });
}

// Minimum absolute score (cosinesimil: 0.5 = orthogonal/no correlation)
const MIN_SCORE = parseFloat(process.env.MIN_SEARCH_SCORE || '0.5');
// Drop results scoring below this fraction of the top result's score
const RELATIVE_SCORE_CUTOFF = parseFloat(process.env.RELATIVE_SCORE_CUTOFF || '0.75');

/**
 * Search for photos similar to a query using k-NN vector search.
 * Embeds the query text, then performs k-NN on OpenSearch.
 * Filters results by absolute and relative score thresholds
 * so only genuinely relevant photos are returned.
 *
 * @param query - Natural language query from user
 * @param userId - Filter results to this user's photos
 * @param groupIds - Optional group IDs to also include group photos
 * @param k - Number of candidates to fetch from OpenSearch (default 10)
 * @returns Array of matched photos with similarity scores, filtered by relevance
 */
export interface SearchTiming {
  embedMs: number;
  searchMs: number;
  totalMs: number;
}

export async function searchPhotos(
  query: string,
  userId: string,
  groupIds?: string[],
  k: number = 10
): Promise<{ results: PhotoMatch[]; timing: SearchTiming }> {
  const t0 = Date.now();

  // Step 1: Embed the query
  const queryVector = await embedQuery(query);
  const embedMs = Date.now() - t0;

  // Step 2: k-NN search with user + group filter
  // Include photos owned by the user OR belonging to any of their groups
  const t1 = Date.now();

  const filterClauses: object[] = [{ term: { userId } }];
  if (groupIds && groupIds.length > 0) {
    filterClauses.push({ terms: { groupId: groupIds } });
  }

  const filter =
    filterClauses.length === 1
      ? filterClauses[0]
      : { bool: { should: filterClauses, minimum_should_match: 1 } };

  const searchBody = {
    size: k,
    query: {
      bool: {
        must: {
          knn: {
            vector: {
              vector: queryVector,
              k,
            },
          },
        },
        filter,
      },
    },
    _source: {
      excludes: ['vector'], // Don't return the large vector field
    },
  };

  const result = await signedRequest(
    'POST',
    `/${INDEX_NAME}/_search`,
    JSON.stringify(searchBody)
  );

  const searchMs = Date.now() - t1;

  if (result.statusCode !== 200) {
    console.error('OpenSearch search failed:', result.body);
    return { results: [], timing: { embedMs, searchMs, totalMs: Date.now() - t0 } };
  }

  const parsed = JSON.parse(result.body);
  const hits = parsed.hits?.hits || [];

  const allResults: PhotoMatch[] = hits.map((hit: { _source: Record<string, string>; _score: number }) => ({
    ...hit._source,
    score: hit._score,
  }));

  const timing: SearchTiming = { embedMs, searchMs, totalMs: Date.now() - t0 };

  if (allResults.length === 0) return { results: [], timing };

  // Step 3: Filter by score thresholds
  const topScore = allResults[0].score;
  const relativeThreshold = topScore * RELATIVE_SCORE_CUTOFF;
  const threshold = Math.max(MIN_SCORE, relativeThreshold);

  const filtered = allResults.filter((r) => r.score >= threshold);

  console.log(
    `Score filtering: top=${topScore.toFixed(3)}, threshold=${threshold.toFixed(3)} ` +
    `(abs=${MIN_SCORE}, rel=${relativeThreshold.toFixed(3)}), ` +
    `${allResults.length} candidates → ${filtered.length} passed`
  );
  for (const r of allResults) {
    console.log(`  [${r.score >= threshold ? 'KEEP' : 'DROP'}] ${r.photoId} score=${r.score.toFixed(3)} tags=${r.tags || 'none'}`);
  }

  timing.totalMs = Date.now() - t0;
  return { results: filtered, timing };
}
