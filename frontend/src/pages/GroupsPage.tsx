import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { useGroups } from '@/hooks/useGroups';
import { GroupCard, CreateGroupModal } from '@/components/groups';
import { AppLayout } from '@/components/layout/AppLayout';
import type { GroupWithCreator } from '@/types/api';

export function GroupsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: groupsResponse, isLoading, error, refetch } = useGroups();

  const handleViewGroup = (group: GroupWithCreator) => {
    navigate(`/groups/${group.id}`);
  };

  const handleGroupCreated = (groupId: string) => {
    navigate(`/groups/${groupId}`);
  };

  const groups = groupsResponse?.data?.groups ?? [];

  const filteredGroups = searchQuery
    ? groups.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : groups;

  const actions = (
    <button
      onClick={() => setShowCreateModal(true)}
      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
    >
      <Plus className="h-4 w-4" />
      Create Group
    </button>
  );

  return (
    <AppLayout actions={actions}>
      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
          <p className="text-sm text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Error loading groups'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-1 text-sm font-medium text-red-800 underline hover:text-red-900 dark:text-red-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Search filter */}
      {groups.length > 0 && (
        <div className="mb-6">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
              {filteredGroups.length} of {groups.length} matching "{searchQuery}"
            </p>
          )}
        </div>
      )}

      {/* Group count */}
      {!isLoading && !error && groups.length > 0 && !searchQuery && (
        <p className="mb-4 text-sm text-gray-400 dark:text-gray-500">
          {groups.length} {groups.length === 1 ? 'group' : 'groups'}
        </p>
      )}

      {/* Groups grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-gray-200 dark:border-white/5">
              <div className="aspect-square bg-gray-100 dark:bg-white/5" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-24 rounded bg-gray-100 dark:bg-white/5" />
                <div className="h-3 w-16 rounded bg-gray-100 dark:bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredGroups.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filteredGroups.map((group) => (
            <GroupCard key={group.id} group={group} onViewGroup={handleViewGroup} />
          ))}
        </div>
      ) : !error && groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-base font-medium text-gray-900 dark:text-white">No groups yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create a group to start sharing photos with others.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Create Your First Group
          </button>
        </div>
      ) : null}

      {/* Create group modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleGroupCreated}
      />
    </AppLayout>
  );
}
