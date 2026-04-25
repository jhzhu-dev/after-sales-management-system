import React from 'react';
import { FeishuUser } from '../types';

interface FeishuUserPickerProps {
  users: FeishuUser[];
  value: string; // 当前选中的 open_id，空字符串表示未选
  onChange: (openId: string, name: string) => void;
  notifyChecked: boolean;
  onNotifyChange: (checked: boolean) => void;
  notifyLabel: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * 飞书用户选择器 + 通知勾选框
 * 三处表单（IssueForm / DeviceForm / UpgradeForm）共用
 * 若 users 为空则返回 null，父组件自行降级到原文本框
 */
const FeishuUserPicker: React.FC<FeishuUserPickerProps> = ({
  users,
  value,
  onChange,
  notifyChecked,
  onNotifyChange,
  notifyLabel,
  placeholder = '选择员工',
  disabled = false,
}) => {
  if (!users || users.length === 0) return null;

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const openId = e.target.value;
    if (!openId) {
      onChange('', '');
      onNotifyChange(false);
      return;
    }
    const user = users.find(u => u.open_id === openId);
    onChange(openId, user?.name || '');
    // 选择员工后自动勾选通知
    onNotifyChange(true);
  };

  return (
    <div className="space-y-2">
      {/* 员工下拉选择 */}
      <select
        value={value}
        onChange={handleSelect}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {users.map(u => (
          <option key={u.open_id} value={u.open_id}>
            {u.name}
            {u.department ? ` · ${u.department}` : ''}
          </option>
        ))}
      </select>

      {/* 通知勾选框 */}
      <label
        className={`flex items-center gap-2 cursor-pointer select-none ${!value ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <input
          type="checkbox"
          checked={notifyChecked && !!value}
          onChange={e => onNotifyChange(e.target.checked)}
          disabled={!value || disabled}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
        />
        <span className="text-sm text-gray-600 flex items-center gap-1">
          <svg className="h-4 w-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {notifyLabel}
        </span>
      </label>
    </div>
  );
};

export default FeishuUserPicker;
