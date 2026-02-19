// src/hooks/useChat.ts
// TanStack Query hooks for the RAG chatbot

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '@/services/chat';
import { useAuthStore } from '@/stores/authStore';

// Query key factory
export const chatKeys = {
  all: ['chat'] as const,
  sessions: (userId: string) => [...chatKeys.all, 'sessions', userId] as const,
  session: (userId: string, sessionId: string) =>
    [...chatKeys.all, 'session', userId, sessionId] as const,
};

/**
 * Fetch list of chat session summaries for current user.
 */
export function useChatSessions() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: chatKeys.sessions(userId || ''),
    queryFn: () => chatService.getSessions(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch a specific chat session with full messages.
 */
export function useChatSession(sessionId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: chatKeys.session(userId || '', sessionId || ''),
    queryFn: () => chatService.getSession(userId!, sessionId!),
    enabled: !!userId && !!sessionId,
  });
}

/**
 * Send a message mutation. Returns chat response with LLM answer + photo matches.
 */
export function useSendMessage() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ message, sessionId, groupIds }: { message: string; sessionId?: string; groupIds?: string[] }) =>
      chatService.sendMessage(message, userId!, sessionId, groupIds),
    onSuccess: (data) => {
      // Invalidate sessions list (new session may have been created, or title updated)
      if (userId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.sessions(userId) });
      }
      // Invalidate specific session if it existed
      if (userId && data.data.sessionId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.session(userId, data.data.sessionId),
        });
      }
    },
  });
}

/**
 * Delete a chat session mutation. Invalidates sessions list on success.
 */
export function useDeleteSession() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => chatService.deleteSession(userId!, sessionId),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.sessions(userId) });
      }
    },
  });
}
