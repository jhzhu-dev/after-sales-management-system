import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Issue, IssueFormData } from '../types';
import { deviceApi, moduleApi } from '../services/api';

interface IssueFormProps {
  issue?: Issue | null;
  onClose: () => void;
  onSubmit: (data: IssueFormData) => Promise<void>;
}

export default function IssueForm({ issue, onClose, onSubmit }: IssueFormProps) {
  const [formData, setFormData] = useState<IssueFormData>({
    device_id: '',
    module_id: undefined,
    description: '',
    severity: 'medium',
    status: 'open',
    assignee: '',
    notes: ''
  });
  const [devices, setDevices] = useState<Array<{id: string, name: string}>>([]);
  const [modules, setModules] = useState<Array<{id: string, name: string, device_id: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDevices();
    if (issue) {
      setFormData({
        device_id: issue.device_id || '',
        module_id: issue.module_id || undefined,
        description: issue.description || '',
        severity: issue.severity || 'medium',
        status: issue.status || 'open',
        assignee: issue.assignee || '',
        notes: issue.resolution_description || ''
      });
      if (issue.device_id) {
        fetchModules(issue.device_id);
      }
    }
  }, [issue]);

  const fetchDevices = async () => {
    try {
      const response = await deviceApi.getDevices({ limit: 1000 });
      if (response.success) {
        setDevices(response.data.map((device: any) => ({
          id: device.id,
          name: device.name
        })));
      }
    } catch (error) {
      console.error('获取设备列表失败:', error);
    }
  };

  const fetchModules = async (deviceId: string) => {
    try {
      console.log('正在获取设备ID为', deviceId, '的模块列表...');
      const response = await moduleApi.getModules({ device_id: deviceId, limit: 1000 });
      console.log('模块API响应:', response);
      if (response.success) {
        const moduleList = response.data.map((module: any) => ({
          id: module.id,
          name: module.module_type || module.name || `模块${module.id}`, // 使用module_type字段
          device_id: module.device_id
        }));
        console.log('处理后的模块列表:', moduleList);
        setModules(moduleList);
      } else {
        console.error('获取模块列表失败: 响应不成功');
      }
    } catch (error) {
      console.error('获取模块列表失败:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 清除相关错误
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // 如果选择设备，获取该设备的模块
    if (name === 'device_id') {
      setFormData(prev => ({ ...prev, module_id: undefined }));
      setModules([]);
      if (value) {
        fetchModules(value);
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.device_id.trim()) {
      newErrors.device_id = '请选择设备';
    }
    if (!formData.description.trim()) {
      newErrors.description = '请输入问题描述';
    }
    if (!formData.severity) {
      newErrors.severity = '请选择严重性';
    }
    if (!formData.status) {
      newErrors.status = '请选择状态';
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
      // 将notes字段映射到resolution_description
      const submitData = {
        ...formData,
        resolution_description: formData.notes,
        notes: undefined
      };
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {issue ? '编辑问题' : '新增问题'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 设备选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              设备 <span className="text-red-500">*</span>
            </label>
            <select
              name="device_id"
              value={formData.device_id}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.device_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">请选择设备</option>
              {devices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
            {errors.device_id && (
              <p className="mt-1 text-sm text-red-600">{errors.device_id}</p>
            )}
          </div>

          {/* 模块选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              模块
            </label>
            <select
              name="module_id"
              value={formData.module_id || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!formData.device_id}
            >
              <option value="">请选择模块（可选）</option>
              {modules.map(module => (
                <option key={module.id} value={module.id}>
                  {module.name}
                </option>
              ))}
            </select>
            {/* 调试信息 */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-1 text-xs text-gray-500">
                调试: 找到 {modules.length} 个模块
                {modules.length > 0 && (
                  <div>模块列表: {modules.map(m => m.name).join(', ')}</div>
                )}
              </div>
            )}
          </div>

          {/* 问题描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              问题描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请详细描述问题..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          {/* 严重性 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              严重性 <span className="text-red-500">*</span>
            </label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.severity ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
            {errors.severity && (
              <p className="mt-1 text-sm text-red-600">{errors.severity}</p>
            )}
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              状态 <span className="text-red-500">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.status ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="open">待处理</option>
              <option value="in_progress">处理中</option>
              <option value="closed">已解决</option>
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status}</p>
            )}
          </div>

          {/* 责任人 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              责任人
            </label>
            <input
              type="text"
              name="assignee"
              value={formData.assignee}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入责任人"
            />
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              备注
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入备注信息..."
            />
          </div>

          {/* 按钮 */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
