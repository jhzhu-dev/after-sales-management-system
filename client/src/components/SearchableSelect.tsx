import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export interface SearchableSelectOption {
  id: string;
  name: string;
  short_name?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  searchPlaceholder = '搜索...',
  className = 'w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    const found = options.find(o => o.id === value);
    return found?.name || placeholder;
  }, [options, value, placeholder]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.short_name && o.short_name.toLowerCase().includes(q))
    );
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`${className} text-left bg-white flex items-center justify-between gap-2`}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{selectedLabel}</span>
        <ChevronDownIcon className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map(o => (
              <button
                key={o.id || '__all__'}
                type="button"
                onClick={() => handleSelect(o.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                  value === o.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-foreground'
                }`}
              >
                {o.name}
                {o.short_name && o.id !== '' && (
                  <span className="text-muted-foreground ml-1">({o.short_name})</span>
                )}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">无匹配项</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
