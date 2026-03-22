import { tracer } from './tracing.js';
import { SpanStatusCode } from '@opentelemetry/api';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { supabase } from '../shared/supabase.js';

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
const EMBEDDING_MODEL_ID = process.env.EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';

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

// Default thresholds — overridable via env vars and per-request searchParams
const DEFAULT_MIN_SCORE = parseFloat(process.env.MIN_SEARCH_SCORE || '0.5');
const DEFAULT_RELATIVE_CUTOFF = parseFloat(process.env.RELATIVE_SCORE_CUTOFF || '0.75');
const DEFAULT_K = parseInt(process.env.SEARCH_K || '10', 10);

/**
 * Optional per-request search parameter overrides for hyperparameter tuning.
 * If omitted, falls back to env vars then hardcoded defaults.
 */
export interface SearchParams {
  k?: number;
  minScore?: number;
  relativeCutoff?: number;
}

export interface SearchTiming {
  embedMs: number;
  searchMs: number;
  totalMs: number;
}

/**
 * Search for photos similar to a query using pgvector cosine similarity.
 * Embeds the query text, then calls the search_photos RPC on Supabase.
 * Filters results by absolute and relative score thresholds
 * so only genuinely relevant photos are returned.
 */
export async function searchPhotos(
  query: string,
  userId: string,
  groupIds?: string[],
  searchParams?: SearchParams
): Promise<{ results: PhotoMatch[]; timing: SearchTiming }> {
  const k = searchParams?.k ?? DEFAULT_K;
  const minScore = searchParams?.minScore ?? DEFAULT_MIN_SCORE;
  const relativeCutoff = searchParams?.relativeCutoff ?? DEFAULT_RELATIVE_CUTOFF;
  const t0 = Date.now();

  // Step 1: Embed the query
  const queryVector = await embedQuery(query);
  const embedMs = Date.now() - t0;

  // Step 2: Vector similarity search via Supabase RPC
  const t1 = Date.now();

  const allResults: PhotoMatch[] = await tracer.startActiveSpan('chat.search.pgvector', async (span) => {
    try {
      span.setAttributes({
        'pgvector.k': k,
        'pgvector.user_id': userId,
        'pgvector.group_count': groupIds?.length ?? 0,
      });

      const { data, error } = await supabase.rpc('search_photos', {
        query_embedding: JSON.stringify(queryVector),
        match_user_id: userId,
        match_group_ids: groupIds ?? [],
        match_count: k,
      });

      if (error) {
        throw new Error(`Supabase search failed: ${error.message}`);
      }

      const results: PhotoMatch[] = (data || []).map((row: Record<string, unknown>) => ({
        photoId: row.photo_id as string,
        userId: row.user_id as string,
        groupId: row.group_id as string | undefined,
        filename: row.filename as string | undefined,
        originalName: row.original_name as string | undefined,
        tags: row.tags as string | undefined,
        people: row.people as string | undefined,
        groupName: row.group_name as string | undefined,
        takenAt: row.taken_at as string | undefined,
        uploadedAt: row.uploaded_at as string | undefined,
        embeddingText: row.embedding_text as string,
        // Transform raw cosine similarity to match OpenSearch's nmslib cosinesimil scoring:
        // OpenSearch score = 1 / (1 + cosine_distance) = 1 / (2 - cosine_similarity)
        // This preserves compatibility with the tuned minScore/relativeCutoff thresholds.
        score: 1 / (2 - (row.similarity as number)),
      }));

      span.setAttributes({
        'pgvector.candidate_count': results.length,
        'pgvector.top_score': results.length > 0 ? results[0].score : 0,
      });

      return results;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : 'pgvector search failed' });
      throw err;
    } finally {
      span.end();
    }
  });

  const searchMs = Date.now() - t1;

  const timing: SearchTiming = { embedMs, searchMs, totalMs: Date.now() - t0 };

  if (allResults.length === 0) return { results: [], timing };

  // Step 3: Filter by score thresholds
  const topScore = allResults[0].score;
  const relativeThreshold = topScore * relativeCutoff;
  const threshold = Math.max(minScore, relativeThreshold);

  const filtered = allResults.filter((r) => r.score >= threshold);

  console.log(
    `Score filtering: top=${topScore.toFixed(3)}, threshold=${threshold.toFixed(3)} ` +
    `(abs=${minScore}, rel=${relativeThreshold.toFixed(3)}, k=${k}), ` +
    `${allResults.length} candidates → ${filtered.length} passed`
  );
  for (const r of allResults) {
    console.log(`  [${r.score >= threshold ? 'KEEP' : 'DROP'}] ${r.photoId} score=${r.score.toFixed(3)} tags=${r.tags || 'none'}`);
  }

  timing.totalMs = Date.now() - t0;
  return { results: filtered, timing };
}
