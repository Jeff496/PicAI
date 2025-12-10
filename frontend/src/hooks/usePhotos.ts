// src/hooks/usePhotos.ts
// TanStack Query hooks for photo operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { photosService, type GetPhotosParams } from '@/services/photos';
import type { UploadResponse } from '@/types/api';

// Query keys for caching
export const photoKeys = {
  all: ['photos'] as const,
  lists: () => [...photoKeys.all, 'list'] as const,
  list: (params?: GetPhotosParams) => [...photoKeys.lists(), params] as const,
  details: () => [...photoKeys.all, 'detail'] as const,
  detail: (id: string) => [...photoKeys.details(), id] as const,
  thumbnails: () => [...photoKeys.all, 'thumbnail'] as const,
  thumbnail: (id: string) => [...photoKeys.thumbnails(), id] as const,
};

/**
 * Hook to fetch list of photos with pagination
 */
export function usePhotos(params?: GetPhotosParams) {
  return useQuery({
    queryKey: photoKeys.list(params),
    queryFn: () => photosService.getPhotos(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
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
 * Hook to prefetch the next page of photos
 */
export function usePrefetchPhotos() {
  const queryClient = useQueryClient();

  return (params: GetPhotosParams) => {
    queryClient.prefetchQuery({
      queryKey: photoKeys.list(params),
      queryFn: () => photosService.getPhotos(params),
    });
  };
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
