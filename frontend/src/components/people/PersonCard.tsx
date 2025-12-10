// src/components/people/PersonCard.tsx
// Individual person card displaying avatar and info with actions

import { useState } from 'react';
import { useUpdatePerson, useDeletePerson } from '@/hooks/useFaces';
import type { PersonListItem } from '@/types/api';

interface PersonCardProps {
  person: PersonListItem;
  onViewPhotos?: (person: PersonListItem) => void;
}

export function PersonCard({ person, onViewPhotos }: PersonCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(person.name || '');

  const updateMutation = useUpdatePerson();
  const deleteMutation = useDeletePerson();

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    try {
      await updateMutation.mutateAsync({
        personId: person.id,
        name: editName.trim(),
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update person name:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(person.id);
    } catch (err) {
      console.error('Failed to delete person:', err);
    }
    setShowConfirm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(person.name || '');
    }
  };

  const faceCount = person.photoCount ?? 0;

  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-md dark:bg-gray-800">
      {/* Avatar container */}
      <div
        className="relative aspect-square cursor-pointer bg-gray-100 dark:bg-gray-700"
        onClick={() => onViewPhotos?.(person)}
      >
        {/* Avatar placeholder - shows first letter of name */}
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-5xl font-bold text-gray-400 dark:text-gray-500">
            {person.name?.[0]?.toUpperCase() || '?'}
          </span>
        </div>

        {/* Photo count badge */}
        {faceCount > 0 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {faceCount} photo{faceCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded-full bg-white/90 p-2 text-gray-700 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onViewPhotos?.(person);
            }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Person info */}
      <div className="p-3">
        {isEditing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Enter name..."
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={!editName.trim() || updateMutation.isPending}
              className="rounded bg-primary px-2 py-1 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {updateMutation.isPending ? '...' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p
              className="cursor-pointer truncate text-sm font-medium text-gray-900 hover:text-primary dark:text-white"
              onClick={() => setIsEditing(true)}
              title="Click to edit name"
            >
              {person.name || 'Unnamed Person'}
            </p>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-500 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:bg-gray-800/90"
        title="Delete person"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Person</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete "{person.name || 'Unnamed Person'}"? This will remove
              all face tags associated with this person. This action cannot be undone.
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
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
