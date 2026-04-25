import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { FeishuUser } from '../types';

interface FeishuMultiUserPickerProps {
  users: FeishuUser[];
  /** open_id 列表：由所选模块自动置顶的用户 */
  pinnedOpenIds: string[];
  /** 当前已选中的 open_id 列表 */
  value: string[];
  onChange: (openIds: string[]) => void;
  disabled?: boolean;
}

/**
 * 飞书多选通知组件
 * - pinnedOpenIds 对应的用户显示在顶部，带"📌 模块关联"标识，默认勾选
 * - 其余用户在分隔线下方，可手动勾选
 */
const FeishuMultiUserPicker: React.FC<FeishuMultiUserPickerProps> = ({
  users,
  pinnedOpenIds,
  value,
  onChange,
  disabled = false,
}) => {
  const [othersExpanded, setOthersExpanded] = useState(false);

  if (!users || users.length === 0) return null;

  const pinnedUsers = pinnedOpenIds
    .map(id => users.find(u => u.open_id === id))
    .filter(Boolean) as FeishuUser[];

  const otherUsers = users.filter(u => !pinnedOpenIds.includes(u.open_id));

  const toggle = (openId: string) => {
    if (disabled) return;
    if (value.includes(openId)) {
      onChange(value.filter(id => id !== openId));
    } else {
      onChange([...value, openId]);
    }
  };

  const renderUser = (u: FeishuUser, isPinned: boolean) => {
    const checked = value.includes(u.open_id);
    return (
      <label
        key={u.open_id}
        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer select-none
          ${isPinned ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggle(u.open_id)}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
        />
        <span className="flex-1 text-sm text-gray-800">
          {u.name}
          {u.department ? <span className="text-gray-400 ml-1">· {u.department}</span> : null}
        </span>
        {isPinned && (
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
            📌 模块关联
          </span>
        )}
      </label>
    );
  };

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      {/* 已选汇总 */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
          {value.map(id => {
            const u = users.find(u => u.open_id === id);
            if (!u) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full"
              >
                {u.name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter(i => i !== id))}
                    className="ml-0.5 text-blue-500 hover:text-blue-800 leading-none"
                    aria-label={`取消 ${u.name}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* 用户列表 */}
      <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
        {/* 置顶用户 */}
        {pinnedUsers.length > 0 && (
          <>
            {pinnedUsers.map(u => renderUser(u, true))}
          </>
        )}

        {/* 其他人员折叠区 */}
        {otherUsers.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOthersExpanded(prev => !prev)}
              className="w-full flex items-center gap-2 py-1 text-xs text-gray-400 hover:text-gray-600 select-none"
            >
              <div className="flex-1 border-t border-gray-200" />
              <span className="whitespace-nowrap flex items-center gap-0.5">
                {othersExpanded
                  ? <ChevronDownIcon className="h-3 w-3" />
                  : <ChevronRightIcon className="h-3 w-3" />
                }
                其他人员 ({otherUsers.length})
              </span>
              <div className="flex-1 border-t border-gray-200" />
            </button>
            {othersExpanded && otherUsers.map(u => renderUser(u, false))}
          </>
        )}

        {/* 无置顶时也显示普通列表（不折叠） */}
        {pinnedUsers.length === 0 && otherUsers.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">暂无可用人员</p>
        )}
      </div>

      {/* 底部操作 */}
      {!disabled && users.length > 0 && (
        <div className="flex justify-between items-center px-2 py-1 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={() => onChange(users.map(u => u.open_id))}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            全选
          </button>
          <span className="text-xs text-gray-400">已选 {value.length} 人</span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-gray-500 hover:text-gray-800"
          >
            清空
          </button>
        </div>
      )}
    </div>
  );
};

export default FeishuMultiUserPicker;
