// src/components/photos/PhotoGrid.tsx
// Grid layout for displaying photos with loading/empty states

import { ImageIcon } from 'lucide-react';
import { PhotoCard } from './PhotoCard';
import type { Photo, PhotoListItem } from '@/types/api';

// Accept either full Photo or simplified PhotoListItem
type PhotoItem = Photo | PhotoListItem;

interface PhotoGridProps {
  photos: PhotoItem[];
  isLoading?: boolean;
  isSelectionMode?: boolean;
  selectedPhotoIds?: Set<string>;
  onToggleSelection?: (photoId: string) => void;
  onViewPhoto?: (photo: PhotoItem) => void;
}

export function PhotoGrid({
  photos,
  isLoading,
  isSelectionMode = false,
  selectedPhotoIds,
  onToggleSelection,
  onViewPhoto,
}: PhotoGridProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className="aspect-square animate-pulse rounded-md bg-gray-200 dark:bg-white/5"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-20 dark:border-white/10">
        <ImageIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No photos yet</h3>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
          Upload your first photos to get started
        </p>
      </div>
    );
  }

  // Photo grid
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          isSelectionMode={isSelectionMode}
          isSelected={selectedPhotoIds?.has(photo.id) ?? false}
          onToggleSelection={() => onToggleSelection?.(photo.id)}
          onViewFull={onViewPhoto}
        />
      ))}
    </div>
  );
}
