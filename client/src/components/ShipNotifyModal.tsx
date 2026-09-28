import React, { useState } from 'react';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, TruckIcon } from '@heroicons/react/24/outline';
import { FeishuUser } from '../types';
import FeishuMultiUserPicker from './FeishuMultiUserPicker';

export interface ShipNotifyItem {
  /** 设备序列号 */
  id: string;
  /** 可选展示名（订单号/昵称等） */
  label?: string;
  /** 模块名 → 是否已填版本号 */
  modules: Array<{ name: string; versioned: boolean }>;
}

interface ShipNotifyModalProps {
  title: string;
  items: ShipNotifyItem[];
  feishuUsers: FeishuUser[];
  /** 由模块关联负责人自动置顶并默认勾选的用户 */
  pinnedOpenIds: string[];
  loading?: boolean;
  /** 点击确认发货；参数为最终勾选的通知人（全部版本齐全时为空数组） */
  onConfirm: (notifyOpenIds: string[]) => void;
  onClose: () => void;
}

/**
 * 发货确认弹窗：
 * - 展示各设备模块版本号填写完整度
 * - 版本不齐全时，可选择飞书通知同事填写版本号（默认勾选模块关联负责人）
 * - 确认后由父组件执行发货 + 推送
 */
const ShipNotifyModal: React.FC<ShipNotifyModalProps> = ({
  title,
  items,
  feishuUsers,
  pinnedOpenIds,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const [notifyOpenIds, setNotifyOpenIds] = useState<string[]>(pinnedOpenIds);

  const allComplete = items.every(it =>
    it.modules.length === 0 || it.modules.every(m => m.versioned)
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-popover rounded-2xl border border-border shadow-soft-lg max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TruckIcon className="h-5 w-5 text-orange-500" />
            {title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* 版本完整度 */}
          <div className="space-y-2">
            {items.map(it => {
              const total = it.modules.length;
              const done = it.modules.filter(m => m.versioned).length;
              const complete = total === 0 || done === total;
              return (
                <div key={it.id} className="border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {it.id}
                      {it.label ? <span className="text-muted-foreground ml-2 text-xs">{it.label}</span> : null}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      complete
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-orange-50 text-orange-700 border border-orange-200'
                    }`}>
                      {complete
                        ? <><CheckCircleIcon className="h-3.5 w-3.5" />{done}/{total}</>
                        : <><ExclamationTriangleIcon className="h-3.5 w-3.5" />{done}/{total} 未填齐</>}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {total === 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500 border border-gray-200">
                        无模块
                      </span>
                    )}
                    {it.modules.map(m => (
                      <span
                        key={m.name}
                        title={m.versioned ? '已填版本号' : '未填版本号'}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                          m.versioned
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-orange-50 text-orange-600 border border-orange-200'
                        }`}
                      >
                        {m.name}
                        {!m.versioned && ' ·未填'}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 飞书催办 */}
          {!allComplete && feishuUsers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                通知同事填写版本号（飞书）
                {pinnedOpenIds.length > 0 && (
                  <span className="ml-2 text-xs text-primary-600 font-normal">
                    {pinnedOpenIds.length} 位模块关联负责人已置顶
                  </span>
                )}
              </label>
              <FeishuMultiUserPicker
                users={feishuUsers}
                pinnedOpenIds={pinnedOpenIds}
                value={notifyOpenIds}
                onChange={setNotifyOpenIds}
              />
            </div>
          )}
          {allComplete && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4" />
              所有模块版本号已填写齐全，可直接发货。
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 px-5 py-4 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
          >
            取消
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirm(allComplete ? [] : notifyOpenIds.filter(Boolean))}
            className={`px-4 py-2 rounded-md text-white text-sm transition-colors ${
              loading ? 'bg-gray-400 cursor-wait' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {loading ? '发货中...' : '确认发货'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipNotifyModal;
