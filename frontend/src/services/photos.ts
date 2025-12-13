// src/services/photos.ts
// Photo service for API calls - upload, list, get, delete

import api from './api';
import type {
  PhotosResponse,
  PhotoResponse,
  UploadResponse,
  AnalyzeResponse,
  AddTagResponse,
  RemoveTagResponse,
  BulkAnalyzeResponse,
  BulkDeleteResponse,
} from '@/types/api';

// Query parameters for listing photos
export interface GetPhotosParams {
  limit?: number;
  offset?: number;
  groupId?: string;
  tag?: string;
}

// Progress callback for upload
export type UploadProgressCallback = (progress: number) => void;

export const photosService = {
  /**
   * Upload multiple photos
   * @param files Array of File objects to upload
   * @param groupId Optional group ID to associate photos with
   * @param detectFaces Optional flag to run face detection after upload
   * @param onProgress Optional callback for upload progress (0-100)
   */
  async upload(
    files: File[],
    groupId?: string,
    detectFaces?: boolean,
    onProgress?: UploadProgressCallback
  ): Promise<UploadResponse> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('photos', file);
    });

    if (groupId) {
      formData.append('groupId', groupId);
    }

    // Build URL with query params
    const params = new URLSearchParams();
    if (detectFaces) {
      params.set('detectFaces', 'true');
    }
    const url = `/photos/upload${params.toString() ? `?${params.toString()}` : ''}`;

    const { data } = await api.post<UploadResponse>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress(progress);
        }
      },
    });

    return data;
  },

  /**
   * Get list of photos with pagination and optional tag filter
   */
  async getPhotos(params?: GetPhotosParams): Promise<PhotosResponse> {
    const { data } = await api.get<PhotosResponse>('/photos', {
      params: {
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
        groupId: params?.groupId,
        tag: params?.tag,
      },
    });

    return data;
  },

  /**
   * Get single photo by ID with AI tags
   */
  async getPhoto(id: string): Promise<PhotoResponse> {
    const { data } = await api.get<PhotoResponse>(`/photos/${id}`);
    return data;
  },

  /**
   * Delete a photo
   */
  async deletePhoto(id: string): Promise<void> {
    await api.delete(`/photos/${id}`);
  },

  /**
   * Get URL for photo thumbnail
   * Note: Requires auth token in header, so use with img src via blob URL
   */
  getThumbnailUrl(id: string): string {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    return `${baseUrl}/photos/${id}/thumbnail`;
  },

  /**
   * Get URL for original photo file
   */
  getFileUrl(id: string): string {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    return `${baseUrl}/photos/${id}/file`;
  },

  /**
   * Fetch thumbnail as blob URL (for use with auth header)
   */
  async fetchThumbnailBlob(id: string): Promise<string> {
    const { data } = await api.get(`/photos/${id}/thumbnail`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  },

  /**
   * Fetch original file as blob URL (for use with auth header)
   */
  async fetchFileBlob(id: string): Promise<string> {
    const { data } = await api.get(`/photos/${id}/file`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  },

  /**
   * Trigger AI re-analysis of a photo
   */
  async analyzePhoto(id: string): Promise<AnalyzeResponse> {
    const { data } = await api.post<AnalyzeResponse>(`/ai/analyze/${id}`);
    return data;
  },

  /**
   * Add a manual tag to a photo
   */
  async addTag(photoId: string, tag: string, category: string = 'manual'): Promise<AddTagResponse> {
    const { data } = await api.post<AddTagResponse>(`/photos/${photoId}/tags`, {
      tag,
      category,
    });
    return data;
  },

  /**
   * Remove a tag from a photo
   */
  async removeTag(photoId: string, tagId: string): Promise<RemoveTagResponse> {
    const { data } = await api.delete<RemoveTagResponse>(`/photos/${photoId}/tags/${tagId}`);
    return data;
  },

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Bulk re-analyze multiple photos with Azure AI
   * @param photoIds Array of photo IDs to re-analyze
   */
  async bulkAnalyze(photoIds: string[]): Promise<BulkAnalyzeResponse> {
    // Extended timeout for bulk operations: 30s base + 5s per photo, max 5 minutes
    const timeout = Math.min(30000 + photoIds.length * 5000, 300000);
    const { data } = await api.post<BulkAnalyzeResponse>(
      '/ai/analyze/bulk',
      { photoIds },
      { timeout }
    );
    return data;
  },

  /**
   * Bulk delete multiple photos
   * @param photoIds Array of photo IDs to delete
   */
  async bulkDelete(photoIds: string[]): Promise<BulkDeleteResponse> {
    // Extended timeout for bulk delete: 30s base + 2s per photo, max 2 minutes
    const timeout = Math.min(30000 + photoIds.length * 2000, 120000);
    const { data } = await api.delete<BulkDeleteResponse>('/photos/bulk', {
      data: { photoIds },
      timeout,
    });
    return data;
  },
};
