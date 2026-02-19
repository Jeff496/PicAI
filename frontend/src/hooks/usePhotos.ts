// src/hooks/usePhotos.ts
// TanStack Query hooks for photo operations

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { photosService, type GetPhotosParams } from '@/services/photos';
import type { UploadResponse, PhotosResponse } from '@/types/api';
import { useMemo } from 'react';

const PAGE_SIZE = 50;

// Query keys for caching
export const photoKeys = {
  all: ['photos'] as const,
  lists: () => [...photoKeys.all, 'list'] as const,
  list: (params?: Omit<GetPhotosParams, 'limit' | 'offset'>) => [...photoKeys.lists(), params] as const,
  details: () => [...photoKeys.all, 'detail'] as const,
  detail: (id: string) => [...photoKeys.details(), id] as const,
  thumbnails: () => [...photoKeys.all, 'thumbnail'] as const,
  thumbnail: (id: string) => [...photoKeys.thumbnails(), id] as const,
};

/**
 * Hook to fetch photos with infinite scrolling pagination.
 * Returns a flat array of all loaded photos plus hasNextPage / fetchNextPage controls.
 */
export function usePhotos(params?: Omit<GetPhotosParams, 'limit' | 'offset'>) {
  const query = useInfiniteQuery<PhotosResponse>({
    queryKey: photoKeys.list(params),
    queryFn: ({ pageParam = 0 }) =>
      photosService.getPhotos({ ...params, limit: PAGE_SIZE, offset: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
      return nextOffset < lastPage.pagination.total ? nextOffset : undefined;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Flatten all pages into a single photo array
  const photos = useMemo(
    () => query.data?.pages.flatMap((page) => page.photos) ?? [],
    [query.data]
  );

  const total = query.data?.pages[0]?.pagination.total ?? 0;

  return {
    ...query,
    photos,
    total,
  };
}

/**
 * Hook to fetch a single photo by ID
 */
export function usePhoto(id: string) {
  return useQuery({
    queryKey: photoKeys.detail(id),
    queryFn: () => photosService.getPhoto(id),
    enabled: !!id,
  });
}

/**
 * Hook to fetch thumbnail blob URL
 */
export function useThumbnail(id: string) {
  return useQuery({
    queryKey: photoKeys.thumbnail(id),
    queryFn: () => photosService.fetchThumbnailBlob(id),
    staleTime: 1000 * 60 * 30, // 30 minutes - thumbnails don't change often
    enabled: !!id,
  });
}

/**
 * Hook to upload photos
 */
export function useUploadPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      files,
      groupId,
      detectFaces,
      onProgress,
    }: {
      files: File[];
      groupId?: string;
      detectFaces?: boolean;
      onProgress?: (progress: number) => void;
    }): Promise<UploadResponse> => {
      return photosService.upload(files, groupId, detectFaces, onProgress);
    },
    onSuccess: () => {
      // Invalidate photo list to refetch
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}

/**
 * Hook to delete a photo
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => photosService.deletePhoto(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: photoKeys.detail(deletedId) });
      queryClient.removeQueries({ queryKey: photoKeys.thumbnail(deletedId) });
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}

/**
 * Hook to analyze/re-analyze a photo with AI
 */
export function useAnalyzePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoId: string) => photosService.analyzePhoto(photoId),
    onSuccess: (_, photoId) => {
      // Invalidate specific photo to refetch with new tags
      queryClient.invalidateQueries({ queryKey: photoKeys.detail(photoId) });
      // Also invalidate lists to show updated tags
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}

/**
 * Hook to add a manual tag to a photo
 */
export function useAddTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, tag, category }: { photoId: string; tag: string; category?: string }) =>
      photosService.addTag(photoId, tag, category),
    onSuccess: (_, { photoId }) => {
      queryClient.invalidateQueries({ queryKey: photoKeys.detail(photoId) });
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}

/**
 * Hook to remove a tag from a photo
 */
export function useRemoveTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, tagId }: { photoId: string; tagId: string }) =>
      photosService.removeTag(photoId, tagId),
    onSuccess: (_, { photoId }) => {
      queryClient.invalidateQueries({ queryKey: photoKeys.detail(photoId) });
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}

// ============================================
// Bulk Operations
// ============================================

/**
 * Hook to bulk re-analyze photos with Azure AI
 */
export function useBulkAnalyzePhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoIds: string[]) => photosService.bulkAnalyze(photoIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}

/**
 * Hook to bulk delete photos
 */
export function useBulkDeletePhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoIds: string[]) => photosService.bulkDelete(photoIds),
    onSuccess: (_, deletedIds) => {
      // Remove deleted photos from cache
      deletedIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: photoKeys.detail(id) });
        queryClient.removeQueries({ queryKey: photoKeys.thumbnail(id) });
      });
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}
