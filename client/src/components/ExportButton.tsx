import React from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Button } from './ui/button';

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
    <Button variant="secondary" onClick={() => !disabled && onExport()} disabled={disabled}>
      <ArrowDownTrayIcon className="h-4 w-4" />
      {label}
    </Button>
  );
}
