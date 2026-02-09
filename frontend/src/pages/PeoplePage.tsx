import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { usePeople } from '@/hooks/useFaces';
import { PersonGrid } from '@/components/people';
import { AppLayout } from '@/components/layout/AppLayout';
import type { PersonListItem } from '@/types/api';

export function PeoplePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: peopleResponse, isLoading, error, refetch } = usePeople();

  const handleViewPhotos = (person: PersonListItem) => {
    navigate(`/people/${person.id}`);
  };

  const people = peopleResponse?.people ?? [];

  const filteredPeople = searchQuery
    ? people.filter((person) => person.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : people;

  return (
    <AppLayout>
      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
          <p className="text-sm text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Error loading people'}
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
      {people.length > 0 && (
        <div className="mb-6">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
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
              {filteredPeople.length} of {people.length} matching "{searchQuery}"
            </p>
          )}
        </div>
      )}

      {/* People count */}
      {!isLoading && !error && people.length > 0 && !searchQuery && (
        <p className="mb-4 text-sm text-gray-400 dark:text-gray-500">
          {people.length} {people.length === 1 ? 'person' : 'people'} identified
        </p>
      )}

      {/* People grid */}
      <PersonGrid people={filteredPeople} isLoading={isLoading} onViewPhotos={handleViewPhotos} />
    </AppLayout>
  );
}
