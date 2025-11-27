// src/components/photos/PhotoViewer.tsx
// Full-screen photo viewer modal

import { useState, useEffect, useRef } from 'react';
import { photosService } from '@/services/photos';
import type { Photo } from '@/types/api';

interface PhotoViewerProps {
  photo: Photo;
  onClose: () => void;
}

export function PhotoViewer({ photo, onClose }: PhotoViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const blobUrl = await photosService.fetchFileBlob(photo.id);
        if (isMounted) {
          blobUrlRef.current = blobUrl;
          setImageUrl(blobUrl);
        } else {
          // Clean up if unmounted during fetch
          URL.revokeObjectURL(blobUrl);
        }
      } catch {
        if (isMounted) {
          setError('Failed to load image');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      // Clean up blob URL using ref
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [photo.id]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Main content */}
      <div
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative flex items-center justify-center">
          {isLoading && (
            <div className="flex h-64 w-64 items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            </div>
          )}

          {error && (
            <div className="flex h-64 w-64 flex-col items-center justify-center text-white">
              <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="mt-2">{error}</p>
            </div>
          )}

          {!isLoading && imageUrl && (
            <img
              src={imageUrl}
              alt={photo.originalName}
              className="max-h-[75vh] max-w-full object-contain"
            />
          )}
        </div>

        {/* Photo details */}
        <div className="mt-4 w-full max-w-2xl rounded-lg bg-white/10 p-4 backdrop-blur">
          <h2 className="text-lg font-medium text-white">{photo.originalName}</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-white/80">
            <div>
              <span className="text-white/60">Uploaded:</span> {formatDate(photo.uploadedAt)}
            </div>
            {photo.width && photo.height && (
              <div>
                <span className="text-white/60">Dimensions:</span> {photo.width} x {photo.height}
              </div>
            )}
          </div>

          {/* AI Tags */}
          {photo.tags && photo.tags.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-white/80">AI Tags</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {photo.tags.map((tag, index) => (
                  <span
                    key={`${tag.tag}-${index}`}
                    className="rounded-full bg-white/20 px-3 py-1 text-xs text-white"
                    title={`${tag.category} - ${(tag.confidence * 100).toFixed(0)}%`}
                  >
                    {tag.tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
