// src/components/photos/BulkUploadForm.tsx
// Bulk upload form — uploads photos without AI tagging or face detection
// Files chunked into size-based batches to stay under Cloudflare's 100MB body limit

import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useBulkUpload } from '@/hooks/useBulkUpload';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

interface BulkUploadFormProps {
  groupId?: string;
  onUploadComplete?: () => void;
}

export function BulkUploadForm({ groupId, onUploadComplete }: BulkUploadFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { state, startUpload, cancel, reset } = useBulkUpload();
  const isUploading = state.status === 'uploading';
  const isDone =
    state.status === 'complete' || state.status === 'cancelled' || state.status === 'error';

  const validateFiles = (files: FileList | File[]): File[] => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Unsupported type. Use JPEG, PNG, or HEIC.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Too large (max 25MB).`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      setValidationError(errors.join('\n'));
    }
    return validFiles;
  };

  const handleFiles = useCallback((files: FileList | File[]) => {
    setValidationError(null);
    const valid = validateFiles(files);
    setSelectedFiles((prev) => [...prev, ...valid]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setValidationError(null);
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setValidationError(null);
    reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setValidationError(null);

    const result = await startUpload(selectedFiles, groupId);
    if (result && !result.cancelled) {
      onUploadComplete?.();
    }
  };

  const handleRetryFailed = async () => {
    if (!state.result) return;
    const failedNames = new Set(state.result.failed.map((f) => f.originalName));
    const retryFiles = selectedFiles.filter((f) => failedNames.has(f.name));
    if (retryFiles.length === 0) return;

    reset();
    setSelectedFiles(retryFiles);
    const result = await startUpload(retryFiles, groupId);
    if (result && !result.cancelled) {
      onUploadComplete?.();
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const progressPercent =
    state.totalFiles > 0
      ? Math.round(((state.completedFiles + state.failedFiles) / state.totalFiles) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="border border-blue-200 bg-blue-50 p-3 text-[13px] text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
        Upload photos without AI processing. For quick storage and backup. You can run AI tagging
        later from the gallery.
      </div>

      {/* Drop zone */}
      {!isUploading && !isDone && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer border-2 border-dashed p-8 text-center transition-colors
            ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="space-y-2">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-full w-full">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">
              JPEG, PNG, or HEIC. Max 25MB per file. No file count limit.
            </p>
          </div>
        </div>
      )}

      {/* Validation errors */}
      {validationError && (
        <div className="border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <pre className="whitespace-pre-wrap font-sans">{validationError}</pre>
        </div>
      )}

      {/* Selected files summary + list */}
      {selectedFiles.length > 0 && !isUploading && !isDone && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedFiles.length} files ({formatSize(totalSize)})
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Clear all
            </button>
          </div>

          <ul className="max-h-48 space-y-1 overflow-y-auto border border-gray-200 p-2 dark:border-gray-700">
            {selectedFiles.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">{formatSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="shrink-0 p-1 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Batch {state.currentBatch}/{state.totalBatches} &mdash;{' '}
              {state.completedFiles + state.failedFiles}/{state.totalFiles} photos
            </span>
            <span className="text-gray-600 dark:text-gray-400">{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <button
            type="button"
            onClick={cancel}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Results */}
      {isDone && state.result && (
        <div className="space-y-3">
          <div
            className={`border p-4 ${
              state.result.failed.length === 0
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : state.result.uploaded.length === 0
                  ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                  : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                state.result.failed.length === 0
                  ? 'text-green-700 dark:text-green-400'
                  : state.result.uploaded.length === 0
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-yellow-700 dark:text-yellow-400'
              }`}
            >
              {state.status === 'cancelled'
                ? 'Upload cancelled'
                : state.result.failed.length === 0
                  ? 'All photos uploaded'
                  : `${state.result.uploaded.length} uploaded, ${state.result.failed.length} failed`}
            </p>
            <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-400">
              {state.result.uploaded.length} of {state.result.totalFiles} photos saved.
              {state.result.cancelled && ' Completed batches were preserved.'}
            </p>
          </div>

          {/* Failed files list */}
          {state.result.failed.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Failed ({state.result.failed.length}):
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto border border-red-200 p-2 text-[13px] dark:border-red-800">
                {state.result.failed.map((f, i) => (
                  <li key={i} className="text-red-600 dark:text-red-400">
                    {f.originalName}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            {state.result.failed.length > 0 && (
              <button
                type="button"
                onClick={handleRetryFailed}
                className="bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Retry Failed ({state.result.failed.length})
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {state.result.failed.length === 0 ? 'Done' : 'Clear'}
            </button>
          </div>
        </div>
      )}

      {/* Upload button */}
      {selectedFiles.length > 0 && !isUploading && !isDone && (
        <button
          type="button"
          onClick={handleUpload}
          className="w-full bg-primary px-4 py-2 text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'photo' : 'photos'} (
          {formatSize(totalSize)})
        </button>
      )}
    </div>
  );
}
