import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { PhotoMatch } from './search';
import type { ChatMessage } from './history';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });
const LLM_MODEL_ID = process.env.LLM_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

const SYSTEM_PROMPT = `You are PicAI Assistant, a helpful chatbot for a photo management application. You help users find and learn about their photos using the context provided from their photo library.

Guidelines:
- Answer questions about the user's photos based on the retrieved context below.
- When referencing specific photos, include the photoId so the frontend can display them.
- If the retrieved context doesn't contain enough information to answer, say so honestly.
- Be concise and conversational. Use natural language, not technical jargon.
- When listing photos, format them clearly with relevant details (tags, people, dates).
- You can count, summarize, and reason about the photo metadata provided.
- Never make up information about photos that aren't in the context.`;

export interface LLMResponse {
  text: string;
  photoIds: string[];
  inputTokens: number;
  outputTokens: number;
}

/**
 * Build the context section from retrieved photo matches.
 */
function buildPhotoContext(photos: PhotoMatch[]): string {
  if (photos.length === 0) {
    return 'No matching photos were found in the library.';
  }

  const lines = photos.map((p, i) => {
    const parts = [`Photo ${i + 1} [id: ${p.photoId}]`];
    if (p.embeddingText) parts.push(`  Description: ${p.embeddingText}`);
    if (p.score) parts.push(`  Relevance: ${(p.score * 100).toFixed(0)}%`);
    return parts.join('\n');
  });

  return `Retrieved ${photos.length} matching photo(s):\n\n${lines.join('\n\n')}`;
}

/**
 * Build the messages array for the Claude API call.
 * Includes conversation history for multi-turn context.
 */
function buildMessages(
  userMessage: string,
  photoContext: string,
  history: ChatMessage[]
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // Add conversation history (last 10 turns max to stay within token limits)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current user message with photo context
  const augmentedMessage = `<photo-context>\n${photoContext}\n</photo-context>\n\nUser question: ${userMessage}`;
  messages.push({ role: 'user', content: augmentedMessage });

  return messages;
}

/**
 * Extract photo IDs referenced in the response text.
 */
function extractPhotoIds(text: string, availableIds: string[]): string[] {
  return availableIds.filter((id) => text.includes(id));
}

/**
 * Call Bedrock Claude to generate a response given photo context and conversation history.
 */
export async function generateResponse(
  userMessage: string,
  photos: PhotoMatch[],
  history: ChatMessage[]
): Promise<LLMResponse> {
  const photoContext = buildPhotoContext(photos);
  const messages = buildMessages(userMessage, photoContext, history);

  const command = new InvokeModelCommand({
    modelId: LLM_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));

  const text = result.content?.[0]?.text || 'I was unable to generate a response.';
  const availablePhotoIds = photos.map((p) => p.photoId);
  const photoIds = extractPhotoIds(text, availablePhotoIds);

  return {
    text,
    photoIds,
    inputTokens: result.usage?.input_tokens || 0,
    outputTokens: result.usage?.output_tokens || 0,
  };
}
