// src/pages/ChatPage.tsx
// RAG Chatbot page - ask questions about your photo library

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Plus,
  MessageSquare,
  Bot,
  User,
  Image,
  Menu,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useChatSessions, useSendMessage, useDeleteSession } from '@/hooks/useChat';
import { useGroups } from '@/hooks/useGroups';
import { useThumbnail } from '@/hooks/usePhotos';
import { useAuthStore } from '@/stores/authStore';
import { chatService } from '@/services/chat';
import { photosService } from '@/services/photos';
import type { ChatMessage, ChatPhotoMatch, ChatSessionSummary } from '@/types/api';

export function ChatPage() {
  const [input, setInput] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<ChatSessionSummary | null>(null);

  const userId = useAuthStore((s) => s.user?.id);
  const { data: sessionsData, isLoading: sessionsLoading } = useChatSessions();
  const { data: groupsData } = useGroups();
  const sendMessage = useSendMessage();
  const deleteSessionMutation = useDeleteSession();

  // Extract group IDs for search scope (user's own photos + all group photos)
  const groupIds = groupsData?.data?.groups?.map((g) => g.id);

  const sessions = sessionsData?.data?.sessions ?? [];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setLocalMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSessionMutation.mutateAsync(deleteTarget.sessionId);
      // If we deleted the active session, reset to empty state
      if (activeSessionId === deleteTarget.sessionId) {
        setActiveSessionId(null);
        setLocalMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
    setDeleteTarget(null);
  };

  const handleLoadSession = useCallback(
    async (session: ChatSessionSummary) => {
      if (!userId) return;
      setActiveSessionId(session.sessionId);
      setLocalMessages([]);
      setSidebarOpen(false);

      // Fetch full session from API
      try {
        const response = await chatService.getSession(userId, session.sessionId);
        const messages = response.data.session.messages;

        // Backward compatibility: for old sessions where assistant messages
        // have photoIds but no photos array, create minimal photo objects
        // so thumbnails can still load
        const enriched = messages.map((msg) => {
          if (msg.role === 'assistant' && msg.photoIds?.length && !msg.photos?.length) {
            return {
              ...msg,
              photos: msg.photoIds.map((id) => ({
                photoId: id,
                tags: [],
                people: [],
                takenAt: null,
                uploadedAt: '',
                originalName: '',
                groupName: null,
                score: 0,
              })),
            };
          }
          return msg;
        });

        setLocalMessages(enriched);
      } catch (err) {
        console.error('Failed to load session:', err);
      }
    },
    [userId]
  );

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Optimistically add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);

    try {
      const response = await sendMessage.mutateAsync({
        message: trimmed,
        sessionId: activeSessionId ?? undefined,
        groupIds,
      });

      const { sessionId, response: text, photos } = response.data;

      // Set session ID if this was a new conversation
      if (!activeSessionId) {
        setActiveSessionId(sessionId);
      }

      // Add assistant message with photos stored directly on it
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString(),
        photoIds: photos.map((p) => p.photoId),
        photos: photos.length > 0 ? photos : undefined,
      };
      setLocalMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      // Add error message
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, errorMsg]);
      console.error('Chat error:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-5 top-[5.5rem] z-20 rounded-md bg-white p-1.5 shadow-sm ring-1 ring-gray-200 sm:hidden dark:bg-gray-800 dark:ring-white/10"
        >
          {sidebarOpen ? <XIcon className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } absolute z-10 h-full w-64 border-r border-gray-200 bg-gray-50 transition-transform sm:relative sm:translate-x-0 dark:border-white/10 dark:bg-gray-950`}
        >
          <div className="flex h-full flex-col">
            {/* New chat button */}
            <div className="border-b border-gray-200 p-3 dark:border-white/10">
              <button
                onClick={handleNewChat}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            {/* Sessions list */}
            <div className="flex-1 overflow-y-auto p-2">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  No conversations yet
                </p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className={`group/session mb-1 flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      activeSessionId === session.sessionId
                        ? 'bg-gray-200 text-gray-900 dark:bg-white/10 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
                    }`}
                  >
                    <button
                      onClick={() => handleLoadSession(session)}
                      className="flex min-w-0 flex-1 items-start gap-2"
                    >
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-2">{session.title}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(session);
                      }}
                      className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-red-500 group-hover/session:opacity-100 dark:hover:bg-white/10 dark:hover:text-red-400"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {localMessages.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {localMessages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}

                {/* Typing indicator */}
                {sendMessage.isPending && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-xl rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-white/5">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-white/10 dark:bg-gray-900">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your photos..."
                rows={1}
                className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sendMessage.isPending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete session confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Delete Conversation
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete &ldquo;{deleteTarget.title}&rdquo;? This cannot be
              undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSession}
                disabled={deleteSessionMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteSessionMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ============================================
// Sub-components
// ============================================

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
        <Bot className="h-7 w-7 text-accent" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">PicAI Chat</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Ask questions about your photo library. I can help you find photos, summarize what you've
        captured, and more.
      </p>
      <div className="mt-6 grid gap-2 text-left text-sm">
        {[
          'Show me photos from the beach',
          'When did I last take photos with Sarah?',
          'What photos have dogs in them?',
        ].map((example) => (
          <span
            key={example}
            className="rounded-lg border border-gray-200 px-3 py-2 text-gray-500 dark:border-white/10 dark:text-gray-400"
          >
            "{example}"
          </span>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const photos = message.photos;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300'
            : 'bg-accent/10 text-accent'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={`max-w-[85%] space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-accent text-white'
              : 'rounded-tl-sm bg-gray-100 text-gray-900 dark:bg-white/5 dark:text-gray-100'
          }`}
        >
          <FormattedText text={message.content} />
        </div>

        {/* Photo grid */}
        {photos && photos.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {photos.map((photo, idx) => (
              <PhotoThumbnail
                key={photo.photoId}
                photo={photo}
                onClick={() => setLightboxIndex(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {photos && lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const parts = text.split('\n');
  return (
    <>
      {parts.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}

function PhotoThumbnail({ photo, onClick }: { photo: ChatPhotoMatch; onClick: () => void }) {
  const { data: thumbnailUrl, isLoading, isError, refetch } = useThumbnail(photo.photoId);

  return (
    <button
      onClick={isError ? undefined : onClick}
      className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 transition-transform hover:scale-[1.03] dark:bg-white/5"
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
        </div>
      ) : thumbnailUrl ? (
        <img src={thumbnailUrl} alt={photo.originalName} className="h-full w-full object-cover" />
      ) : isError ? (
        <div
          className="flex h-full flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500"
          onClick={(e) => {
            e.stopPropagation();
            refetch();
          }}
          title="Click to retry"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="text-[9px]">Retry</span>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-gray-300 dark:text-gray-600">
          <Image className="h-6 w-6" />
        </div>
      )}
      {/* Hover overlay with name */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-[10px] font-medium text-white">{photo.originalName}</p>
      </div>
    </button>
  );
}

function PhotoLightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: ChatPhotoMatch[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [photoCache, setPhotoCache] = useState<Record<string, string>>({});
  const photo = photos[index]!;
  const fullUrl = photoCache[photo.photoId] ?? null;
  const loading = !fullUrl && !(photo.photoId in photoCache);

  // Load full-size photo
  useEffect(() => {
    if (photo.photoId in photoCache) return;
    let cancelled = false;
    photosService
      .fetchFileBlob(photo.photoId)
      .then((url) => {
        if (!cancelled) setPhotoCache((prev) => ({ ...prev, [photo.photoId]: url }));
      })
      .catch(() => {
        if (!cancelled) setPhotoCache((prev) => ({ ...prev, [photo.photoId]: '' }));
      });
    return () => {
      cancelled = true;
    };
  }, [photo.photoId, photoCache]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      if (e.key === 'ArrowRight' && index < photos.length - 1) setIndex(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, photos.length, onClose]);

  const date = photo.takenAt || photo.uploadedAt;
  const formattedDate = date
    ? new Date(date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
        >
          <XIcon className="h-4 w-4" />
        </button>

        {/* Image */}
        <div className="relative flex min-h-[300px] items-center justify-center bg-gray-950 sm:min-h-[400px]">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          ) : fullUrl ? (
            <img
              src={fullUrl}
              alt={photo.originalName}
              className="max-h-[70vh] max-w-full object-contain"
            />
          ) : (
            <div className="text-white/40">
              <Image className="h-12 w-12" />
            </div>
          )}

          {/* Nav arrows */}
          {index > 0 && (
            <button
              onClick={() => setIndex(index - 1)}
              className="absolute left-2 rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {index < photos.length - 1 && (
            <button
              onClick={() => setIndex(index + 1)}
              className="absolute right-2 rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Info bar */}
        <div className="border-t border-gray-200 px-4 py-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {photo.originalName}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formattedDate}</p>
            </div>
            <span className="text-xs text-gray-400">
              {index + 1} / {photos.length}
            </span>
          </div>
          {photo.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {photo.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
