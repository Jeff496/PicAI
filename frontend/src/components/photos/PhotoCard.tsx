import { useState } from 'react';
import { Trash2, ImageIcon } from 'lucide-react';
import { useThumbnail, useDeletePhoto } from '@/hooks/usePhotos';
import type { Photo, PhotoListItem } from '@/types/api';

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
      className={`group relative h-full w-full cursor-pointer overflow-hidden bg-[#d8d0c4] dark:bg-[#2a2824] ${
        isSelected
          ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper dark:ring-[#e8e4de] dark:ring-offset-[#111110]'
          : ''
      }`}
      style={{ transition: 'transform 0.25s ease, box-shadow 0.25s ease' }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!isSelectionMode) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,23,20,0.12)';
          e.currentTarget.style.zIndex = '5';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.zIndex = '';
      }}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <div className="absolute left-1.5 top-1.5 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer border-white/80 bg-white/80 shadow-sm accent-[#1a1714]"
          />
        </div>
      )}

      {/* Thumbnail */}
      {thumbnailLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="h-5 w-5 animate-spin border-2 border-rule border-t-ink dark:border-[#2a2824] dark:border-t-[#e8e4de]" />
        </div>
      ) : thumbnailUrl ? (
        <img src={thumbnailUrl} alt={photo.originalName} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-whisper dark:text-[#8a8478]">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}

      {/* Selection tint */}
      {isSelectionMode && isSelected && (
        <div className="absolute inset-0 bg-ink/15 dark:bg-[#e8e4de]/15" />
      )}

      {/* Delete button (hover only, not in selection mode) */}
      {!isSelectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(true);
          }}
          className="absolute right-1.5 top-1.5 bg-black/40 p-1.5 text-white/80 opacity-0 transition-opacity hover:bg-black/60 hover:text-white group-hover:opacity-100"
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
            className="mx-4 w-full max-w-sm border border-rule bg-paper p-6 shadow-xl dark:border-[#2a2824] dark:bg-[#111110]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-[18px] font-normal text-ink dark:text-[#e8e4de]">
              Delete Photo
            </h3>
            <p className="mt-2 text-[14px] font-light text-muted dark:text-[#8a8478]">
              Are you sure you want to delete this photo? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
                className="border border-rule px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:border-ink hover:text-ink dark:border-[#2a2824] dark:text-[#8a8478] dark:hover:border-[#e8e4de] dark:hover:text-[#e8e4de]"
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
                className="bg-red-700 px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-red-600"
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
