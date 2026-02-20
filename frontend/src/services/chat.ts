// src/services/chat.ts
// Chat API service - connects to AWS API Gateway (separate from Pi backend)
// No JWT auth needed - Lambda receives userId in request body/params

import type {
  ChatResponse,
  ChatHistorySessionsResponse,
  ChatHistorySessionResponse,
} from '@/types/api';

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL;

async function chatFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!CHAT_API_URL) {
    throw new Error('VITE_CHAT_API_URL is not configured');
  }

  const response = await fetch(`${CHAT_API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Chat API error: ${response.status}`);
  }

  return response.json();
}

export const chatService = {
  async sendMessage(
    message: string,
    userId: string,
    sessionId?: string,
    groupIds?: string[]
  ): Promise<ChatResponse> {
    return chatFetch<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, userId, sessionId, groupIds }),
    });
  },

  async getSessions(userId: string): Promise<ChatHistorySessionsResponse> {
    const params = new URLSearchParams({ userId });
    return chatFetch<ChatHistorySessionsResponse>(`/chat/history?${params}`);
  },

  async getSession(userId: string, sessionId: string): Promise<ChatHistorySessionResponse> {
    const params = new URLSearchParams({ userId, sessionId });
    return chatFetch<ChatHistorySessionResponse>(`/chat/history?${params}`);
  },

  async deleteSession(
    userId: string,
    sessionId: string
  ): Promise<{ success: true; message: string }> {
    const params = new URLSearchParams({ userId, sessionId });
    return chatFetch<{ success: true; message: string }>(`/chat/history?${params}`, {
      method: 'DELETE',
    });
  },
};
