import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { cn } from '../utils';

interface Column<T> {
  key: keyof T;
  title: string | React.ReactNode;
  render?: (value: any, record: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  rowKey: keyof T;
  onRowClick?: (record: T) => void;
  className?: string;
  compact?: boolean;
  onLoadMore?: () => void;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  pagination,
  rowKey,
  onRowClick,
  className,
  compact = false,
  onLoadMore
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  useLayoutEffect(() => { onLoadMoreRef.current = onLoadMore; });
  const hasLoadMore = !!onLoadMore;
  // IO uses viewport (root:null) so it fires correctly even when content fits without scrolling
  useEffect(() => {
    if (!hasLoadMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMoreRef.current?.(); },
      { root: null, threshold: 0, rootMargin: '50px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasLoadMore]);
  // Fill-check: if content doesn't overflow the container, proactively trigger load
  useEffect(() => {
    if (!onLoadMore || !scrollRef.current) return;
    const { scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight <= clientHeight) {
      onLoadMoreRef.current?.();
    }
  }, [data, onLoadMore]);

  const handleSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key!];
      const bVal = b[sortConfig.key!];
      
      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 3xl:p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg shadow', className)}>
      <div ref={scrollRef} className={onLoadMore ? 'overflow-auto' : 'overflow-x-auto'} style={onLoadMore ? { maxHeight: 'calc(100vh - 240px)' } : undefined}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap',
                    compact ? 'px-3 py-2' : 'px-4 py-2 3xl:px-6 3xl:py-3',
                    column.sortable && 'cursor-pointer hover:bg-gray-100'
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        <svg
                          className={cn(
                            'w-3 h-3',
                            sortConfig.key === column.key && sortConfig.direction === 'asc'
                              ? 'text-blue-600'
                              : 'text-gray-400'
                          )}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                        <svg
                          className={cn(
                            'w-3 h-3 -mt-1',
                            sortConfig.key === column.key && sortConfig.direction === 'desc'
                              ? 'text-blue-600'
                              : 'text-gray-400'
                          )}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((record, index) => (
              <tr
                key={String(record[rowKey])}
                className={cn(
                  'hover:bg-blue-50 transition-colors duration-150',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(record)}
              >
                {columns.map((column) => (
                  <td key={String(column.key)} className={cn(
                    'whitespace-nowrap text-sm text-gray-900',
                    compact ? 'px-3 py-2.5' : 'px-4 py-3 3xl:px-6 3xl:py-4'
                  )}>
                    {column.render
                      ? column.render(record[column.key], record)
                      : record[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {hasLoadMore && <div ref={sentinelRef} className="h-2" />}
      </div>

      {pagination && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
              disabled={pagination.current <= 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
              disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                显示{' '}
                <span className="font-medium">
                  {(pagination.current - 1) * pagination.pageSize + 1}
                </span>{' '}
                到{' '}
                <span className="font-medium">
                  {Math.min(pagination.current * pagination.pageSize, pagination.total)}
                </span>{' '}
                条，共{' '}
                <span className="font-medium">{pagination.total}</span> 条记录
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
                  disabled={pagination.current <= 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                {[...Array(Math.ceil(pagination.total / pagination.pageSize))].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => pagination.onChange(i + 1, pagination.pageSize)}
                    className={cn(
                      'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                      pagination.current === i + 1
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
                  disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
