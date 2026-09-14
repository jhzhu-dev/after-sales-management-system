import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { cn } from '../utils';

export interface Column<T> {
  key: keyof T;
  title: string | React.ReactNode;
  render?: (value: any, record: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
  /** fixedLayout 下不参与压缩，按内容最小宽度完整显示（如操作按钮列） */
  noShrink?: boolean;
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
  scrollable?: boolean;
  /** 填充模式：卡片高度随父级 flex 容器拉伸（列表底边与侧边栏底边对齐），滚动区改为 flex-1 内部滚动 */
  fill?: boolean;
  /** 卡片底部提示条（如「已显示 x / y 条」） */
  footer?: React.ReactNode;
  fixedLayout?: boolean;
  selectable?: boolean;
  selectedKeys?: Array<string | number>;
  onSelectionChange?: (keys: Array<string | number>) => void;
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
  onLoadMore,
  scrollable = false,
  fill = false,
  footer,
  fixedLayout = false,
  selectable = false,
  selectedKeys = [],
  onSelectionChange
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
  // IO observes within the scrollable container so it fires when the sentinel scrolls into view
  useEffect(() => {
    if (!hasLoadMore || !sentinelRef.current || !scrollRef.current) return;
    const root = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMoreRef.current?.(); },
      { root, threshold: 0, rootMargin: '50px' }
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

  // 勾选逻辑
  const selectedSet = React.useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const renderedKeys: Array<string | number> = sortedData.map((r) => r[rowKey] as string | number);
  const allSelected = renderedKeys.length > 0 && renderedKeys.every((k) => selectedSet.has(k));
  const someSelected = renderedKeys.some((k) => selectedSet.has(k));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    const next = allSelected
      ? selectedKeys.filter((k) => !renderedKeys.includes(k))
      : Array.from(new Set([...selectedKeys, ...renderedKeys]));
    onSelectionChange(next);
  };

  const toggleRow = (key: string | number) => {
    if (!onSelectionChange) return;
    const exists = selectedSet.has(key);
    const next = exists ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key];
    onSelectionChange(next);
  };

  if (loading) {
    return (
      <div className={cn('bg-card rounded-2xl border border-border shadow-soft', fill && 'flex-1 min-h-0 flex flex-col')}>
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
    <div className={cn('bg-card rounded-2xl border border-border shadow-soft overflow-hidden', fill && 'flex-1 min-h-0 flex flex-col', className)}>
      <div
        ref={scrollRef}
        className={cn(
          (scrollable || onLoadMore) ? 'overflow-auto no-scrollbar' : 'overflow-x-auto no-scrollbar',
          fill && 'flex-1 min-h-0'
        )}
        style={(scrollable || onLoadMore) && !fill ? { maxHeight: 'calc(100vh - 240px)' } : undefined}
      >
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted backdrop-blur border-b border-border sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className={cn('text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap', compact ? 'px-3 py-2' : 'px-4 py-2 3xl:px-6 3xl:py-3')} style={{ width: '44px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'text-left text-xs font-semibold text-foreground uppercase tracking-wider whitespace-nowrap',
                    compact ? 'px-3 py-2' : 'px-4 py-2 3xl:px-6 3xl:py-3',
                    column.sortable && 'cursor-pointer hover:bg-muted'
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
                              ? 'text-primary-600'
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
                              ? 'text-primary-600'
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
          <tbody className="divide-y divide-border">
            {sortedData.map((record, index) => (
              <tr
                key={String(record[rowKey])}
                className={cn(
                  'hover:bg-muted transition-colors duration-150',
                  onRowClick && 'cursor-pointer',
                  selectedSet.has(record[rowKey] as string | number) && 'bg-primary-50/40'
                )}
                onClick={() => onRowClick?.(record)}
              >
                {selectable && (
                  <td className={cn('whitespace-nowrap', compact ? 'px-3 py-2.5' : 'px-4 py-3 3xl:px-6 3xl:py-4')} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(record[rowKey] as string | number)}
                      onChange={() => toggleRow(record[rowKey] as string | number)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={String(column.key)} className={cn(
                    'whitespace-nowrap text-sm text-gray-900',
                    compact ? 'px-3 py-2.5' : 'px-4 py-3 3xl:px-6 3xl:py-4'
                  )} style={fixedLayout && !column.noShrink ? { overflow: 'hidden', maxWidth: 0 } : undefined}>
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

      {footer && (
        <div className="shrink-0 text-center text-sm text-gray-400 py-2.5 border-t border-border">
          {footer}
        </div>
      )}

      {pagination && (
        <div className="bg-transparent px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
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
                        ? 'z-10 bg-blue-50 border-primary-500 text-primary-600'
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
