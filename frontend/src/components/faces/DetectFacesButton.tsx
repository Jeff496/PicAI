// src/components/faces/DetectFacesButton.tsx
// Button to trigger manual face detection on a photo

import { useDetectFaces } from '@/hooks/useFaces';

interface DetectFacesButtonProps {
  photoId: string;
  faceCount?: number;
  onDetected?: () => void;
}

export function DetectFacesButton({ photoId, faceCount, onDetected }: DetectFacesButtonProps) {
  const detectMutation = useDetectFaces();

  const handleDetect = async () => {
    try {
      await detectMutation.mutateAsync(photoId);
      onDetected?.();
    } catch (error) {
      console.error('Failed to detect faces:', error);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleDetect}
        disabled={detectMutation.isPending}
        className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
      >
        {detectMutation.isPending ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Detecting...
          </>
        ) : (
          <>
            {/* Face icon */}
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Detect Faces
          </>
        )}
      </button>

      {/* Show face count if faces have been detected */}
      {typeof faceCount === 'number' && faceCount > 0 && (
        <span className="text-xs text-white/60">
          {faceCount} face{faceCount !== 1 ? 's' : ''} found
        </span>
      )}

      {/* Show message if detection completed with no faces */}
      {detectMutation.isSuccess && detectMutation.data?.faces.length === 0 && (
        <span className="text-xs text-white/60">No faces detected</span>
      )}

      {/* Show error if detection failed */}
      {detectMutation.isError && <span className="text-xs text-red-400">Detection failed</span>}
    </div>
  );
}
