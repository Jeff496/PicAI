import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Upload, Link as LinkIcon, Mail, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useGroup, useUpdateGroup, useDeleteGroup, useLeaveGroup } from '@/hooks/useGroups';
import { usePhotos } from '@/hooks/usePhotos';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { PhotoGrid, PhotoViewer, UploadForm, TagFilter, BulkActionBar } from '@/components/photos';
import { GroupMemberList, InviteLinkModal, EmailInviteModal } from '@/components/groups';
import { AppLayout } from '@/components/layout/AppLayout';
import type { Photo, PhotoListItem } from '@/types/api';

type ActiveTab = 'photos' | 'members';

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState<ActiveTab>('photos');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | PhotoListItem | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

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

  const { data: groupResponse, isLoading: groupLoading } = useGroup(groupId || '');
  const group = groupResponse?.data?.group;
  const membership = groupResponse?.data?.membership;
  const isOwner = groupResponse?.data?.isOwner ?? false;
  const isAdmin = membership?.role === 'admin';

  const {
    data: photosResponse,
    isLoading: photosLoading,
    error: photosError,
    refetch: refetchPhotos,
  } = usePhotos({ groupId, tag: tagFilter || undefined });

  const updateGroupMutation = useUpdateGroup();
  const deleteGroupMutation = useDeleteGroup();
  const leaveGroupMutation = useLeaveGroup();

  const photos = photosResponse?.photos ?? [];
  const selectedPhotoIdsArray = Array.from(selectedPhotoIds);

  const handleUploadComplete = () => {
    setShowUpload(false);
    refetchPhotos();
  };

  const handleStartEdit = () => {
    setEditName(group?.name || '');
    setEditDescription(group?.description || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!groupId || !editName.trim()) return;
    try {
      await updateGroupMutation.mutateAsync({
        groupId,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update group:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSaveName();
    else if (e.key === 'Escape') setIsEditingName(false);
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;
    try {
      await deleteGroupMutation.mutateAsync(groupId);
      navigate('/groups');
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
    setShowDeleteConfirm(false);
  };

  const handleLeaveGroup = async () => {
    if (!groupId) return;
    try {
      await leaveGroupMutation.mutateAsync(groupId);
      navigate('/groups');
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
  };

  if (!groupId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Invalid group ID</p>
      </div>
    );
  }

  if (groupLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Group Not Found</h2>
        <p className="mt-2 text-sm text-gray-500">
          This group does not exist or you don't have access.
        </p>
        <Link to="/groups" className="mt-4 text-sm text-accent hover:text-accent-hover">
          Back to Groups
        </Link>
      </div>
    );
  }

  // Header actions
  const actions = (
    <>
      <button
        onClick={() => navigate('/groups')}
        className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Back to Groups"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      {activeTab === 'photos' && !isSelectionMode && (
        <>
          <button
            onClick={enterSelectionMode}
            disabled={photos.length === 0}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
          >
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
      )}
      {activeTab === 'photos' && isSelectionMode && (
        <>
          <button
            onClick={() => (selectedCount === photos.length ? deselectAll() : selectAll(photos))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
          >
            {selectedCount === photos.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={exitSelectionMode}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
      {activeTab === 'members' && (isOwner || isAdmin) && (
        <>
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <LinkIcon className="h-4 w-4" />
            Invite Link
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <Mail className="h-4 w-4" />
            Email
          </button>
        </>
      )}
    </>
  );

  return (
    <AppLayout actions={actions}>
      <div className={isSelectionMode ? 'pb-24' : ''}>
        {/* Group header */}
        <div className="mb-6">
          {isEditingName && isOwner ? (
            <div className="space-y-2">
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
                  disabled={!editName.trim() || updateGroupMutation.isPending}
                  className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {updateGroupMutation.isPending ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1 text-sm transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {group.name}
                </h2>
                {isOwner && (
                  <button
                    onClick={handleStartEdit}
                    className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Edit group"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {group.description && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {group.description}
                </p>
              )}
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {group._count?.members ?? 0} members &middot; {group._count?.photos ?? 0} photos
              </p>
            </div>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="mb-6 flex items-center gap-1">
          {(['photos', 'members'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Photos tab */}
        {activeTab === 'photos' && (
          <>
            {showUpload && !isSelectionMode && (
              <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Upload Photos to {group.name}
                  </h3>
                  <button
                    onClick={() => setShowUpload(false)}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <UploadForm groupId={groupId} onUploadComplete={handleUploadComplete} />
              </div>
            )}

            {photosError && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
                <p className="text-sm text-red-700 dark:text-red-400">Error loading photos</p>
                <button
                  onClick={() => refetchPhotos()}
                  className="mt-1 text-sm font-medium text-red-800 underline dark:text-red-300"
                >
                  Try again
                </button>
              </div>
            )}

            {!isSelectionMode && (
              <div className="mb-6">
                <TagFilter
                  value={tagFilter}
                  onChange={setTagFilter}
                  placeholder="Filter by tag..."
                />
              </div>
            )}

            {!photosLoading && !photosError && photos.length > 0 && (
              <p className="mb-4 text-sm text-gray-400 dark:text-gray-500">
                {isSelectionMode
                  ? `${selectedCount} of ${photos.length} selected`
                  : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}${tagFilter ? ` matching "${tagFilter}"` : ''}`}
              </p>
            )}

            <PhotoGrid
              photos={photos}
              isLoading={photosLoading}
              isSelectionMode={isSelectionMode}
              selectedPhotoIds={selectedPhotoIds}
              onToggleSelection={toggleSelection}
              onViewPhoto={setSelectedPhoto}
            />

            {!photosLoading && !photosError && photos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <h3 className="text-base font-medium text-gray-900 dark:text-white">
                  No photos yet
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Upload photos to share them with the group.
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
                >
                  Upload Photos
                </button>
              </div>
            )}
          </>
        )}

        {/* Members tab */}
        {activeTab === 'members' && user && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-white/5 dark:bg-white/[0.02]">
            <GroupMemberList
              groupId={groupId}
              currentUserId={user.id}
              isOwner={isOwner}
              isAdmin={isAdmin}
            />

            <div className="mt-6 border-t border-gray-100 pt-4 dark:border-white/5">
              {isOwner ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete Group
                </button>
              ) : (
                <button
                  onClick={handleLeaveGroup}
                  disabled={leaveGroupMutation.isPending}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {leaveGroupMutation.isPending ? 'Leaving...' : 'Leave Group'}
                </button>
              )}
            </div>
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
          onComplete={refetchPhotos}
        />
      )}

      {/* Invite modals */}
      <InviteLinkModal
        isOpen={showInviteModal}
        groupId={groupId}
        onClose={() => setShowInviteModal(false)}
      />
      <EmailInviteModal
        isOpen={showEmailModal}
        groupId={groupId}
        onClose={() => setShowEmailModal(false)}
      />

      {/* Delete group confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete Group</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete "{group.name}"? All memberships and invites will be
              removed. Photos will remain but will no longer be associated with this group.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={deleteGroupMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteGroupMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
