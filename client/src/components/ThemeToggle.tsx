import React from 'react';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { cn } from '../utils';
import { useTheme, ThemePreference } from '../context/ThemeContext';

const options: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: '浅色', icon: <SunIcon className="h-4 w-4" /> },
  { value: 'system', label: '跟随系统', icon: <ComputerDesktopIcon className="h-4 w-4" /> },
  { value: 'dark', label: '深色', icon: <MoonIcon className="h-4 w-4" /> },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1 no-print" title="主题切换">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors',
            theme === opt.value
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
          )}
        >
          {opt.icon}
          <span className="hidden lg:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
