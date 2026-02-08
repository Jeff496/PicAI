// src/components/groups/MemberCard.tsx
// Individual member row with role management and remove actions

import { useState } from 'react';
import { useUpdateMemberRole, useRemoveMember } from '@/hooks/useGroups';
import type { GroupMemberWithUser } from '@/types/api';

interface MemberCardProps {
  member: GroupMemberWithUser;
  currentUserId: string;
  isCurrentUserOwner: boolean;
  isCurrentUserAdmin: boolean;
  groupId: string;
}

export function MemberCard({
  member,
  currentUserId,
  isCurrentUserOwner,
  isCurrentUserAdmin,
  groupId,
}: MemberCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const updateRoleMutation = useUpdateMemberRole();
  const removeMutation = useRemoveMember();

  const isSelf = member.userId === currentUserId;
  const canChangeRole = isCurrentUserOwner && !member.isOwner && !isSelf;
  const canRemove =
    (!isSelf && isCurrentUserOwner) ||
    (!isSelf && isCurrentUserAdmin && !member.isOwner && member.role !== 'admin');

  const handleRoleChange = async (role: 'admin' | 'member') => {
    try {
      await updateRoleMutation.mutateAsync({ groupId, userId: member.userId, role });
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleRemove = async () => {
    try {
      await removeMutation.mutateAsync({ groupId, userId: member.userId });
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
    setShowConfirm(false);
  };

  const roleBadge = () => {
    if (member.isOwner) {
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Owner
        </span>
      );
    }
    if (member.role === 'admin') {
      return (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          Admin
        </span>
      );
    }
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        Member
      </span>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {member.user?.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>

          {/* Name and email */}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {member.user?.name || 'Unknown'}
              {isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {member.user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {roleBadge()}

          {/* Role change dropdown */}
          {canChangeRole && (
            <select
              value={member.role === 'admin' ? 'admin' : 'member'}
              onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'member')}
              disabled={updateRoleMutation.isPending}
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          )}

          {/* Remove button */}
          {canRemove && (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="rounded p-1 text-gray-400 hover:text-red-500"
              title="Remove member"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Remove confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Remove Member</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to remove {member.user?.name || 'this member'} from the group?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removeMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removeMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
