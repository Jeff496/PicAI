// src/pages/PeoplePage.tsx
// People browser page showing all identified people

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/auth';
import { usePeople } from '@/hooks/useFaces';
import { PersonGrid } from '@/components/people';
import type { PersonListItem } from '@/types/api';

export function PeoplePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch people
  const { data: peopleResponse, isLoading, error, refetch } = usePeople();

  const handleLogout = async () => {
    await authService.logout();
  };

  const handleViewPhotos = (person: PersonListItem) => {
    navigate(`/people/${person.id}`);
  };

  const people = peopleResponse?.people ?? [];

  // Filter people by search query
  const filteredPeople = searchQuery
    ? people.filter((person) => person.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : people;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">People</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Welcome back, {user?.name || 'User'}
            </p>
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
              <span className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white">
                People
              </span>
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
        {/* Error state */}
        {error && (
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
                  Error loading people
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="mt-2 text-sm font-medium text-red-800 underline hover:text-red-900 dark:text-red-200 dark:hover:text-red-100"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search filter */}
        {people.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people by name..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
            {searchQuery && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredPeople.length} of {people.length} people matching "{searchQuery}"
              </p>
            )}
          </div>
        )}

        {/* People count */}
        {!isLoading && !error && people.length > 0 && !searchQuery && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {people.length} {people.length === 1 ? 'person' : 'people'} identified
            </p>
          </div>
        )}

        {/* People grid */}
        <PersonGrid people={filteredPeople} isLoading={isLoading} onViewPhotos={handleViewPhotos} />
      </main>
    </div>
  );
}
