import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { usePerson, usePersonPhotos, useUpdatePerson } from '@/hooks/useFaces';
import { PhotoGrid, PhotoViewer } from '@/components/photos';
import { AppLayout } from '@/components/layout/AppLayout';
import type { PhotoListItem } from '@/types/api';

export function PersonPhotosPage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoListItem | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const { data: personResponse, isLoading: personLoading } = usePerson(personId || '');
  const person = personResponse?.person;

  const { data: photosResponse, isLoading: photosLoading, error, refetch } = usePersonPhotos(personId || '');
  const updateMutation = useUpdatePerson();

  const photos = photosResponse?.photos ?? [];
  const isLoading = personLoading || photosLoading;

  const handleStartEdit = () => {
    setEditName(person?.name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!personId || !editName.trim()) return;
    try {
      await updateMutation.mutateAsync({ personId, name: editName.trim() });
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName();
    else if (e.key === 'Escape') setIsEditingName(false);
  };

  if (!personId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Invalid person ID</p>
      </div>
    );
  }

  // Back button as header action
  const actions = (
    <button
      onClick={() => navigate('/people')}
      className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
      aria-label="Back to People"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );

  return (
    <AppLayout actions={actions}>
      {/* Person header */}
      <div className="mb-6">
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-lg font-semibold text-gray-900 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <button
              onClick={handleSaveName}
              disabled={!editName.trim() || updateMutation.isPending}
              className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {updateMutation.isPending ? '...' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditingName(false)}
              className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {person?.name || 'Unnamed Person'}
            </h2>
            <button
              onClick={handleStartEdit}
              className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Edit name"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
          <p className="text-sm text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Error loading photos'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-1 text-sm font-medium text-red-800 underline hover:text-red-900 dark:text-red-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Photo grid */}
      <PhotoGrid photos={photos} isLoading={isLoading} onViewPhoto={setSelectedPhoto} />

      {/* Empty state */}
      {!isLoading && !error && photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-base font-medium text-gray-900 dark:text-white">No photos yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This person hasn't been tagged in any photos yet.
          </p>
        </div>
      )}

      {/* Photo viewer modal */}
      {selectedPhoto && (
        <PhotoViewer photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      )}
    </AppLayout>
  );
}
