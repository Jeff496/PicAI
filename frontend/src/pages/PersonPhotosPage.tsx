// src/pages/PersonPhotosPage.tsx
// Page showing all photos containing a specific person

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '@/services/auth';
import { usePerson, usePersonPhotos, useUpdatePerson } from '@/hooks/useFaces';
import { PhotoGrid, PhotoViewer } from '@/components/photos';
import type { PhotoListItem } from '@/types/api';

export function PersonPhotosPage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoListItem | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  // Fetch person details
  const { data: personResponse, isLoading: personLoading } = usePerson(personId || '');
  const person = personResponse?.person;

  // Fetch person's photos
  const {
    data: photosResponse,
    isLoading: photosLoading,
    error,
    refetch,
  } = usePersonPhotos(personId || '');

  const updateMutation = useUpdatePerson();

  const handleLogout = async () => {
    await authService.logout();
  };

  const handleStartEdit = () => {
    setEditName(person?.name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!personId || !editName.trim()) return;
    try {
      await updateMutation.mutateAsync({
        personId,
        name: editName.trim(),
      });
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  const photos = photosResponse?.photos ?? [];
  const isLoading = personLoading || photosLoading;

  if (!personId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Invalid person ID</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Back button */}
            <button
              onClick={() => navigate('/people')}
              className="rounded-full p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <div>
              {/* Editable name */}
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="rounded-md border border-gray-300 px-2 py-1 text-xl font-bold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={!editName.trim() || updateMutation.isPending}
                    className="rounded-md bg-primary px-2 py-1 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? '...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {person?.name || 'Unnamed Person'}
                  </h1>
                  <button
                    onClick={handleStartEdit}
                    className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Edit name"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation tabs */}
            <nav className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <Link
                to="/photos"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                Photos
              </Link>
              <Link
                to="/people"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                People
              </Link>
            </nav>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <div className="flex">
              <div className="shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error loading photos
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="mt-2 text-sm font-medium text-red-800 underline hover:text-red-900 dark:text-red-200 dark:hover:text-red-100"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Photo grid */}
        <PhotoGrid photos={photos} isLoading={isLoading} onViewPhoto={setSelectedPhoto} />

        {/* Empty state */}
        {!isLoading && !error && photos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg
              className="mb-4 h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No photos yet</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This person hasn't been tagged in any photos yet.
            </p>
          </div>
        )}
      </main>

      {/* Photo viewer modal */}
      {selectedPhoto && (
        <PhotoViewer photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      )}
    </div>
  );
}
