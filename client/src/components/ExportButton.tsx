import React from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface ExportButtonProps {
  onExport: () => void;
  disabled?: boolean;
  label?: string;
}

export default function ExportButton({
  onExport,
  disabled = false,
  label = '导出 Excel'
}: ExportButtonProps) {
  return (
    <button
      onClick={() => !disabled && onExport()}
      disabled={disabled}
      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
      {label}
    </button>
  );
}
