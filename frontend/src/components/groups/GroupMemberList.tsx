// src/components/groups/GroupMemberList.tsx
// Group member list with role management

import { useGroupMembers } from '@/hooks/useGroups';
import { MemberCard } from './MemberCard';

interface GroupMemberListProps {
  groupId: string;
  currentUserId: string;
  isOwner: boolean;
  isAdmin: boolean;
}

export function GroupMemberList({
  groupId,
  currentUserId,
  isOwner,
  isAdmin,
}: GroupMemberListProps) {
  const { data: membersResponse, isLoading } = useGroupMembers(groupId);

  const members = membersResponse?.data?.members ?? [];

  // Sort: owner first, then admins, then members
  const sortedMembers = [...members].sort((a, b) => {
    if (a.isOwner && !b.isOwner) return -1;
    if (!a.isOwner && b.isOwner) return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return 0;
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 rounded-lg px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No members found</p>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
      {sortedMembers.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          currentUserId={currentUserId}
          isCurrentUserOwner={isOwner}
          isCurrentUserAdmin={isAdmin}
          groupId={groupId}
        />
      ))}
    </div>
  );
}
