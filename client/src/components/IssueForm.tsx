import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { XMarkIcon, PaperClipIcon, TrashIcon, ArrowUpTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Issue, IssueFormData, FeishuUser, IssueClassification } from '../types';
import { deviceApi, moduleApi, feishuApi, issueClassificationApi } from '../services/api';
import api from '../services/api';
import FeishuMultiUserPicker from './FeishuMultiUserPicker';
import Select from './Select';
import ButtonGroup from './ButtonGroup';
import IssueImportPanel from './IssueImportPanel';
import { getSeverityColor, getStatusColor } from '../utils';

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
  onImported?: () => void;
}

export default function IssueForm({ issue, onClose, onSubmit, onImported }: IssueFormProps) {
  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [formData, setFormData] = useState<IssueFormData>({
    device_id: '',
    module_id: undefined,
    custom_module_name: undefined,
    description: '',
    severity: 'medium',
    status: 'open',
    assignee: '',
    feedback_time: '',
    feedback_no: '',
    is_first_occurrence: false,
    region: '',
    occurrence_count: undefined,
    notes: ''
  });
  const [devices, setDevices] = useState<Array<{id: string, name: string, device_code: string, customer_name: string, product_name: string, remote_code: string, nickname: string}>>([]); 
  const [modules, setModules] = useState<Array<{id: string, name: string, device_id: string, feishu_user_open_id?: string | null}>>([])
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 飞书通知状态
  const [feishuUsers, setFeishuUsers] = useState<FeishuUser[]>([]);
  const [feishuEnabled, setFeishuEnabled] = useState(false);
  const [notifyModuleUsers, setNotifyModuleUsers] = useState(false);
  const [notifyOpenIds, setNotifyOpenIds] = useState<string[]>([]);
  const [pinnedOpenIds, setPinnedOpenIds] = useState<string[]>([]);

  // 问题分类
  const [classifications, setClassifications] = useState<IssueClassification[]>([]);

  // 设备模糊搜索状态
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<{id: string, name: string, device_code: string, customer_name: string, product_name: string, remote_code: string, nickname: string} | null>(null);
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
    // 加载问题分类列表
    issueClassificationApi.getAll().then(res => {
      if (res.success && res.data) setClassifications(res.data as IssueClassification[]);
    }).catch(() => {});
    // 加载飞书用户列表
    feishuApi.getUsers().then(res => {
      if (res.success && res.data && res.data.length > 0) {
        setFeishuUsers(res.data as FeishuUser[]);
        setFeishuEnabled(true);
      }
    }).catch(() => {});
    if (issue) {
      const hasCustomModule = !!(issue as any).custom_module_name && !issue.module_id;
      setFormData({
        device_id: issue.device_id || '',
        module_id: issue.module_id?.toString() || (hasCustomModule ? 'custom' : undefined),
        custom_module_name: (issue as any).custom_module_name || undefined,
        description: issue.description || '',
        severity: issue.severity || 'medium',
        status: issue.status || 'open',
        classification_id: issue.classification_id || undefined,
        assignee: issue.assignee || '',
        feedback_time: (issue as any).feedback_time || '',
        feedback_no: (issue as any).feedback_no || '',
        is_first_occurrence: !!(issue as any).is_first_occurrence,
        region: (issue as any).region || '',
        occurrence_count: (issue as any).occurrence_count ?? undefined,
        notes: issue.resolution_description || ''
      });
      // 编辑模式下不恢复飞书通知状态（每次创建才触发通知）
        setSelectedDevice({
          id: issue.device_id,
          name: issue.device_name || issue.device_id,
          device_code: (issue as any).device_code || '',
          customer_name: issue.customer_name || '',
          product_name: (issue as any).product_name || '',
          remote_code: (issue as any).remote_code || '',
          nickname: (issue as any).device_nickname || ''
        });
      if (issue.device_id) {
        fetchModules(issue.device_id);
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
          customer_name: device.customer_name || '',
          product_name: device.product_name || '',
          remote_code: device.remote_code || '',
          nickname: device.nickname || ''
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

  const handleDeviceSelect = (device: {id: string, name: string, device_code: string, customer_name: string, product_name: string, remote_code: string, nickname: string}) => {
    setSelectedDevice(device);
    setFormData(prev => ({ ...prev, device_id: device.id, module_id: undefined, custom_module_name: undefined }));
    setModules([]);
    setDeviceSearch('');
    setDeviceDropdownOpen(false);
    fetchModules(device.id);
    if (errors.device_id) setErrors(prev => ({ ...prev, device_id: '' }));
  };

  const handleDeviceClear = () => {
    setSelectedDevice(null);
    setFormData(prev => ({ ...prev, device_id: '', module_id: undefined, custom_module_name: undefined }));
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
          name: module.module_type || module.name || `模块${module.id}`,
          device_id: module.device_id,
          feishu_user_open_id: module.feishu_user_open_id || null
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
    
    if (name === 'module_id' && value !== 'custom') {
      setFormData(prev => ({ ...prev, module_id: value, custom_module_name: undefined }));
      // 切换模块时：移除旧模块置顶人，替换为新模块置顶人
      const mt = value ? modules.find(m => String(m.id) === value) : null;
      const newPinned = mt?.feishu_user_open_id ? [mt.feishu_user_open_id] : [];
      setPinnedOpenIds(newPinned);
      setNotifyOpenIds(prev => {
        // 先移除旧的置顶人，再加入新的置顶人
        let next = prev.filter(id => !pinnedOpenIds.includes(id));
        newPinned.forEach(id => { if (!next.includes(id)) next.push(id); });
        return next;
      });
    } else if (name === 'module_id' && value === 'custom') {
      setFormData(prev => ({ ...prev, module_id: value }));
      // 自定义模块：移除旧置顶人，不添加新置顶人
      setNotifyOpenIds(prev => prev.filter(id => !pinnedOpenIds.includes(id)));
      setPinnedOpenIds([]);
    } else {
      if (name === 'occurrence_count') {
        setFormData(prev => ({ ...prev, occurrence_count: value === '' ? undefined : Number(value) }));
      } else {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    }
    
    // 清除相关错误
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // 如果选择设备，获取该设备的模块
    if (name === 'device_id') {
      setFormData(prev => ({ ...prev, module_id: undefined, custom_module_name: undefined }));
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
      newErrors.severity = '请选择紧急程度';
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
        attachments: attachments.length > 0 ? attachments : undefined,
        // 如果是自定义模块，不向后端传module_id
        module_id: formData.module_id === 'custom' ? undefined : formData.module_id,
        custom_module_name: formData.module_id === 'custom' ? (formData.custom_module_name || undefined) : undefined,
        // 飞书多人通知
        notify_open_ids: feishuEnabled && notifyModuleUsers && notifyOpenIds.length > 0 ? notifyOpenIds : undefined,
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-50">
      <div className={`bg-popover rounded-2xl border border-border shadow-soft-lg w-full mx-4 ${mode === 'import' && !issue ? 'max-w-[1500px]' : 'max-w-2xl'} max-h-[88vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 3xl:p-6 border-b border-border gap-3">
          <h3 className="text-lg font-medium text-foreground">
            {issue ? '编辑问题' : '新增问题'}
          </h3>
          {!issue && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${mode === 'manual' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                手动登记
              </button>
              <button
                type="button"
                onClick={() => setMode('import')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${mode === 'import' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                导入反馈单
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {mode === 'import' && !issue ? (
          <div className="p-4 3xl:p-6">
            <IssueImportPanel
              onClose={onClose}
              onDone={() => { onImported?.(); onClose(); }}
            />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-4 3xl:p-6 space-y-3 3xl:space-y-4">
          {/* 设备搜索选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              设备 <span className="text-red-500">*</span>
            </label>
            <div ref={deviceSearchRef} className="relative">
              {/* 已选中设备显示 */}
              {selectedDevice ? (
                <div className={`flex items-center justify-between w-full px-3 py-2 border rounded-md bg-white ${
                  errors.device_id ? 'border-red-500' : 'border-gray-300'
                }`}>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">{selectedDevice.nickname || [selectedDevice.customer_name, selectedDevice.product_name].filter(Boolean).join(' · ') || selectedDevice.name}</span>
                    <span className="text-xs text-gray-500 truncate">
                      {[selectedDevice.name, selectedDevice.id, selectedDevice.remote_code].filter(Boolean).join(' · ')}
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
                    placeholder="搜索订单号、客户、序列号、远程码、简称..."
                    className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                  />
                  {deviceLoading && (
                    <svg className="animate-spin h-4 w-4 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                </div>
              )}

              {/* 下拉列表 */}
              {deviceDropdownOpen && !selectedDevice && (
                <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                  {devices.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      {deviceLoading ? '搜索中...' : '未找到匹配设备'}
                    </div>
                  ) : (
                    devices.map(device => (
                      <button
                        key={device.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); handleDeviceSelect(device); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted border-b border-border last:border-0 transition-colors"
                      >
                      <div className="text-sm font-medium text-foreground">{device.nickname || [device.customer_name, device.product_name].filter(Boolean).join(' · ') || device.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {[device.name, device.id, device.remote_code].filter(Boolean).join(' · ')}
                        </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              模块
            </label>
            <Select
              value={formData.module_id || ''}
              onChange={v => handleInputChange({ target: { name: 'module_id', value: v } } as any)}
              placeholder="请选择模块（可选）"
              options={[{ value: '', label: '请选择模块（可选）' }, ...modules.map(module => ({ value: module.id, label: module.name })), { value: 'custom', label: '其他（自定义）' }]}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              disabled={!formData.device_id}
            />
            {formData.module_id === 'custom' && (
              <input
                type="text"
                name="custom_module_name"
                value={formData.custom_module_name || ''}
                onChange={handleInputChange}
                placeholder="请输入自定义模块名称"
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            )}
            {/* 调试信息 */}
            {import.meta.env.DEV && (
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              问题描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请详细描述问题..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          {/* 紧急程度 / 状态 / 问题分类 / 登记人 —— 紧凑两列布局 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                紧急程度 <span className="text-red-500">*</span>
              </label>
              <ButtonGroup
                value={formData.severity}
                onChange={v => handleInputChange({ target: { name: 'severity', value: v } } as any)}
                options={[{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]}
                colorClass={getSeverityColor}
                error={!!errors.severity}
              />
              {errors.severity && <p className="mt-1 text-sm text-red-600">{errors.severity}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                状态 <span className="text-red-500">*</span>
              </label>
              <ButtonGroup
                value={formData.status}
                onChange={v => handleInputChange({ target: { name: 'status', value: v } } as any)}
                options={[{ value: 'open', label: '待处理' }, { value: 'in_progress', label: '处理中' }, { value: 'closed', label: '已解决' }]}
                colorClass={getStatusColor}
                error={!!errors.status}
              />
              {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status}</p>}
            </div>
            {classifications.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  问题分类
                </label>
                <Select
                  value={formData.classification_id ?? ''}
                  onChange={(v) => setFormData(prev => ({ ...prev, classification_id: v ? parseInt(v) : undefined }))}
                  placeholder="不设置"
                  options={[{ value: '', label: '不设置' }, ...classifications.map(c => ({ value: c.id, label: c.name }))]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                登记人
              </label>
              <input
                type="text"
                name="assignee"
                value={formData.assignee}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                placeholder="请输入登记人"
              />
            </div>
          </div>

          {/* 反馈信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">反馈时间</label>
              <input
                type="date"
                name="feedback_time"
                value={formData.feedback_time ? String(formData.feedback_time).slice(0, 10) : ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">反馈单号</label>
              <input
                type="text"
                name="feedback_no"
                value={formData.feedback_no}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                placeholder="请输入反馈单号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">区域</label>
              <Select
                value={formData.region || ''}
                onChange={v => setFormData(prev => ({ ...prev, region: v }))}
                placeholder="请选择区域"
                options={[
                  { value: '', label: '请选择区域' },
                  { value: '国内', label: '国内' },
                  { value: '国外', label: '国外' },
                ]}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">发生次数</label>
              <input
                type="number"
                name="occurrence_count"
                value={formData.occurrence_count ?? ''}
                onChange={handleInputChange}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                placeholder="请输入发生次数"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.is_first_occurrence}
                  onChange={e => setFormData(prev => ({ ...prev, is_first_occurrence: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40"
                />
                <span className="text-sm font-medium text-gray-700">是否首次发生</span>
              </label>
            </div>
          </div>

          {/* 通知模块处理人 */}
          {feishuEnabled && feishuUsers.length > 0 && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifyModuleUsers}
                  onChange={e => {
                    setNotifyModuleUsers(e.target.checked);
                    // 展开时若模块有关联负责人，自动预填
                    if (e.target.checked && notifyOpenIds.length === 0 && pinnedOpenIds.length > 0) {
                      setNotifyOpenIds(pinnedOpenIds);
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40"
                />
                <span className="text-sm font-medium text-gray-700">
                  通知相关人员处理
                  {pinnedOpenIds.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-primary-600">
                      （模块关联负责人将置顶）
                    </span>
                  )}
                </span>
              </label>
              {notifyModuleUsers && (
                <div className="mt-2">
                  <FeishuMultiUserPicker
                    users={feishuUsers}
                    pinnedOpenIds={pinnedOpenIds}
                    value={notifyOpenIds}
                    onChange={setNotifyOpenIds}
                  />
                </div>
              )}
            </div>
          )}

          {/* 附件上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <PaperClipIcon className="h-4 w-4" /> 附件
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary-400 transition-colors bg-gray-50 cursor-pointer"
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
                    const { data: result } = await api.post('/issues/upload-attachment', fd);
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
                      className="flex items-center gap-1.5 text-primary-700 hover:underline truncate max-w-[85%]"
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
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={loading}>{loading ? '保存中...' : '保存'}</Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
