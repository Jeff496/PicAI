import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface TagFilterProps {
  value: string;
  onChange: (tag: string) => void;
  placeholder?: string;
}

export function TagFilter({ value, onChange, placeholder = 'Filter by tag...' }: TagFilterProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

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
        className="w-full border border-rule bg-transparent py-2 pl-3 pr-9 font-sans text-[13px] text-ink placeholder-whisper transition-colors focus:border-ink focus:outline-none dark:border-[#2a2824] dark:text-[#e8e4de] dark:placeholder-[#8a8478] dark:focus:border-[#e8e4de]"
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
        {localValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-subtle transition-colors hover:text-ink dark:text-[#8a8478] dark:hover:text-[#e8e4de]"
            aria-label="Clear filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span
            className="font-sans text-[10px] font-medium uppercase text-whisper dark:text-[#8a8478]"
            style={{ letterSpacing: '0.08em' }}
          >
            Tag
          </span>
        )}
      </div>
    </div>
  );
}
