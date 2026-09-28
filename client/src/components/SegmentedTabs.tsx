import React, { useLayoutEffect, useRef, useState } from 'react';

export interface SegmentedTabItem<T extends string | number> {
  key: T;
  label: React.ReactNode;
}

interface SegmentedTabsProps<T extends string | number> {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * 统一的滑块式横向选项卡：
 * 玻璃容器 + 渐变滑块跟随选中项平滑移动，指示块宽度随内容自适应。
 */
export default function SegmentedTabs<T extends string | number>({
  items,
  value,
  onChange,
  className = '',
}: SegmentedTabsProps<T>) {
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  const updateThumb = React.useCallback(() => {
    const el = itemRefs.current[String(value)];
    if (el) {
      setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [value]);

  useLayoutEffect(() => {
    updateThumb();
    window.addEventListener('resize', updateThumb);
    return () => window.removeEventListener('resize', updateThumb);
  }, [updateThumb, items]);

  return (
    <div className={`segmented relative inline-flex max-w-full overflow-x-auto no-scrollbar ${className}`}>
      {/* 滑块指示器 */}
      {thumb && (
        <span
          aria-hidden
          className="segmented-thumb"
          style={{ left: thumb.left, width: thumb.width, transition: 'left 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)' }}
        />
      )}
      {items.map(item => {
        const active = item.key === value;
        return (
          <button
            key={String(item.key)}
            ref={el => { itemRefs.current[String(item.key)] = el; }}
            type="button"
            onClick={() => onChange(item.key)}
            className={`segmented-item relative z-10 whitespace-nowrap ${active ? 'segmented-item-active' : ''}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
