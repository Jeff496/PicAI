// src/components/groups/GroupCard.tsx
// Individual group card for the groups list view

import type { GroupWithCreator } from '@/types/api';

interface GroupCardProps {
  group: GroupWithCreator;
  onViewGroup?: (group: GroupWithCreator) => void;
}

export function GroupCard({ group, onViewGroup }: GroupCardProps) {
  const memberCount = group._count?.members ?? 0;
  const photoCount = group._count?.photos ?? 0;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-md dark:bg-gray-800"
      onClick={() => onViewGroup?.(group)}
    >
      {/* Visual header */}
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/30 dark:to-primary/10">
        <span className="text-5xl font-bold text-primary/60 dark:text-primary/40">
          {group.name[0]?.toUpperCase() || '?'}
        </span>

        {/* Member count badge */}
        {memberCount > 0 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded-full bg-white/90 p-2 text-gray-700 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onViewGroup?.(group);
            }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Group info */}
      <div className="p-3">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{group.name}</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          {group.creator && <> &middot; by {group.creator.name}</>}
        </p>
      </div>
    </div>
  );
}
