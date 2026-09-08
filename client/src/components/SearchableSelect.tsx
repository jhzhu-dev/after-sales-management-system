import React from 'react';
import Select from './Select';

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

/**
 * 可搜索下拉框，包装统一的毛玻璃 Select 组件。
 * 保留搜索功能，同时与全站其他下拉框样式完全一致。
 */
const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  searchPlaceholder = '搜索...',
  className = 'w-full px-3 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40',
}) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      searchable
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      className={className}
      options={options.map(o => ({
        value: o.id,
        label: o.name,
        short_name: o.short_name,
      }))}
    />
  );
};

export default SearchableSelect;
