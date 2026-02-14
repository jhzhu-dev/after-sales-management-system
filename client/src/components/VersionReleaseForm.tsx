import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModuleType {
  id: number;
  name: string;
  code: string;
  description?: string;
}

interface VersionRelease {
  id: number;
  module_type_id: number;
  version_number: string;
  title: string;
  change_log?: string;
  release_date: string;
}

interface VersionReleaseFormProps {
  versionRelease?: VersionRelease | null;
  moduleType?: ModuleType | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

const VersionReleaseForm: React.FC<VersionReleaseFormProps> = ({ versionRelease, moduleType, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    module_type_id: 0,
    version_number: '',
    title: '',
    change_log: '',
    release_date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (versionRelease) {
      setFormData({
        module_type_id: versionRelease.module_type_id,
        version_number: versionRelease.version_number || '',
        title: versionRelease.title || '',
        change_log: versionRelease.change_log || '',
        release_date: versionRelease.release_date ? versionRelease.release_date.split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else if (moduleType) {
      setFormData(prev => ({
        ...prev,
        module_type_id: moduleType.id
      }));
    }
  }, [versionRelease, moduleType]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.module_type_id) {
      newErrors.module_type_id = '请选择模块类型';
    }
    
    if (!formData.version_number.trim()) {
      newErrors.version_number = '版本号不能为空';
    }
    
    if (!formData.title.trim()) {
      newErrors.title = '版本标题不能为空';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error: any) {
      console.error('提交失败:', error);
      if (error.response?.data?.error) {
        setErrors({ submit: error.response.data.error });
      } else {
        setErrors({ submit: '操作失败，请稍后重试' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 清除该字段的错误提示
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-800">
            {versionRelease ? '编辑版本' : '发布新版本'} - {moduleType?.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 版本号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              版本号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="version_number"
              value={formData.version_number}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                errors.version_number ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="例如: V1.2.0, 2024.01.15"
            />
            {errors.version_number && (
              <p className="mt-1 text-sm text-red-500">{errors.version_number}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              建议格式：主版本.次版本.修订版本 (如 V1.2.0) 或 年.月.日 (如 2024.01.15)
            </p>
          </div>

          {/* 版本标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              版本标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="例如: 优化视觉算法，提升识别率"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* 发布日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              发布日期
            </label>
            <input
              type="date"
              name="release_date"
              value={formData.release_date}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              默认为今天，可以选择历史日期
            </p>
          </div>

          {/* 变更日志 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              变更日志 (Change Log)
            </label>
            <textarea
              name="change_log"
              value={formData.change_log}
              onChange={handleInputChange}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="详细说明本次发布的改进内容，例如：

【新增功能】
- 新增自动校准功能
- 支持多点定位

【优化改进】
- 优化算法性能，提升30%速度
- 改进UI交互体验

【Bug修复】
- 修复在低光环境下的识别问题
- 修复内存泄漏问题"
            />
            <p className="mt-1 text-xs text-gray-500">
              建议按 新增功能、优化改进、Bug修复 分类描述
            </p>
          </div>

          {/* 错误提示 */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* 提示信息 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>提示：</strong>发布后的版本将在设备模块配置中可选，用于记录设备使用的具体模块版本。
            </p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? (versionRelease ? '更新中...' : '发布中...') : (versionRelease ? '保存修改' : '确认发布')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VersionReleaseForm;
