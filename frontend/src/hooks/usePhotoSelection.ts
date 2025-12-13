// src/hooks/usePhotoSelection.ts
// Hook for managing photo selection state in bulk operations mode

import { useState, useCallback } from 'react';
import type { Photo, PhotoListItem } from '@/types/api';

type PhotoItem = Photo | PhotoListItem;

export function usePhotoSelection() {
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelection = useCallback((photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((photos: PhotoItem[]) => {
    setSelectedPhotoIds(new Set(photos.map((p) => p.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedPhotoIds(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedPhotoIds(new Set());
  }, []);

  const isSelected = useCallback(
    (photoId: string) => selectedPhotoIds.has(photoId),
    [selectedPhotoIds]
  );

  return {
    selectedPhotoIds,
    isSelectionMode,
    selectedCount: selectedPhotoIds.size,
    isSelected,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
  };
}
