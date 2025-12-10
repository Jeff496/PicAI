// src/components/photos/PhotoGrid.tsx
// Grid layout for displaying photos with loading/empty states

import { PhotoCard } from './PhotoCard';
import type { Photo, PhotoListItem } from '@/types/api';

// Accept either full Photo or simplified PhotoListItem
type PhotoItem = Photo | PhotoListItem;

interface PhotoGridProps {
  photos: PhotoItem[];
  isLoading?: boolean;
  onViewPhoto?: (photo: PhotoItem) => void;
}

export function PhotoGrid({ photos, isLoading, onViewPhoto }: PhotoGridProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="aspect-square animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-16 dark:border-gray-600">
        <svg
          className="h-16 w-16 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No photos yet</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload your first photos to get started
        </p>
      </div>
    );
  }

  // Photo grid
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} onViewFull={onViewPhoto} />
      ))}
    </div>
  );
}
