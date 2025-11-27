// src/components/photos/PhotoCard.tsx
// Individual photo card displaying thumbnail with actions

import { useState } from 'react';
import { useThumbnail, useDeletePhoto } from '@/hooks/usePhotos';
import type { Photo } from '@/types/api';

interface PhotoCardProps {
  photo: Photo;
  onViewFull?: (photo: Photo) => void;
}

export function PhotoCard({ photo, onViewFull }: PhotoCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const { data: thumbnailUrl, isLoading: thumbnailLoading } = useThumbnail(photo.id);
  const deleteMutation = useDeletePhoto();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(photo.id);
    } catch (err) {
      console.error('Failed to delete photo:', err);
    }
    setShowConfirm(false);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-md dark:bg-gray-800">
      {/* Thumbnail container */}
      <div
        className="relative aspect-square cursor-pointer bg-gray-100 dark:bg-gray-700"
        onClick={() => onViewFull?.(photo)}
      >
        {thumbnailLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
          </div>
        ) : thumbnailUrl ? (
          <img src={thumbnailUrl} alt={photo.originalName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded-full bg-white/90 p-2 text-gray-700 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onViewFull?.(photo);
            }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Photo info */}
      <div className="p-3">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
          {photo.originalName}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(photo.uploadedAt)}</p>

        {/* AI tags */}
        {photo.tags && photo.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {photo.tags.slice(0, 3).map((tag, index) => (
              <span
                key={`${tag.tag}-${index}`}
                className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                title={`${(tag.confidence * 100).toFixed(0)}% confidence`}
              >
                {tag.tag}
              </span>
            ))}
            {photo.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{photo.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-500 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:bg-gray-800/90"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Photo</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete "{photo.originalName}"? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
