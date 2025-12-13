// src/services/faces.ts
// Face detection and People management API service

import api from './api';
import type {
  FaceDetectionResponse,
  FacesResponse,
  TagFaceResponse,
  PeopleResponse,
  PersonResponse,
  PersonPhotosResponse,
  BulkDetectFacesResponse,
} from '@/types/api';

// Query parameters for listing people
export interface GetPeopleParams {
  limit?: number;
  offset?: number;
}

// Tag face request body
export interface TagFaceData {
  personId?: string;
  personName?: string;
}

export const facesService = {
  // ============================================
  // Face Detection
  // ============================================

  /**
   * Trigger face detection on a photo (manual trigger)
   * Rate limited: 50 requests per 15 minutes
   */
  async detectFaces(photoId: string): Promise<FaceDetectionResponse> {
    const { data } = await api.post<FaceDetectionResponse>(`/photos/${photoId}/detect-faces`);
    return data;
  },

  /**
   * Get detected faces for a photo
   */
  async getFaces(photoId: string): Promise<FacesResponse> {
    const { data } = await api.get<FacesResponse>(`/photos/${photoId}/faces`);
    return data;
  },

  // ============================================
  // Face Tagging
  // ============================================

  /**
   * Tag a face - link to existing person or create new person
   * @param faceId - The face to tag
   * @param tagData - Either { personId } to link to existing, or { personName } to create new
   */
  async tagFace(faceId: string, tagData: TagFaceData): Promise<TagFaceResponse> {
    const { data } = await api.post<TagFaceResponse>(`/faces/${faceId}/tag`, tagData);
    return data;
  },

  /**
   * Remove tag from a face (unlinks from person, removes from AWS index)
   */
  async untagFace(faceId: string): Promise<{ success: true; message: string }> {
    const { data } = await api.delete<{ success: true; message: string }>(`/faces/${faceId}/tag`);
    return data;
  },

  // ============================================
  // People Management
  // ============================================

  /**
   * Get all people in user's face collection
   */
  async getPeople(params?: GetPeopleParams): Promise<PeopleResponse> {
    const { data } = await api.get<PeopleResponse>('/people', {
      params: {
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
      },
    });
    return data;
  },

  /**
   * Get single person by ID
   */
  async getPerson(personId: string): Promise<PersonResponse> {
    const { data } = await api.get<PersonResponse>(`/people/${personId}`);
    return data;
  },

  /**
   * Update person's name
   */
  async updatePerson(personId: string, name: string): Promise<PersonResponse> {
    const { data } = await api.put<PersonResponse>(`/people/${personId}`, {
      name,
    });
    return data;
  },

  /**
   * Delete a person (removes from AWS collection)
   */
  async deletePerson(personId: string): Promise<{ success: true; message: string }> {
    const { data } = await api.delete<{ success: true; message: string }>(`/people/${personId}`);
    return data;
  },

  /**
   * Get all photos containing a specific person
   */
  async getPersonPhotos(personId: string): Promise<PersonPhotosResponse> {
    const { data } = await api.get<PersonPhotosResponse>(`/people/${personId}/photos`);
    return data;
  },

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Bulk detect faces in multiple photos
   * @param photoIds Array of photo IDs to detect faces in
   */
  async bulkDetectFaces(photoIds: string[]): Promise<BulkDetectFacesResponse> {
    // Extended timeout for bulk face detection: 30s base + 6s per photo, max 5 minutes
    const timeout = Math.min(30000 + photoIds.length * 6000, 300000);
    const { data } = await api.post<BulkDetectFacesResponse>(
      '/photos/bulk-detect-faces',
      { photoIds },
      { timeout }
    );
    return data;
  },
};
