// src/components/people/PersonGrid.tsx
// Responsive grid of person cards

import { PersonCard } from './PersonCard';
import type { PersonListItem } from '@/types/api';

interface PersonGridProps {
  people: PersonListItem[];
  isLoading?: boolean;
  onViewPhotos?: (person: PersonListItem) => void;
}

export function PersonGrid({ people, isLoading = false, onViewPhotos }: PersonGridProps) {
  // Skeleton loader for loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="aspect-square animate-pulse bg-gray-200 dark:bg-gray-700" />
            <div className="p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (people.length === 0) {
    return (
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
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No people yet</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tag faces in your photos to start identifying people.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Go to a photo, click "Detect Faces", then click on a face to tag it.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {people.map((person) => (
        <PersonCard key={person.id} person={person} onViewPhotos={onViewPhotos} />
      ))}
    </div>
  );
}
