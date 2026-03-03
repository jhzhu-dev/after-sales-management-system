import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, PaperClipIcon, TrashIcon, ArrowUpTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Issue, IssueFormData } from '../types';
import { deviceApi, moduleApi } from '../services/api';

interface UploadedAttachment {
  name: string;
  url: string;
  ossPath: string;
  size: number;
}

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
  const [devices, setDevices] = useState<Array<{id: string, name: string, device_code: string, customer_name: string}>>([]);
  const [modules, setModules] = useState<Array<{id: string, name: string, device_id: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 设备模糊搜索状态
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<{id: string, name: string, device_code: string, customer_name: string} | null>(null);
  const deviceSearchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deviceSearchRef.current && !deviceSearchRef.current.contains(e.target as Node)) {
        setDeviceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchDevices('');
    if (issue) {
      setFormData({
        device_id: issue.device_id || '',
        module_id: issue.module_id?.toString() || undefined,
        description: issue.description || '',
        severity: issue.severity || 'medium',
        status: issue.status || 'open',
        assignee: issue.assignee || '',
        notes: issue.resolution_description || ''
      });
      if (issue.device_id) {
        fetchModules(issue.device_id);
        // 编辑时恢复已选设备显示
        setSelectedDevice({
          id: issue.device_id,
          name: issue.device_name || issue.device_id,
          device_code: (issue as any).device_code || '',
          customer_name: issue.customer_name || ''
        });
      }
      // 加载已有附件
      if ((issue as any).attachments) {
        try {
          const att = typeof (issue as any).attachments === 'string'
            ? JSON.parse((issue as any).attachments)
            : (issue as any).attachments;
          if (Array.isArray(att)) setAttachments(att);
        } catch (_) {}
      }
    }
  }, [issue]);

  const fetchDevices = useCallback(async (search: string) => {
    setDeviceLoading(true);
    try {
      const params: any = { limit: 30 };
      if (search) params.search = search;
      const response = await deviceApi.getDevices(params);
      if (response.success) {
        setDevices(response.data.map((device: any) => ({
          id: device.id,
          name: device.name,
          device_code: device.device_code || '',
          customer_name: device.customer_name || ''
        })));
      }
    } catch (error) {
      console.error('获取设备列表失败:', error);
    } finally {
      setDeviceLoading(false);
    }
  }, []);

  const handleDeviceSearchChange = (value: string) => {
    setDeviceSearch(value);
    setDeviceDropdownOpen(true);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchDevices(value);
    }, 300);
  };

  const handleDeviceSelect = (device: {id: string, name: string, device_code: string, customer_name: string}) => {
    setSelectedDevice(device);
    setFormData(prev => ({ ...prev, device_id: device.id, module_id: undefined }));
    setModules([]);
    setDeviceSearch('');
    setDeviceDropdownOpen(false);
    fetchModules(device.id);
    if (errors.device_id) setErrors(prev => ({ ...prev, device_id: '' }));
  };

  const handleDeviceClear = () => {
    setSelectedDevice(null);
    setFormData(prev => ({ ...prev, device_id: '', module_id: undefined }));
    setModules([]);
    setDeviceSearch('');
    setDevices([]);
    fetchDevices('');
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
      const submitData: any = {
        ...formData,
        resolution_description: formData.notes,
        notes: undefined,
        attachments: attachments.length > 0 ? attachments : undefined
      };
      // 当状态变为已解决时，自动记录处理时间
      if (formData.status === 'closed' && issue?.status !== 'closed') {
        submitData.resolved_at = new Date().toISOString();
      }
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
          {/* 设备搜索选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              设备 <span className="text-red-500">*</span>
            </label>
            <div ref={deviceSearchRef} className="relative">
              {/* 已选中设备显示 */}
              {selectedDevice ? (
                <div className={`flex items-center justify-between w-full px-3 py-2 border rounded-md bg-white ${
                  errors.device_id ? 'border-red-500' : 'border-gray-300'
                }`}>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">{selectedDevice.name}</span>
                    <span className="text-xs text-gray-500 truncate">
                      {[selectedDevice.device_code, selectedDevice.customer_name].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeviceClear}
                    className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                /* 搜索输入框 */
                <div className={`flex items-center w-full px-3 py-2 border rounded-md focus-within:ring-2 focus-within:ring-blue-500 bg-white ${
                  errors.device_id ? 'border-red-500' : 'border-gray-300'
                }`}>
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 flex-shrink-0 mr-2" />
                  <input
                    type="text"
                    value={deviceSearch}
                    onChange={e => handleDeviceSearchChange(e.target.value)}
                    onFocus={() => { setDeviceDropdownOpen(true); if (!deviceSearch) fetchDevices(''); }}
                    placeholder="搜索设备名称、客户、序列号..."
                    className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                  />
                  {deviceLoading && (
                    <svg className="animate-spin h-4 w-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                </div>
              )}

              {/* 下拉列表 */}
              {deviceDropdownOpen && !selectedDevice && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {devices.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      {deviceLoading ? '搜索中...' : '未找到匹配设备'}
                    </div>
                  ) : (
                    devices.map(device => (
                      <button
                        key={device.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); handleDeviceSelect(device); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{device.name}</div>
                        {(device.device_code || device.customer_name) && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {[device.device_code, device.customer_name].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
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

          {/* 登记人 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              登记人
            </label>
            <input
              type="text"
              name="assignee"
              value={formData.assignee}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入登记人"
            />
          </div>

          {/* 附件上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <PaperClipIcon className="h-4 w-4" /> 附件
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors bg-gray-50 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  e.target.value = '';
                  setUploadingCount(c => c + files.length);
                  try {
                    const fd = new FormData();
                    files.forEach(f => fd.append('files', f));
                    if (formData.device_id) fd.append('device_id', formData.device_id);
                    const selModule = modules.find(m => String(m.id) === String(formData.module_id));
                    if (selModule) fd.append('module_name', selModule.name);
                    const resp = await fetch('/api/issues/upload-attachment', { method: 'POST', body: fd });
                    const result = await resp.json();
                    if (result.success) {
                      setAttachments(prev => [...prev, ...result.data]);
                    } else {
                      alert('上传失败: ' + (result.error || '未知错误'));
                    }
                  } catch (err) {
                    alert('上传失败，请检查网络连接');
                  } finally {
                    setUploadingCount(c => c - files.length);
                  }
                }}
              />
              <ArrowUpTrayIcon className="h-7 w-7 text-gray-400 mx-auto mb-1.5" />
              <p className="text-sm text-gray-500">
                {uploadingCount > 0
                  ? `上传中... (${uploadingCount} 个文件)`
                  : '点击选择文件，支持图片、PDF、文档等，单文件最大 50MB'}
              </p>
            </div>
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {attachments.map((att, i) => (
                  <li key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-md px-3 py-1.5 text-sm">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-700 hover:underline truncate max-w-[85%]"
                      onClick={e => e.stopPropagation()}
                    >
                      <PaperClipIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{att.name}</span>
                      <span className="text-gray-400 text-xs ml-1 flex-shrink-0">({(att.size / 1024).toFixed(0)} KB)</span>
                    </a>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAttachments(prev => prev.filter((_, j) => j !== i)); }}
                      className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
