// src/components/photos/BulkProgressModal.tsx
// Modal showing progress during bulk operations

import type { BulkOperationType } from '@/hooks/useBulkProgress';

interface ProgressState {
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
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    totalFacesDetected?: number;
  } | null;
}

interface BulkProgressModalProps {
  isOpen: boolean;
  operation: BulkOperationType;
  progress: ProgressState;
  onCancel: () => void;
  onClose: () => void;
}

export function BulkProgressModal({
  isOpen,
  operation,
  progress,
  onCancel,
  onClose,
}: BulkProgressModalProps) {
  if (!isOpen) return null;

  const operationLabel = operation === 'detect-faces' ? 'Detecting Faces' : 'Re-analyzing';
  const progressPercent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const isComplete = !progress.isRunning && progress.summary !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-gray-800 p-6 shadow-xl">
        {/* Header */}
        <h3 className="text-xl font-bold text-white">
          {isComplete
            ? 'Operation Complete'
            : `${operationLabel} (${progress.current}/${progress.total})`}
        </h3>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-400">
            <span>{progressPercent}%</span>
            <span>
              {progress.succeeded} succeeded, {progress.failed} failed
            </span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                progress.failed > 0 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Results list - scrollable */}
        <div className="mt-4 max-h-64 overflow-y-auto rounded-md bg-gray-900 p-3">
          {progress.results.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-gray-500">
              <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
              Starting...
            </div>
          ) : (
            <ul className="space-y-1">
              {progress.results.map((result, index) => (
                <li
                  key={result.photoId}
                  className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                    result.success ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {result.success ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                    Photo {index + 1}
                  </span>
                  <span className="text-gray-400">
                    {result.success ? (
                      operation === 'detect-faces' ? (
                        `${result.facesDetected ?? 0} face${result.facesDetected !== 1 ? 's' : ''}`
                      ) : (
                        `${result.tagsAdded ?? 0} tag${result.tagsAdded !== 1 ? 's' : ''}`
                      )
                    ) : (
                      <span className="text-red-400" title={result.error}>
                        Failed
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Summary (shown when complete) */}
        {isComplete && progress.summary && (
          <div className="mt-4 rounded-md bg-gray-700/50 p-3">
            <div className="text-sm text-gray-300">
              <p>
                <span className="font-medium text-green-400">{progress.summary.succeeded}</span>{' '}
                succeeded,{' '}
                <span className="font-medium text-red-400">{progress.summary.failed}</span> failed
                out of {progress.summary.total} photos
              </p>
              {operation === 'detect-faces' &&
                progress.summary.totalFacesDetected !== undefined && (
                  <p className="mt-1">
                    Total faces detected:{' '}
                    <span className="font-medium text-white">
                      {progress.summary.totalFacesDetected}
                    </span>
                  </p>
                )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          {progress.isRunning ? (
            <button
              onClick={onCancel}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={onClose}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
