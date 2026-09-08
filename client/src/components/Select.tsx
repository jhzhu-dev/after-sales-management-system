import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export interface SelectOption {
  value: string | number;
  label: string;
  short_name?: string;
}

interface SelectProps {
  value: string | number | undefined | null;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  panelClassName?: string;
}

/**
 * 统一风格的圆角毛玻璃下拉框。
 * 完全替代原生 <select>，用于保持全站下拉列表样式一致。
 */
const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  searchable = false,
  searchPlaceholder = '搜索...',
  className = 'w-full px-3 py-2 border border-border rounded-xl bg-card text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60 disabled:cursor-not-allowed',
  panelClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    const found = options.find(o => String(o.value) === String(value));
    return found?.label || placeholder;
  }, [options, value, placeholder]);

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.short_name && o.short_name.toLowerCase().includes(q))
    );
  }, [options, search, searchable]);

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

  const handleSelect = (val: string | number) => {
    onChange?.(String(val));
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(prev => !prev); }}
        className={`${className} ${open ? 'ring-2 ring-primary-500/40' : ''}`}
      >
        <span className={`truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>{selectedLabel}</span>
        <ChevronDownIcon className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute z-30 w-full mt-1 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden ${panelClassName}`}>
          {searchable && (
            <div className="p-2 border-b border-border/60">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-2 py-1.5 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto no-scrollbar">
            {filteredOptions.map(o => (
              <button
                key={String(o.value)}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(o.value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 ${
                  String(value) === String(o.value) ? 'bg-primary-50 text-primary-700 font-medium' : 'text-foreground'
                }`}
              >
                {o.label}
                {o.short_name && String(o.value) !== '' && (
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

export default Select;
