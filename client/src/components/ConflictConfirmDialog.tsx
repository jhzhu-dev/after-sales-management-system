import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Conflict {
  product_id?: number;
  product_name?: string;
  module_type_id: number;
  module_type_name: string;
  conflicts?: Array<{
    module_type_id: number;
    module_type_name: string;
  }>;
}

interface ConflictConfirmDialogProps {
  isOpen: boolean;
  conflicts: Conflict[];
  onOverwrite: () => void;
  onSkip: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConflictConfirmDialog: React.FC<ConflictConfirmDialogProps> = ({
  isOpen,
  conflicts,
  onOverwrite,
  onSkip,
  onCancel,
  loading = false
}) => {
  if (!isOpen) return null;

  // 计算冲突总数
  const totalConflicts = conflicts.reduce((sum, c) => {
    return sum + (c.conflicts ? c.conflicts.length : 1);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center p-6 border-b border-gray-200">
          <div className="flex-shrink-0 h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <ExclamationTriangleIcon className="h-7 w-7 text-yellow-600" />
          </div>
          <div className="ml-4">
            <h3 className="text-xl font-bold text-gray-900">
              检测到配置冲突
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              共 {totalConflicts} 个模块配置存在冲突，请选择处理方式
            </p>
          </div>
        </div>
        
        {/* 冲突列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {conflicts.map((conflict, index) => (
              <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                {conflict.product_name && (
                  <div className="font-medium text-gray-900 mb-2">
                    产品: {conflict.product_name}
                  </div>
                )}
                {conflict.conflicts && conflict.conflicts.length > 0 ? (
                  <ul className="space-y-1">
                    {conflict.conflicts.map((c, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-center">
                        <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                        <span className="font-medium">{c.module_type_name}</span>
                        <span className="text-gray-500 text-xs ml-2">(ID: {c.module_type_id})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-700 flex items-center">
                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    <span className="font-medium">{conflict.module_type_name}</span>
                    <span className="text-gray-500 text-xs ml-2">(ID: {conflict.module_type_id})</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <button
              onClick={onOverwrite}
              disabled={loading}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  处理中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  覆盖现有配置
                </>
              )}
            </button>
            <button
              onClick={onSkip}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center"
            >
              {loading ? '处理中...' : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  跳过冲突项，仅添加新配置
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              取消操作
            </button>
          </div>
          
          {/* 说明文字 */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>覆盖：</strong>删除冲突的旧配置，使用新配置替换<br />
              <strong>跳过：</strong>保留冲突项的现有配置，仅添加不冲突的新配置<br />
              <strong>取消：</strong>放弃本次操作，不进行任何更改
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictConfirmDialog;
