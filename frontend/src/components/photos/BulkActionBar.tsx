// src/components/photos/BulkActionBar.tsx
// Bottom action bar for bulk photo operations

import { useState } from 'react';
import { useBulkAnalyzePhotos, useBulkDeletePhotos } from '@/hooks/usePhotos';
import { useBulkDetectFaces } from '@/hooks/useFaces';

interface BulkActionBarProps {
  selectedCount: number;
  selectedPhotoIds: string[];
  onCancel: () => void;
  onComplete?: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedPhotoIds,
  onCancel,
  onComplete,
}: BulkActionBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkAnalyze = useBulkAnalyzePhotos();
  const bulkDetectFaces = useBulkDetectFaces();
  const bulkDelete = useBulkDeletePhotos();

  const isProcessing = bulkAnalyze.isPending || bulkDetectFaces.isPending || bulkDelete.isPending;

  const handleReanalyze = () => {
    setError(null);
    bulkAnalyze.mutate(selectedPhotoIds, {
      onSuccess: () => {
        onComplete?.();
        onCancel();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to re-analyze photos');
      },
    });
  };

  const handleDetectFaces = () => {
    setError(null);
    bulkDetectFaces.mutate(selectedPhotoIds, {
      onSuccess: () => {
        onComplete?.();
        onCancel();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to detect faces');
      },
    });
  };

  const handleDelete = () => {
    setError(null);
    bulkDelete.mutate(selectedPhotoIds, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        onComplete?.();
        onCancel();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to delete photos');
      },
    });
  };

  return (
    <>
      {/* Fixed bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-700 bg-gray-800 p-4 shadow-lg">
        <div className="mx-auto max-w-7xl">
          {/* Error message */}
          {error && (
            <div className="mb-3 rounded-md bg-red-900/50 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="font-medium text-white">
              {selectedCount} photo{selectedCount !== 1 ? 's' : ''} selected
            </div>

            <div className="flex gap-3">
              {/* Re-analyze button */}
              <button
                onClick={handleReanalyze}
                disabled={selectedCount === 0 || isProcessing}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkAnalyze.isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Re-analyze
                  </>
                )}
              </button>

              {/* Detect Faces button */}
              <button
                onClick={handleDetectFaces}
                disabled={selectedCount === 0 || isProcessing}
                className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkDetectFaces.isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Detecting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Detect Faces
                  </>
                )}
              </button>

              {/* Delete button */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedCount === 0 || isProcessing}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>

              {/* Cancel button */}
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Progress indicator */}
          {isProcessing && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
                <div className="h-2 animate-pulse rounded-full bg-blue-600" style={{ width: '100%' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !bulkDelete.isPending && setShowDeleteConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white">
              Delete {selectedCount} Photo{selectedCount !== 1 ? 's' : ''}?
            </h3>
            <p className="mt-4 text-gray-300">
              This will permanently delete {selectedCount} photo{selectedCount !== 1 ? 's' : ''} and
              their associated data (tags, faces). This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={bulkDelete.isPending}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={bulkDelete.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDelete.isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
