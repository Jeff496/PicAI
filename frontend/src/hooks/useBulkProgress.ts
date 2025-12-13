// src/hooks/useBulkProgress.ts
// SSE-based progress tracking for bulk operations

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { photoKeys } from './usePhotos';
import { faceKeys } from './useFaces';

// SSE event types
interface StartEvent {
  type: 'start';
  total: number;
}

interface ProgressEvent {
  type: 'progress';
  current: number;
  total: number;
  photoId: string;
  success: boolean;
  facesDetected?: number;
  tagsAdded?: number;
  error?: string;
}

interface CompleteEvent {
  type: 'complete';
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    totalFacesDetected?: number;
  };
}

type SSEEvent = StartEvent | ProgressEvent | CompleteEvent;

export type BulkOperationType = 'detect-faces' | 're-analyze';

interface BulkProgressState {
  isRunning: boolean;
  current: number;
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    photoId: string;
    success: boolean;
    facesDetected?: number;
    tagsAdded?: number;
    error?: string;
  }>;
  summary: CompleteEvent['summary'] | null;
}

const initialState: BulkProgressState = {
  isRunning: false,
  current: 0,
  total: 0,
  succeeded: 0,
  failed: 0,
  results: [],
  summary: null,
};

/**
 * Hook for tracking bulk operation progress via SSE
 *
 * @example
 * const { startOperation, progress, cancel, reset } = useBulkProgress();
 *
 * // Start bulk face detection
 * await startOperation('detect-faces', photoIds);
 *
 * // Access progress
 * console.log(`${progress.current}/${progress.total}`);
 */
export function useBulkProgress() {
  const [progress, setProgress] = useState<BulkProgressState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  const startOperation = useCallback(
    async (operation: BulkOperationType, photoIds: string[]): Promise<CompleteEvent['summary']> => {
      // Reset state
      setProgress({
        ...initialState,
        isRunning: true,
        total: photoIds.length,
      });

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const endpoint =
        operation === 'detect-faces'
          ? '/photos/bulk-detect-faces-progress'
          : '/ai/analyze-bulk-progress';

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ photoIds }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let finalSummary: CompleteEvent['summary'] | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: SSEEvent = JSON.parse(line.slice(6));

                switch (event.type) {
                  case 'start':
                    setProgress((prev) => ({
                      ...prev,
                      total: event.total,
                    }));
                    break;

                  case 'progress':
                    setProgress((prev) => ({
                      ...prev,
                      current: event.current,
                      succeeded: prev.succeeded + (event.success ? 1 : 0),
                      failed: prev.failed + (event.success ? 0 : 1),
                      results: [
                        ...prev.results,
                        {
                          photoId: event.photoId,
                          success: event.success,
                          facesDetected: event.facesDetected,
                          tagsAdded: event.tagsAdded,
                          error: event.error,
                        },
                      ],
                    }));
                    break;

                  case 'complete':
                    finalSummary = event.summary;
                    setProgress((prev) => ({
                      ...prev,
                      isRunning: false,
                      summary: event.summary,
                    }));
                    break;
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
        }

        // Invalidate queries after completion
        if (operation === 'detect-faces') {
          photoIds.forEach((photoId) => {
            queryClient.invalidateQueries({ queryKey: faceKeys.forPhoto(photoId) });
          });
          queryClient.invalidateQueries({ queryKey: faceKeys.people() });
        } else {
          queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
        }

        if (!finalSummary) {
          throw new Error('No completion event received');
        }

        return finalSummary;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          setProgress((prev) => ({
            ...prev,
            isRunning: false,
          }));
          throw new Error('Operation cancelled');
        }

        setProgress((prev) => ({
          ...prev,
          isRunning: false,
        }));
        throw error;
      }
    },
    [accessToken, queryClient]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(initialState);
  }, []);

  return {
    startOperation,
    progress,
    cancel,
    reset,
  };
}
