// src/pages/GroupDetailPage.tsx
// Group detail page with photos and members tabs

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/auth';
import { useGroup, useUpdateGroup, useDeleteGroup, useLeaveGroup } from '@/hooks/useGroups';
import { usePhotos } from '@/hooks/usePhotos';
import { usePhotoSelection } from '@/hooks/usePhotoSelection';
import { PhotoGrid, PhotoViewer, UploadForm, TagFilter, BulkActionBar } from '@/components/photos';
import { GroupMemberList, InviteLinkModal, EmailInviteModal } from '@/components/groups';
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

  // Selection mode
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

  // Fetch group details
  const { data: groupResponse, isLoading: groupLoading } = useGroup(groupId || '');
  const group = groupResponse?.data?.group;
  const membership = groupResponse?.data?.membership;
  const isOwner = groupResponse?.data?.isOwner ?? false;
  const isAdmin = membership?.role === 'admin';

  // Fetch group photos
  const {
    data: photosResponse,
    isLoading: photosLoading,
    error: photosError,
    refetch: refetchPhotos,
  } = usePhotos({
    groupId: groupId,
    tag: tagFilter || undefined,
  });

  const updateGroupMutation = useUpdateGroup();
  const deleteGroupMutation = useDeleteGroup();
  const leaveGroupMutation = useLeaveGroup();

  const photos = photosResponse?.photos ?? [];
  const selectedPhotoIdsArray = Array.from(selectedPhotoIds);

  const handleLogout = async () => {
    await authService.logout();
  };

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
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Group Not Found</h2>
        <p className="mt-2 text-gray-500">This group does not exist or you don't have access.</p>
        <Link to="/groups" className="mt-4 text-primary hover:text-primary-dark">
          Back to Groups
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isSelectionMode ? 'pb-24' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Back button */}
            <button
              onClick={() => navigate('/groups')}
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
              {/* Editable name (owner only) */}
              {isEditingName && isOwner ? (
                <div className="space-y-2">
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
                      disabled={!editName.trim() || updateGroupMutation.isPending}
                      className="rounded-md bg-primary px-2 py-1 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {updateGroupMutation.isPending ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {group.name}
                    </h1>
                    {isOwner && (
                      <button
                        onClick={handleStartEdit}
                        className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Edit group"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{group.description}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {group._count?.members ?? 0} members &middot; {group._count?.photos ?? 0} photos
                  </p>
                </div>
              )}
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
              <Link
                to="/groups"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                Groups
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
        {/* Sub-tabs: Photos / Members */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => setActiveTab('photos')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'photos'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
            >
              Photos
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'members'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
            >
              Members
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {activeTab === 'photos' && !isSelectionMode && (
              <>
                {/* Selection mode toggle */}
                <button
                  onClick={enterSelectionMode}
                  disabled={photos.length === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Select
                </button>

                {/* Upload button */}
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Upload
                </button>
              </>
            )}

            {activeTab === 'photos' && isSelectionMode && (
              <button
                onClick={() =>
                  selectedCount === photos.length ? deselectAll() : selectAll(photos)
                }
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {selectedCount === photos.length ? 'Deselect All' : 'Select All'}
              </button>
            )}

            {activeTab === 'members' && (isOwner || isAdmin) && (
              <>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  Invite Link
                </button>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Email Invite
                </button>
              </>
            )}
          </div>
        </div>

        {/* Photos tab */}
        {activeTab === 'photos' && (
          <>
            {/* Upload form */}
            {showUpload && !isSelectionMode && (
              <div className="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    Upload Photos to {group.name}
                  </h2>
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
                <UploadForm groupId={groupId} onUploadComplete={handleUploadComplete} />
              </div>
            )}

            {/* Photo error */}
            {photosError && (
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
                    <button
                      onClick={() => refetchPhotos()}
                      className="mt-2 text-sm font-medium text-red-800 underline hover:text-red-900 dark:text-red-200 dark:hover:text-red-100"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tag filter */}
            {!isSelectionMode && (
              <div className="mb-6">
                <TagFilter
                  value={tagFilter}
                  onChange={setTagFilter}
                  placeholder="Filter photos by tag..."
                />
              </div>
            )}

            {/* Selection info */}
            {!photosLoading && !photosError && photos.length > 0 && (
              <div className="mb-4">
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
              isLoading={photosLoading}
              isSelectionMode={isSelectionMode}
              selectedPhotoIds={selectedPhotoIds}
              onToggleSelection={toggleSelection}
              onViewPhoto={setSelectedPhoto}
            />

            {/* Empty state */}
            {!photosLoading && !photosError && photos.length === 0 && (
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
                  Upload photos to share them with the group.
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  Upload Photos
                </button>
              </div>
            )}
          </>
        )}

        {/* Members tab */}
        {activeTab === 'members' && user && (
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <GroupMemberList
              groupId={groupId}
              currentUserId={user.id}
              isOwner={isOwner}
              isAdmin={isAdmin}
            />

            {/* Group actions */}
            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              {isOwner ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete Group
                </button>
              ) : (
                <button
                  onClick={handleLeaveGroup}
                  disabled={leaveGroupMutation.isPending}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {leaveGroupMutation.isPending ? 'Leaving...' : 'Leave Group'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

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
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Group</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete "{group.name}"? All memberships and invites will be
              removed. Photos will remain but will no longer be associated with this group.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGroup}
                disabled={deleteGroupMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteGroupMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
