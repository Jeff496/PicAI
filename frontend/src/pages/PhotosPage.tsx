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
    selectedPhotoIds,
    isSelectionMode,
    selectedCount,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
  } = usePhotoSelection();

  const { data: groupsResponse } = useGroups();
  const groups = groupsResponse?.data?.groups ?? [];

  const {
    photos,
    total,
    isLoading,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePhotos({
    tag: tagFilter || undefined,
    groupId: groupFilter,
  });
  const selectedPhotoIdsArray = Array.from(selectedPhotoIds);

  const handleUploadComplete = () => {
    setShowUpload(false);
    refetch();
  };

  // Header actions — editorial sharp-rectangle buttons
  const actions = (
    <>
      {!isSelectionMode ? (
        <>
          <button
            onClick={enterSelectionMode}
            disabled={photos.length === 0}
            className="inline-flex items-center gap-1.5 border border-rule px-3 py-1.5 text-[12px] font-medium uppercase text-muted transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2a2824] dark:text-[#8a8478] dark:hover:border-[#e8e4de] dark:hover:text-[#e8e4de]"
            style={{ letterSpacing: '0.04em' }}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Select
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center gap-1.5 bg-ink px-3 py-1.5 text-[12px] font-semibold uppercase text-paper transition-opacity hover:opacity-80 dark:bg-[#e8e4de] dark:text-[#111110]"
            style={{ letterSpacing: '0.04em' }}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => (selectedCount === photos.length ? deselectAll() : selectAll(photos))}
            className="border border-rule px-3 py-1.5 text-[12px] font-medium uppercase text-muted transition-colors hover:border-ink hover:text-ink dark:border-[#2a2824] dark:text-[#8a8478] dark:hover:border-[#e8e4de] dark:hover:text-[#e8e4de]"
            style={{ letterSpacing: '0.04em' }}
          >
            {selectedCount === photos.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={exitSelectionMode}
            className="p-1.5 text-subtle transition-colors hover:text-ink dark:text-[#8a8478] dark:hover:text-[#e8e4de]"
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
          <div className="mb-8 border border-rule p-6 dark:border-[#2a2824]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-[18px] font-normal text-ink dark:text-[#e8e4de]">
                Upload Photos
              </h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-subtle hover:text-ink dark:text-[#8a8478] dark:hover:text-[#e8e4de]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <UploadForm onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
            <p className="text-[13px] text-red-700 dark:text-red-400">
              {error instanceof Error ? error.message : 'Error loading photos'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-1 text-[13px] font-medium text-red-800 underline hover:text-red-900 dark:text-red-300"
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
                  className="appearance-none border border-rule bg-transparent py-2 pl-3 pr-8 font-sans text-[13px] text-ink transition-colors focus:border-ink focus:outline-none dark:border-[#2a2824] dark:text-[#e8e4de] dark:focus:border-[#e8e4de]"
                >
                  <option value="">My Photos</option>
                  <option value="all">All Photos</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle dark:text-[#8a8478]" />
              </div>
            )}
            <div className="w-full sm:w-56">
              <TagFilter value={tagFilter} onChange={setTagFilter} placeholder="Filter by tag..." />
            </div>
          </div>
        )}

        {/* Photo count */}
        {!isLoading && !error && photos.length > 0 && (
          <p
            className="mb-5 font-sans text-[12px] font-normal uppercase text-whisper dark:text-[#8a8478]"
            style={{ letterSpacing: '0.06em' }}
          >
            {isSelectionMode
              ? `${selectedCount} of ${photos.length} selected`
              : `${photos.length}${total > photos.length ? ` of ${total}` : ''} ${total === 1 ? 'photo' : 'photos'}${tagFilter ? ` matching \u201c${tagFilter}\u201d` : ''}`}
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

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="border border-rule px-6 py-2.5 text-[13px] font-semibold text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-50 dark:border-[#2a2824] dark:text-[#8a8478] dark:hover:border-[#e8e4de] dark:hover:text-[#e8e4de]"
              style={{ letterSpacing: '0.02em' }}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
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
