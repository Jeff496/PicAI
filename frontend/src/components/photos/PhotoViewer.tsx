// src/components/photos/PhotoViewer.tsx
// Full-screen photo viewer modal with face detection

import { useState, useEffect, useRef, useCallback } from 'react';
import { photosService } from '@/services/photos';
import { usePhoto } from '@/hooks/usePhotos';
import { useFaces } from '@/hooks/useFaces';
import { TagManagement } from './TagManagement';
import { FaceOverlay, FaceTagPopup, DetectFacesButton } from '@/components/faces';
import type { Photo, PhotoListItem, Face } from '@/types/api';

// Accept either full Photo or simplified PhotoListItem (will fetch full data)
type PhotoItem = Photo | PhotoListItem;

interface PhotoViewerProps {
  photo: PhotoItem;
  onClose: () => void;
}

export function PhotoViewer({ photo: initialPhoto, onClose }: PhotoViewerProps) {
  // Fetch live photo data that updates when cache is invalidated
  const { data: photoResponse } = usePhoto(initialPhoto.id);
  const photo = photoResponse?.photo ?? initialPhoto;

  // Fetch faces for this photo
  const { data: facesResponse, refetch: refetchFaces } = useFaces(photo.id);
  const faces = facesResponse?.faces || [];

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFace, setSelectedFace] = useState<Face | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | undefined>();
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const blobUrlRef = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Update image dimensions when image loads or resizes
  const updateImageDimensions = useCallback(() => {
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      setImageDimensions({ width: rect.width, height: rect.height });
    }
  }, []);

  // Handle face click - show tag popup
  const handleFaceClick = useCallback((face: Face) => {
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      // Position popup near the face
      const faceX = rect.left + face.boundingBox.left * rect.width;
      const faceY = rect.top + (face.boundingBox.top + face.boundingBox.height) * rect.height + 10;
      setPopupPosition({ x: faceX, y: faceY });
    }
    setSelectedFace(face);
  }, []);

  // Close face popup
  const handleClosePopup = useCallback(() => {
    setSelectedFace(null);
    setPopupPosition(undefined);
  }, []);

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

  // Track image dimensions for face overlay
  useEffect(() => {
    const handleResize = () => updateImageDimensions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateImageDimensions]);

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

      {/* Main content - scrollable container */}
      <div
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image with face overlay */}
        <div ref={imageContainerRef} className="relative flex shrink-0 items-center justify-center">
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
            <div className="relative">
              <img
                ref={imageRef}
                src={imageUrl}
                alt={photo.originalName}
                className="max-h-[75vh] max-w-full object-contain"
                onLoad={updateImageDimensions}
              />
              {/* Face bounding boxes overlay */}
              {faces.length > 0 && imageDimensions.width > 0 && (
                <FaceOverlay
                  faces={faces}
                  containerWidth={imageDimensions.width}
                  containerHeight={imageDimensions.height}
                  onFaceClick={handleFaceClick}
                />
              )}
            </div>
          )}
        </div>

        {/* Photo details */}
        <div className="mt-4 mb-4 w-full max-w-2xl shrink-0 rounded-lg bg-white/10 p-4 backdrop-blur">
          <h2 className="text-lg font-medium text-white">{photo.originalName}</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-white/80">
            <div>
              <span className="text-white/60">Uploaded:</span> {formatDate(photo.uploadedAt)}
            </div>
            {'width' in photo && photo.width && photo.height && (
              <div>
                <span className="text-white/60">Dimensions:</span> {photo.width} x {photo.height}
              </div>
            )}
          </div>

          {/* Face Detection */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/80">Face Detection</h3>
            </div>
            <DetectFacesButton
              photoId={photo.id}
              faceCount={faces.length}
              onDetected={() => refetchFaces()}
            />
            {faces.length > 0 && (
              <p className="mt-2 text-xs text-white/60">
                Click on faces in the image above to tag them.
              </p>
            )}
          </div>

          {/* AI Tags with management */}
          {'tags' in photo && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <TagManagement photoId={photo.id} tags={photo.tags || []} />
            </div>
          )}
        </div>
      </div>

      {/* Face Tag Popup */}
      {selectedFace && (
        <FaceTagPopup
          face={selectedFace}
          photoId={photo.id}
          onClose={handleClosePopup}
          position={popupPosition}
        />
      )}
    </div>
  );
}
