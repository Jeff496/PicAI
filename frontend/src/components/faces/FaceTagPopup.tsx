// src/components/faces/FaceTagPopup.tsx
// Popup for tagging a face with a person

import { useState, useEffect, useRef } from 'react';
import { useTagFace, useUntagFace, usePeople } from '@/hooks/useFaces';
import type { Face } from '@/types/api';

interface FaceTagPopupProps {
  face: Face;
  photoId: string;
  onClose: () => void;
  position?: { x: number; y: number };
}

export function FaceTagPopup({ face, photoId, onClose, position }: FaceTagPopupProps) {
  const [newPersonName, setNewPersonName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tagMutation = useTagFace();
  const untagMutation = useUntagFace();
  const { data: peopleResponse, isLoading: peopleLoading } = usePeople();

  const people = peopleResponse?.people || [];

  // Filter people by search query
  const filteredPeople = people.filter((person) =>
    person.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Focus input when showing create form
  useEffect(() => {
    if (showCreateForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreateForm]);

  const handleTagWithExisting = async (personId: string) => {
    try {
      await tagMutation.mutateAsync({
        faceId: face.id,
        photoId,
        tagData: { personId },
      });
      onClose();
    } catch (error) {
      console.error('Failed to tag face:', error);
    }
  };

  const handleCreateAndTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    try {
      await tagMutation.mutateAsync({
        faceId: face.id,
        photoId,
        tagData: { personName: newPersonName.trim() },
      });
      onClose();
    } catch (error) {
      console.error('Failed to create person and tag face:', error);
    }
  };

  const handleUntag = async () => {
    try {
      await untagMutation.mutateAsync({
        faceId: face.id,
        photoId,
      });
      onClose();
    } catch (error) {
      console.error('Failed to untag face:', error);
    }
  };

  const popupStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 280),
        top: Math.min(position.y, window.innerHeight - 400),
      }
    : {};

  const isTagged = !!face.person;
  const hasSuggestion = !isTagged && !!face.match;

  // Handler for confirming a suggestion
  const handleConfirmSuggestion = async () => {
    if (!face.match) return;
    try {
      await tagMutation.mutateAsync({
        faceId: face.id,
        photoId,
        tagData: { personId: face.match.personId },
      });
      onClose();
    } catch (error) {
      console.error('Failed to confirm suggestion:', error);
    }
  };

  return (
    <div
      ref={popupRef}
      className="z-60 w-64 rounded-lg bg-gray-800 p-4 shadow-xl ring-1 ring-white/10"
      style={popupStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">
          {isTagged ? 'Update Tag' : hasSuggestion ? 'Confirm Match?' : 'Who is this?'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
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
      </div>

      {/* Suggestion confirmation (prominent when there's a match) */}
      {hasSuggestion && face.match && (
        <div className="mb-4 rounded-md bg-orange-500/20 p-3">
          <p className="mb-2 text-sm text-orange-300">
            This looks like <strong>{face.match.personName || 'Unknown'}</strong>
          </p>
          <p className="mb-3 text-xs text-orange-300/70">
            {Math.round(face.match.similarity)}% match confidence
          </p>
          <button
            type="button"
            onClick={handleConfirmSuggestion}
            disabled={tagMutation.isPending}
            className="w-full rounded-md bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {tagMutation.isPending
              ? 'Confirming...'
              : `Yes, this is ${face.match.personName || 'them'}`}
          </button>
          <p className="mt-2 text-center text-xs text-white/50">Or select someone else below</p>
        </div>
      )}

      {/* Current tag info */}
      {isTagged && face.person && (
        <div className="mb-3 rounded-md bg-green-500/20 p-2">
          <p className="text-xs text-green-400">
            Currently tagged as: <strong>{face.person.name || 'Unnamed'}</strong>
          </p>
        </div>
      )}

      {/* Confidence info */}
      <p className="mb-3 text-xs text-white/60">
        Detection confidence: {face.confidence.toFixed(0)}%
      </p>

      {showCreateForm ? (
        /* Create new person form */
        <form onSubmit={handleCreateAndTag}>
          <input
            ref={inputRef}
            type="text"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="Enter name..."
            className="mb-2 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newPersonName.trim() || tagMutation.isPending}
              className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {tagMutation.isPending ? 'Creating...' : 'Create & Tag'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewPersonName('');
              }}
              className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Search existing people */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people..."
            className="mb-2 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
          />

          {/* People list */}
          <div className="mb-3 max-h-40 overflow-y-auto">
            {peopleLoading ? (
              <p className="py-2 text-center text-xs text-white/60">Loading...</p>
            ) : filteredPeople.length > 0 ? (
              <div className="space-y-1">
                {filteredPeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleTagWithExisting(person.id)}
                    disabled={tagMutation.isPending}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {/* Avatar placeholder */}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-medium">
                      {person.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{person.name || 'Unnamed'}</p>
                      {person.photoCount > 0 && (
                        <p className="text-xs text-white/60">
                          {person.photoCount} photo{person.photoCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <p className="py-2 text-center text-xs text-white/60">
                No people found matching "{searchQuery}"
              </p>
            ) : (
              <p className="py-2 text-center text-xs text-white/60">
                No people yet. Create one below.
              </p>
            )}
          </div>

          {/* Create new person button */}
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-white/30 py-2 text-sm text-white/80 hover:border-white/50 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create new person
          </button>

          {/* Untag button (if already tagged) */}
          {isTagged && (
            <button
              type="button"
              onClick={handleUntag}
              disabled={untagMutation.isPending}
              className="w-full rounded-md bg-red-600/20 py-1.5 text-sm text-red-400 hover:bg-red-600/30 disabled:opacity-50"
            >
              {untagMutation.isPending ? 'Removing...' : 'Remove Tag'}
            </button>
          )}
        </>
      )}

      {/* Error display */}
      {(tagMutation.isError || untagMutation.isError) && (
        <p className="mt-2 text-xs text-red-400">An error occurred. Please try again.</p>
      )}
    </div>
  );
}
