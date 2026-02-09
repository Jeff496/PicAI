import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});
const TABLE_NAME = process.env.CHAT_HISTORY_TABLE || 'picai-chat-history';

export interface ChatPhotoMatch {
  photoId: string;
  tags: string[];
  people: string[];
  takenAt: string | null;
  uploadedAt: string;
  originalName: string;
  groupName: string | null;
  score: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  photoIds?: string[];
  photos?: ChatPhotoMatch[];
}

export interface ChatSession {
  userId: string;
  sessionId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  ttl?: number;
}

/**
 * Get a chat session by userId + sessionId.
 * Returns null if not found.
 */
export async function getSession(
  userId: string,
  sessionId: string
): Promise<ChatSession | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId, sessionId },
    })
  );

  return (result.Item as ChatSession) || null;
}

/**
 * Save or update a chat session.
 * Generates a title from the first user message if new.
 */
export async function saveSession(session: ChatSession): Promise<void> {
  // Set TTL to 90 days from now
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...session,
        ttl,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

/**
 * List chat sessions for a user, sorted by most recent.
 * Returns session summaries (no messages).
 */
export async function listSessions(
  userId: string,
  limit: number = 20
): Promise<Array<{ sessionId: string; title: string; createdAt: string; updatedAt: string }>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ProjectionExpression: 'sessionId, title, createdAt, updatedAt',
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    })
  );

  return (result.Items || []) as Array<{
    sessionId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * Delete a chat session by userId + sessionId.
 */
export async function deleteSession(
  userId: string,
  sessionId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { userId, sessionId },
    })
  );
}

/**
 * Generate a short title from the first user message.
 */
export function generateTitle(firstMessage: string): string {
  // Truncate to ~50 chars, break at word boundary
  const maxLen = 50;
  if (firstMessage.length <= maxLen) return firstMessage;
  const truncated = firstMessage.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...';
}
