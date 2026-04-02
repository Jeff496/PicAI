// src/hooks/useBulkUpload.ts
// State management for bulk photo upload (no AI tagging)

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { photosService, type BulkUploadProgress, type BulkUploadResult } from '@/services/photos';

export type BulkUploadStatus = 'idle' | 'uploading' | 'complete' | 'cancelled' | 'error';

export interface BulkUploadState {
  status: BulkUploadStatus;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  currentBatch: number;
  totalBatches: number;
  result: BulkUploadResult | null;
  error: string | null;
}

const initialState: BulkUploadState = {
  status: 'idle',
  totalFiles: 0,
  completedFiles: 0,
  failedFiles: 0,
  currentBatch: 0,
  totalBatches: 0,
  result: null,
  error: null,
};

export function useBulkUpload() {
  const [state, setState] = useState<BulkUploadState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const startUpload = useCallback(
    async (files: File[], groupId?: string): Promise<BulkUploadResult | null> => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        ...initialState,
        status: 'uploading',
        totalFiles: files.length,
      });

      try {
        const result = await photosService.bulkUpload(
          files,
          groupId,
          abortController.signal,
          (progress: BulkUploadProgress) => {
            setState((prev) => ({
              ...prev,
              completedFiles: progress.completedFiles,
              failedFiles: progress.failedFiles,
              currentBatch: progress.currentBatch,
              totalBatches: progress.totalBatches,
            }));
          }
        );

        const finalStatus: BulkUploadStatus = result.cancelled
          ? 'cancelled'
          : result.failed.length === result.totalFiles
            ? 'error'
            : 'complete';

        setState((prev) => ({
          ...prev,
          status: finalStatus,
          completedFiles: result.uploaded.length,
          failedFiles: result.failed.length,
          result,
        }));

        // Invalidate photo queries so gallery refreshes
        queryClient.invalidateQueries({ queryKey: ['photos'] });

        return result;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        }));
        return null;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [queryClient]
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { state, startUpload, cancel, reset };
}
