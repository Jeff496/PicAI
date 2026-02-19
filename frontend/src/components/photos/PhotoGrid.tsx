import { useMemo } from 'react';
import { ImageIcon } from 'lucide-react';
import { PhotoCard } from './PhotoCard';
import type { Photo, PhotoListItem } from '@/types/api';

type PhotoItem = Photo | PhotoListItem;

interface DateGroup {
  label: string;
  sortKey: string;
  photos: PhotoItem[];
}

function groupPhotosByDate(photos: PhotoItem[]): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  const currentYear = new Date().getFullYear();

  for (const photo of photos) {
    const date = new Date(photo.uploadedAt);
    const dateKey = date.toISOString().slice(0, 10);

    if (!groups.has(dateKey)) {
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();
      const label = year === currentYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
      groups.set(dateKey, { label, sortKey: dateKey, photos: [] });
    }

    groups.get(dateKey)!.photos.push(photo);
  }

  return Array.from(groups.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

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
  const dateGroups = useMemo(() => groupPhotosByDate(photos), [photos]);

  // Loading skeleton — stable grid
  if (isLoading) {
    return (
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gridAutoRows: '160px' }}
      >
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse bg-rule/60 dark:bg-[#2a2824]"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-rule py-20 dark:border-[#2a2824]">
        <ImageIcon className="h-10 w-10 text-whisper dark:text-[#8a8478]" />
        <h3 className="mt-4 font-serif text-[18px] font-normal text-ink dark:text-[#e8e4de]">
          No photos yet
        </h3>
        <p className="mt-1 text-[14px] font-light text-muted dark:text-[#8a8478]">
          Upload your first photos to get started
        </p>
      </div>
    );
  }

  // Date-grouped photo grid
  return (
    <div className="space-y-8">
      {dateGroups.map((group) => (
        <div key={group.sortKey}>
          {/* Date header: italic serif label + extending rule */}
          <div className="mb-3 flex items-center gap-3">
            <span className="font-serif text-[15px] font-normal italic text-ink dark:text-[#e8e4de]">
              {group.label}
            </span>
            <div className="flex-1 border-b border-rule dark:border-[#2a2824]" />
          </div>

          {/* Stable CSS grid — fixed row height, auto-fill columns */}
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gridAutoRows: '160px' }}
          >
            {group.photos.map((photo) => (
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
        </div>
      ))}
    </div>
  );
}
