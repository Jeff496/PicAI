// src/hooks/useFaces.ts
// TanStack Query hooks for face detection and people management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facesService, type GetPeopleParams, type TagFaceData } from '@/services/faces';

// Query keys for caching
export const faceKeys = {
  all: ['faces'] as const,
  forPhoto: (photoId: string) => [...faceKeys.all, 'photo', photoId] as const,
  people: () => ['people'] as const,
  peopleList: (params?: GetPeopleParams) => [...faceKeys.people(), 'list', params] as const,
  person: (id: string) => [...faceKeys.people(), id] as const,
  personPhotos: (id: string) => [...faceKeys.person(id), 'photos'] as const,
};

// ============================================
// Face Detection Hooks
// ============================================

/**
 * Hook to fetch detected faces for a photo
 */
export function useFaces(photoId: string) {
  return useQuery({
    queryKey: faceKeys.forPhoto(photoId),
    queryFn: () => facesService.getFaces(photoId),
    enabled: !!photoId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to trigger face detection on a photo
 * Rate limited: 50 requests per 15 minutes
 */
export function useDetectFaces() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoId: string) => facesService.detectFaces(photoId),
    onSuccess: (data, photoId) => {
      // Update the faces cache for this photo
      queryClient.setQueryData(faceKeys.forPhoto(photoId), {
        success: true,
        faces: data.faces,
      });
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: faceKeys.forPhoto(photoId) });
    },
  });
}

// ============================================
// Face Tagging Hooks
// ============================================

/**
 * Hook to tag a face (link to person or create new)
 */
export function useTagFace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ faceId, tagData }: { faceId: string; photoId: string; tagData: TagFaceData }) =>
      facesService.tagFace(faceId, tagData),
    onSuccess: (_, { photoId }) => {
      // Use photoId from mutation variables, not response
      // Invalidate faces for this photo to show updated tag
      queryClient.invalidateQueries({ queryKey: faceKeys.forPhoto(photoId) });

      // Invalidate people list since a new person might have been created
      queryClient.invalidateQueries({ queryKey: faceKeys.people() });
    },
  });
}

/**
 * Hook to remove a face tag
 */
export function useUntagFace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ faceId }: { faceId: string; photoId: string }) => facesService.untagFace(faceId),
    onSuccess: (_, { photoId }) => {
      // Invalidate faces for this photo
      queryClient.invalidateQueries({ queryKey: faceKeys.forPhoto(photoId) });

      // Invalidate people list in case face counts changed
      queryClient.invalidateQueries({ queryKey: faceKeys.people() });
    },
  });
}

// ============================================
// People Management Hooks
// ============================================

/**
 * Hook to fetch list of people in user's collection
 */
export function usePeople(params?: GetPeopleParams) {
  return useQuery({
    queryKey: faceKeys.peopleList(params),
    queryFn: () => facesService.getPeople(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch a single person by ID
 */
export function usePerson(personId: string) {
  return useQuery({
    queryKey: faceKeys.person(personId),
    queryFn: () => facesService.getPerson(personId),
    enabled: !!personId,
  });
}

/**
 * Hook to update a person's name
 */
export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ personId, name }: { personId: string; name: string }) =>
      facesService.updatePerson(personId, name),
    onSuccess: (_, { personId }) => {
      // Invalidate this person
      queryClient.invalidateQueries({ queryKey: faceKeys.person(personId) });
      // Invalidate people list
      queryClient.invalidateQueries({ queryKey: faceKeys.peopleList() });
    },
  });
}

/**
 * Hook to delete a person
 */
export function useDeletePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (personId: string) => facesService.deletePerson(personId),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: faceKeys.person(deletedId) });
      queryClient.removeQueries({ queryKey: faceKeys.personPhotos(deletedId) });
      // Invalidate people list
      queryClient.invalidateQueries({ queryKey: faceKeys.peopleList() });
      // Invalidate all faces since face counts may have changed
      queryClient.invalidateQueries({ queryKey: faceKeys.all });
    },
  });
}

/**
 * Hook to fetch photos containing a specific person
 */
export function usePersonPhotos(personId: string) {
  return useQuery({
    queryKey: faceKeys.personPhotos(personId),
    queryFn: () => facesService.getPersonPhotos(personId),
    enabled: !!personId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to prefetch people list
 */
export function usePrefetchPeople() {
  const queryClient = useQueryClient();

  return (params?: GetPeopleParams) => {
    queryClient.prefetchQuery({
      queryKey: faceKeys.peopleList(params),
      queryFn: () => facesService.getPeople(params),
    });
  };
}

// ============================================
// Bulk Operations
// ============================================

/**
 * Hook to bulk detect faces in multiple photos
 */
export function useBulkDetectFaces() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoIds: string[]) => facesService.bulkDetectFaces(photoIds),
    onSuccess: (_, photoIds) => {
      // Invalidate faces for all processed photos
      photoIds.forEach((photoId) => {
        queryClient.invalidateQueries({ queryKey: faceKeys.forPhoto(photoId) });
      });
      // Also invalidate people list in case new matches were found
      queryClient.invalidateQueries({ queryKey: faceKeys.people() });
    },
  });
}
