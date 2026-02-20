// Import tracing first so OTel registers before AWS SDK clients init
import { tracer, forceFlush } from './tracing';
import { SpanStatusCode } from '@opentelemetry/api';

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { searchPhotos, type SearchTiming, type SearchParams } from './search';
import { generateResponse } from './bedrock';
import { getSession, saveSession, deleteSession, listSessions, generateTitle, type ChatMessage, type ChatPhotoMatch } from './history';
import { randomUUID } from 'crypto';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.resource;

  console.log(`Chat handler: ${method} ${path}`);

  try {
    if (method === 'POST' && path === '/chat') {
      return handleChat(event);
    }

    if (method === 'GET' && path === '/chat/history') {
      return handleGetHistory(event);
    }

    if (method === 'DELETE' && path === '/chat/history') {
      return handleDeleteSession(event);
    }

    return respond(404, { success: false, error: 'Not found' });
  } catch (error) {
    console.error('Chat handler error:', error);
    return respond(500, {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};

/**
 * POST /chat
 * Body: { message, userId, sessionId? }
 *
 * Orchestrates the full RAG flow:
 * 1. Load/create session from DynamoDB
 * 2. Embed query -> k-NN search OpenSearch
 * 3. Build prompt with context + history -> Bedrock Claude
 * 4. Save conversation turn -> DynamoDB
 * 5. Return response
 */
async function handleChat(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { message, userId, sessionId: requestedSessionId, groupIds, searchParams: rawSearchParams } = body;

  if (!message || !userId) {
    return respond(400, { success: false, error: 'message and userId are required' });
  }

  // Optional per-request search parameter overrides (for hyperparameter tuning)
  const searchParams: SearchParams | undefined = rawSearchParams ? {
    k: typeof rawSearchParams.k === 'number' ? rawSearchParams.k : undefined,
    minScore: typeof rawSearchParams.minScore === 'number' ? rawSearchParams.minScore : undefined,
    relativeCutoff: typeof rawSearchParams.relativeCutoff === 'number' ? rawSearchParams.relativeCutoff : undefined,
  } : undefined;

  return tracer.startActiveSpan('chat.request', async (rootSpan) => {
  rootSpan.setAttributes({
    'user.id': userId,
    'chat.query': message.substring(0, 200),
  });

  try {
    const totalStart = Date.now();

    // 1. Load or create session
    const sessionStart = Date.now();
    const sessionId = requestedSessionId || randomUUID();

    let session = await tracer.startActiveSpan('chat.session.load', async (span) => {
      try {
        span.setAttributes({ 'session.id': sessionId, 'session.is_requested': !!requestedSessionId });
        const s = await getSession(userId, sessionId);
        span.setAttribute('session.found', !!s);
        return s;
      } finally {
        span.end();
      }
    });

    const isNewSession = !session;
    rootSpan.setAttributes({ 'session.id': sessionId, 'session.is_new': isNewSession });

    if (!session) {
      session = {
        userId,
        sessionId,
        title: generateTitle(message),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    const sessionLoadMs = Date.now() - sessionStart;

    // 2. Search for relevant photos (user's own + group photos)
    const validGroupIds = Array.isArray(groupIds) ? groupIds.filter((id: unknown) => typeof id === 'string') : [];
    console.log(`Searching photos for query: "${message}" (user=${userId}, groups=${validGroupIds.length})`);

    const { results: photos, timing: searchTiming } = await tracer.startActiveSpan('chat.search', async (span) => {
      try {
        span.setAttributes({
          'search.query': message.substring(0, 200),
          'search.group_count': validGroupIds.length,
          ...(searchParams?.k != null && { 'search.override_k': searchParams.k }),
          ...(searchParams?.minScore != null && { 'search.override_min_score': searchParams.minScore }),
          ...(searchParams?.relativeCutoff != null && { 'search.override_relative_cutoff': searchParams.relativeCutoff }),
        });
        const result = await searchPhotos(message, userId, validGroupIds.length > 0 ? validGroupIds : undefined, searchParams);
        span.setAttributes({
          'search.result_count': result.results.length,
          'search.embed_ms': result.timing.embedMs,
          'search.search_ms': result.timing.searchMs,
          'search.total_ms': result.timing.totalMs,
          'search.top_score': result.results.length > 0 ? result.results[0]!.score : 0,
        });
        return result;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : 'search failed' });
        throw err;
      } finally {
        span.end();
      }
    });

    console.log(`Found ${photos.length} matching photos`);

    // 3. Generate LLM response with photo context + conversation history
    console.log('Calling Bedrock Claude...');
    const llmStart = Date.now();

    const llmResponse = await tracer.startActiveSpan('chat.llm.generate', async (span) => {
      try {
        span.setAttributes({
          'llm.photo_context_count': photos.length,
          'llm.history_message_count': session!.messages.length,
        });
        const resp = await generateResponse(message, photos, session!.messages);
        const llmElapsed = Date.now() - llmStart;
        span.setAttributes({
          'llm.input_tokens': resp.inputTokens,
          'llm.output_tokens': resp.outputTokens,
          'llm.referenced_photo_count': resp.photoIds.length,
          'llm.latency_ms': llmElapsed,
        });
        return resp;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : 'llm failed' });
        throw err;
      } finally {
        span.end();
      }
    });

    const llmMs = Date.now() - llmStart;
    console.log(`LLM response: ${llmResponse.inputTokens} input, ${llmResponse.outputTokens} output tokens (${llmMs}ms)`);

    // 4. Save conversation turn
    const saveStart = Date.now();
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Build photo match objects -- only include photos the LLM actually referenced
    const referencedIds = new Set(llmResponse.photoIds);
    const photoMatches: ChatPhotoMatch[] = photos
      .filter((p) => referencedIds.has(p.photoId))
      .map((p) => ({
        photoId: p.photoId,
        tags: p.tags ? p.tags.split(', ').filter(Boolean) : [],
        people: p.people ? p.people.split(', ').filter(Boolean) : [],
        takenAt: p.takenAt || null,
        uploadedAt: p.uploadedAt || '',
        originalName: p.originalName || '',
        groupName: p.groupName || null,
        score: p.score,
      }));

    console.log(`Photo filtering: ${photos.length} search results -> ${llmResponse.photoIds.length} LLM-referenced -> ${photoMatches.length} returned`);

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: llmResponse.text,
      timestamp: new Date().toISOString(),
      photoIds: llmResponse.photoIds.length > 0 ? llmResponse.photoIds : undefined,
      photos: photoMatches.length > 0 ? photoMatches : undefined,
    };

    session.messages.push(userMessage, assistantMessage);

    await tracer.startActiveSpan('chat.session.save', async (span) => {
      try {
        span.setAttributes({
          'session.id': sessionId,
          'session.message_count': session!.messages.length,
        });
        await saveSession(session!);
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : 'save failed' });
        throw err;
      } finally {
        span.end();
      }
    });

    const saveMs = Date.now() - saveStart;
    const totalMs = Date.now() - totalStart;

    const latency = {
      sessionLoadMs,
      embedMs: searchTiming.embedMs,
      searchMs: searchTiming.searchMs,
      llmMs,
      saveMs,
      totalMs,
    };

    console.log('Latency breakdown:', JSON.stringify(latency));

    rootSpan.setAttributes({
      'chat.total_ms': totalMs,
      'chat.photo_count': photoMatches.length,
      'chat.input_tokens': llmResponse.inputTokens,
      'chat.output_tokens': llmResponse.outputTokens,
    });

    // 5. Return response
    return respond(200, {
      success: true,
      data: {
        sessionId,
        isNewSession,
        response: llmResponse.text,
        photos: photoMatches,
        usage: {
          inputTokens: llmResponse.inputTokens,
          outputTokens: llmResponse.outputTokens,
        },
        latency,
      },
    });
  } catch (error) {
    rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : 'unknown error' });
    rootSpan.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    rootSpan.end();
    await forceFlush();
  }
  }); // end startActiveSpan
}

/**
 * GET /chat/history?userId=xxx&sessionId=yyy
 *
 * If sessionId provided: returns full session with messages.
 * If only userId: returns list of session summaries.
 */
async function handleGetHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  const sessionId = event.queryStringParameters?.sessionId;

  if (!userId) {
    return respond(400, { success: false, error: 'userId query parameter is required' });
  }

  // Return specific session with full messages
  if (sessionId) {
    const session = await getSession(userId, sessionId);
    if (!session) {
      return respond(404, { success: false, error: 'Session not found' });
    }
    return respond(200, { success: true, data: { session } });
  }

  // Return list of sessions
  const sessions = await listSessions(userId);
  return respond(200, { success: true, data: { sessions } });
}

/**
 * DELETE /chat/history?userId=xxx&sessionId=yyy
 *
 * Deletes a specific chat session from DynamoDB.
 */
async function handleDeleteSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  const sessionId = event.queryStringParameters?.sessionId;

  if (!userId || !sessionId) {
    return respond(400, { success: false, error: 'userId and sessionId query parameters are required' });
  }

  await deleteSession(userId, sessionId);
  return respond(200, { success: true, message: 'Session deleted' });
}

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
