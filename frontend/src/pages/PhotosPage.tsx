import { useState } from 'react';
import { Upload, CheckSquare, X, ChevronDown } from 'lucide-react';
import { usePhotos } from '@/hooks/usePhotos';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { useGroups } from '@/hooks/useGroups';
import { UploadForm, PhotoGrid, PhotoViewer, TagFilter, BulkActionBar } from '@/components/photos';
import { AppLayout } from '@/components/layout/AppLayout';
import type { Photo, PhotoListItem } from '@/types/api';

export function PhotosPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | PhotoListItem | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | undefined>(undefined);

  const {
    selectedPhotoIds, isSelectionMode, selectedCount,
    toggleSelection, selectAll, deselectAll, enterSelectionMode, exitSelectionMode,
  } = usePhotoSelection();

  const { data: groupsResponse } = useGroups();
  const groups = groupsResponse?.data?.groups ?? [];

  const { data: photosResponse, isLoading, error, refetch } = usePhotos({
    tag: tagFilter || undefined,
    groupId: groupFilter,
  });

  const photos = photosResponse?.photos ?? [];
  const selectedPhotoIdsArray = Array.from(selectedPhotoIds);

  const handleUploadComplete = () => {
    setShowUpload(false);
    refetch();
  };

  // Header actions
  const actions = (
    <>
      {!isSelectionMode ? (
        <>
          <button
            onClick={enterSelectionMode}
            disabled={photos.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <CheckSquare className="h-4 w-4" />
            Select
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => selectedCount === photos.length ? deselectAll() : selectAll(photos)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
          >
            {selectedCount === photos.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={exitSelectionMode}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Cancel selection"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </>
  );

  return (
    <AppLayout actions={actions}>
      <div className={isSelectionMode ? 'pb-24' : ''}>
        {/* Upload form (collapsible) */}
        {showUpload && !isSelectionMode && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/[0.02]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Upload Photos</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <UploadForm onUploadComplete={handleUploadComplete} />
          </div>
        )}

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

        {/* Filters */}
        {!isSelectionMode && (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {groups.length > 0 && (
              <div className="relative">
                <select
                  value={groupFilter ?? ''}
                  onChange={(e) => setGroupFilter(e.target.value || undefined)}
                  className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                >
                  <option value="">My Photos</option>
                  <option value="all">All Photos</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              </div>
            )}
            <TagFilter value={tagFilter} onChange={setTagFilter} placeholder="Filter by tag..." />
          </div>
        )}

        {/* Photo count */}
        {!isLoading && !error && photos.length > 0 && (
          <p className="mb-4 text-sm text-gray-400 dark:text-gray-500">
            {isSelectionMode
              ? `${selectedCount} of ${photos.length} selected`
              : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}${tagFilter ? ` matching "${tagFilter}"` : ''}`}
          </p>
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
      </div>

      {/* Photo viewer modal */}
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
    </AppLayout>
  );
}
