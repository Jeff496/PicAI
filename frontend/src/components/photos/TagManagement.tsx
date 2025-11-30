// src/components/photos/TagManagement.tsx
// Tag management component for adding/removing tags and re-analyzing photos

import { useState } from 'react';
import { useAddTag, useRemoveTag, useAnalyzePhoto } from '@/hooks/usePhotos';
import type { PhotoTag } from '@/types/api';

interface TagManagementProps {
  photoId: string;
  tags: PhotoTag[];
}

const categoryLabels: Record<string, string> = {
  tag: 'Tags',
  object: 'Objects',
  text: 'Text',
  people: 'People',
  manual: 'Manual Tags',
  caption: 'Caption',
  other: 'Other',
};

export function TagManagement({ photoId, tags }: TagManagementProps) {
  const [newTag, setNewTag] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const addTagMutation = useAddTag();
  const removeTagMutation = useRemoveTag();
  const analyzeMutation = useAnalyzePhoto();

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    try {
      await addTagMutation.mutateAsync({
        photoId,
        tag: newTag.trim(),
        category: 'manual',
      });
      setNewTag('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagMutation.mutateAsync({ photoId, tagId });
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  const handleReanalyze = async () => {
    try {
      await analyzeMutation.mutateAsync(photoId);
    } catch (error) {
      console.error('Failed to analyze photo:', error);
    }
  };

  // Group tags by category
  const groupedTags = tags.reduce(
    (acc, tag) => {
      const category = tag.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(tag);
      return acc;
    },
    {} as Record<string, PhotoTag[]>
  );

  return (
    <div className="space-y-4">
      {/* Header with re-analyze button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/80">AI Tags</h3>
        <button
          type="button"
          onClick={handleReanalyze}
          disabled={analyzeMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
        >
          {analyzeMutation.isPending ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Re-analyze
            </>
          )}
        </button>
      </div>

      {/* Tags grouped by category */}
      {Object.entries(groupedTags).map(([category, categoryTags]) => (
        <div key={category}>
          <p className="mb-1 text-xs text-white/60">{categoryLabels[category] || category}</p>
          <div className="flex flex-wrap gap-2">
            {categoryTags.map((tag) => (
              <span
                key={tag.id}
                className="group inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs text-white"
                title={`${(tag.confidence * 100).toFixed(0)}% confidence`}
              >
                {tag.tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag.id)}
                  disabled={removeTagMutation.isPending}
                  className="ml-1 rounded-full p-0.5 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100 disabled:opacity-50"
                  title="Remove tag"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* Add tag form */}
      {showAddForm ? (
        <form onSubmit={handleAddTag} className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Enter tag..."
            autoFocus
            className="flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newTag.trim() || addTagMutation.isPending}
            className="rounded-md bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30 disabled:opacity-50"
          >
            {addTagMutation.isPending ? 'Adding...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              setNewTag('');
            }}
            className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add tag
        </button>
      )}

      {/* No tags state */}
      {tags.length === 0 && !showAddForm && (
        <p className="text-sm text-white/60">
          No tags yet. Click "Re-analyze" to generate AI tags or add tags manually.
        </p>
      )}
    </div>
  );
}
