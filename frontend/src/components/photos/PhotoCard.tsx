// src/components/photos/PhotoCard.tsx
// Individual photo card — minimal chrome, photo-focused

import { useState } from 'react';
import { Trash2, ImageIcon } from 'lucide-react';
import { useThumbnail, useDeletePhoto } from '@/hooks/usePhotos';
import type { Photo, PhotoListItem } from '@/types/api';

// Accept either full Photo or simplified PhotoListItem
type PhotoItem = Photo | PhotoListItem;

interface PhotoCardProps {
  photo: PhotoItem;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onViewFull?: (photo: PhotoItem) => void;
}

export function PhotoCard({
  photo,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onViewFull,
}: PhotoCardProps) {
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

  const handleClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection();
    } else if (onViewFull) {
      onViewFull(photo);
    }
  };

  return (
    <div
      className={`group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-gray-100 dark:bg-white/5 ${
        isSelected
          ? 'ring-2 ring-accent ring-offset-1 ring-offset-gray-50 dark:ring-offset-gray-950'
          : ''
      }`}
      onClick={handleClick}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <div className="absolute left-1.5 top-1.5 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer rounded border-white/80 bg-white/80 text-accent shadow-sm focus:ring-1 focus:ring-accent focus:ring-offset-0"
          />
        </div>
      )}

      {/* Thumbnail */}
      {thumbnailLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent dark:border-white/10 dark:border-t-accent" />
        </div>
      ) : thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={photo.originalName}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-300 dark:text-gray-600">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}

      {/* Selection tint */}
      {isSelectionMode && isSelected && <div className="absolute inset-0 bg-accent/15" />}

      {/* Delete button (hover only, not in selection mode) */}
      {!isSelectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(true);
          }}
          className="absolute right-1.5 top-1.5 rounded-full bg-black/40 p-1.5 text-white/80 opacity-0 transition-opacity hover:bg-black/60 hover:text-white group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(false);
          }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-medium text-gray-900 dark:text-white">Delete Photo</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this photo? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
