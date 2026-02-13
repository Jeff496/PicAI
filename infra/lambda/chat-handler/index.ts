import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { searchPhotos, type SearchTiming } from './search';
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
 * 2. Embed query → k-NN search OpenSearch
 * 3. Build prompt with context + history → Bedrock Claude
 * 4. Save conversation turn → DynamoDB
 * 5. Return response
 */
async function handleChat(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { message, userId, sessionId: requestedSessionId } = body;

  if (!message || !userId) {
    return respond(400, { success: false, error: 'message and userId are required' });
  }

  const totalStart = Date.now();

  // 1. Load or create session
  const sessionStart = Date.now();
  const sessionId = requestedSessionId || randomUUID();
  let session = await getSession(userId, sessionId);
  const isNewSession = !session;

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

  // 2. Search for relevant photos
  console.log(`Searching photos for query: "${message}"`);
  const { results: photos, timing: searchTiming } = await searchPhotos(message, userId);
  console.log(`Found ${photos.length} matching photos`);

  // 3. Generate LLM response with photo context + conversation history
  console.log('Calling Bedrock Claude...');
  const llmStart = Date.now();
  const llmResponse = await generateResponse(message, photos, session.messages);
  const llmMs = Date.now() - llmStart;
  console.log(`LLM response: ${llmResponse.inputTokens} input, ${llmResponse.outputTokens} output tokens (${llmMs}ms)`);

  // 4. Save conversation turn
  const saveStart = Date.now();
  const userMessage: ChatMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  };

  // Build photo match objects — only include photos the LLM actually referenced
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

  console.log(`Photo filtering: ${photos.length} search results → ${llmResponse.photoIds.length} LLM-referenced → ${photoMatches.length} returned`);

  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: llmResponse.text,
    timestamp: new Date().toISOString(),
    photoIds: llmResponse.photoIds.length > 0 ? llmResponse.photoIds : undefined,
    photos: photoMatches.length > 0 ? photoMatches : undefined,
  };

  session.messages.push(userMessage, assistantMessage);
  await saveSession(session);
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
