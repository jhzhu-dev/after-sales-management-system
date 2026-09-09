import React from 'react';

export interface ActionListItem {
  id: string | number;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: { text: string; className?: string };
  onClick?: () => void;
}

interface ActionListProps {
  items: ActionListItem[];
  emptyText?: string;
}

const ActionList: React.FC<ActionListProps> = ({ items, emptyText = '暂无数据' }) => {
  if (!items || items.length === 0) {
    return <div className="px-4 py-8 text-center text-gray-500">{emptyText}</div>;
  }

  return (
    <div className="divide-y divide-gray-200">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          disabled={!item.onClick}
          className="w-full px-4 py-3 3xl:px-6 3xl:py-4 flex items-center space-x-3 text-left hover:bg-gray-50 transition-colors disabled:hover:bg-transparent"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
            {item.subtitle && <p className="text-sm text-gray-500 truncate">{item.subtitle}</p>}
          </div>
          {item.badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                item.badge.className || 'bg-gray-100 text-gray-800'
              }`}
            >
              {item.badge.text}
            </span>
          )}
          {item.meta && <span className="text-xs text-gray-400 shrink-0">{item.meta}</span>}
        </button>
      ))}
    </div>
  );
};

export default ActionList;
