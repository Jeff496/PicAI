// src/pages/PhotosPage.tsx
// Main photos page with upload form and photo grid

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/auth';
import { usePhotos } from '@/hooks/usePhotos';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { useGroups } from '@/hooks/useGroups';
import { UploadForm, PhotoGrid, PhotoViewer, TagFilter, BulkActionBar } from '@/components/photos';
import type { Photo, PhotoListItem } from '@/types/api';

export function PhotosPage() {
  const user = useAuthStore((state) => state.user);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | PhotoListItem | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | undefined>(undefined);

  // Selection mode state
  const {
    selectedPhotoIds,
    isSelectionMode,
    selectedCount,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
  } = usePhotoSelection();

  // Fetch user's groups for the filter dropdown
  const { data: groupsResponse } = useGroups();
  const groups = groupsResponse?.data?.groups ?? [];

  // Fetch photos with optional tag and group filter
  const {
    data: photosResponse,
    isLoading,
    error,
    refetch,
  } = usePhotos({
    tag: tagFilter || undefined,
    groupId: groupFilter,
  });

  const handleLogout = async () => {
    await authService.logout();
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    refetch();
  };

  const photos = photosResponse?.photos ?? [];

  // Convert Set to Array for BulkActionBar
  const selectedPhotoIdsArray = Array.from(selectedPhotoIds);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isSelectionMode ? 'pb-24' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Photos</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Welcome back, {user?.name || 'User'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation tabs */}
            <nav className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <span className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white">
                Photos
              </span>
              <Link
                to="/people"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                People
              </Link>
              <Link
                to="/groups"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                Groups
              </Link>
            </nav>

            {/* Selection mode toggle */}
            {!isSelectionMode ? (
              <button
                onClick={enterSelectionMode}
                disabled={photos.length === 0}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                Select
              </button>
            ) : (
              <>
                {/* Select/Deselect All */}
                <button
                  onClick={() =>
                    selectedCount === photos.length ? deselectAll() : selectAll(photos)
                  }
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  {selectedCount === photos.length ? 'Deselect All' : 'Select All'}
                </button>
              </>
            )}

            {/* Upload button (hidden in selection mode) */}
            {!isSelectionMode && (
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload
              </button>
            )}

            {/* Logout button (hidden in selection mode) */}
            {!isSelectionMode && (
              <button
                onClick={handleLogout}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Upload form (collapsible) */}
        {showUpload && !isSelectionMode && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Upload Photos</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <UploadForm onUploadComplete={handleUploadComplete} />
          </div>
        )}

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

        {/* Filters (hidden in selection mode) */}
        {!isSelectionMode && (
          <div className="mb-6 space-y-3">
            {/* Group filter */}
            {groups.length > 0 && (
              <select
                value={groupFilter ?? ''}
                onChange={(e) => setGroupFilter(e.target.value || undefined)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-auto"
              >
                <option value="">My Photos</option>
                <option value="all">All Photos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}

            {/* Tag filter */}
            <TagFilter
              value={tagFilter}
              onChange={setTagFilter}
              placeholder="Filter photos by tag..."
            />
            {tagFilter && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Showing photos tagged with "{tagFilter}"
              </p>
            )}
          </div>
        )}

        {/* Photo count / Selection info */}
        {!isLoading && !error && photos.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isSelectionMode
                ? `${selectedCount} of ${photos.length} photo${photos.length !== 1 ? 's' : ''} selected`
                : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}${tagFilter ? ` matching "${tagFilter}"` : ''}`}
            </p>
          </div>
        )}

        {/* Photo grid */}
        <PhotoGrid
          photos={photos}
          isLoading={isLoading}
          isSelectionMode={isSelectionMode}
          selectedPhotoIds={selectedPhotoIds}
          onToggleSelection={toggleSelection}
          onViewPhoto={setSelectedPhoto}
        />
      </main>

      {/* Photo viewer modal (not shown in selection mode) */}
      {selectedPhoto && !isSelectionMode && (
        <PhotoViewer photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      )}

      {/* Bulk action bar */}
      {isSelectionMode && (
        <BulkActionBar
          selectedCount={selectedCount}
          selectedPhotoIds={selectedPhotoIdsArray}
          onCancel={exitSelectionMode}
          onComplete={refetch}
        />
      )}
    </div>
  );
}
