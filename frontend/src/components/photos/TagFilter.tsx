// src/components/photos/TagFilter.tsx
// Tag filter input component for filtering photos by tag

import { useState, useEffect } from 'react';
import { Tag, X } from 'lucide-react';

interface TagFilterProps {
  value: string;
  onChange: (tag: string) => void;
  placeholder?: string;
}

export function TagFilter({ value, onChange, placeholder = 'Filter by tag...' }: TagFilterProps) {
  const [localValue, setLocalValue] = useState(value);

  // Debounce input to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-9 text-sm text-gray-700 placeholder-gray-400 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:placeholder-gray-500"
      />

      {/* Search icon or clear button */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
        {localValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear filter"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <Tag className="h-4 w-4 text-gray-300 dark:text-gray-600" />
        )}
      </div>
    </div>
  );
}
