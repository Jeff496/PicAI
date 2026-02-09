// src/components/photos/PhotoViewer.tsx
// Full-screen photo viewer modal with side panel for details

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, Calendar, Maximize2 } from 'lucide-react';
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
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [photo.id]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Layout: side-by-side on lg+, stacked on smaller */}
      <div
        className="flex h-full w-full max-w-[95vw] flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-4 lg:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image area */}
        <div
          ref={imageContainerRef}
          className="relative flex min-h-0 flex-1 items-center justify-center p-4 lg:p-0"
        >
          {isLoading && (
            <div className="flex h-64 w-64 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/20 border-t-white" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center text-white/60">
              <AlertCircle className="h-12 w-12" />
              <p className="mt-2 text-sm">{error}</p>
            </div>
          )}

          {!isLoading && imageUrl && (
            <div className="relative">
              <img
                ref={imageRef}
                src={imageUrl}
                alt={photo.originalName}
                className="max-h-[85vh] max-w-full rounded object-contain lg:max-h-[90vh]"
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

        {/* Details side panel */}
        <div className="w-full shrink-0 overflow-y-auto border-t border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm lg:h-[90vh] lg:w-80 lg:rounded-lg lg:border lg:border-white/10">
          {/* File info */}
          <div className="space-y-3">
            <p className="truncate text-sm text-white/50" title={photo.originalName}>
              {photo.originalName}
            </p>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(photo.uploadedAt)}</span>
            </div>
            {'width' in photo && photo.width && photo.height && (
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Maximize2 className="h-3.5 w-3.5" />
                <span>
                  {photo.width} x {photo.height}
                </span>
              </div>
            )}
          </div>

          {/* Face Detection */}
          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">
              Face Detection
            </h3>
            <DetectFacesButton
              photoId={photo.id}
              faceCount={faces.length}
              onDetected={() => refetchFaces()}
            />
            {faces.length > 0 && (
              <p className="mt-2 text-xs text-white/40">Click on faces in the image to tag them.</p>
            )}
          </div>

          {/* AI Tags with management */}
          {'tags' in photo && (
            <div className="mt-5 border-t border-white/10 pt-5">
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
