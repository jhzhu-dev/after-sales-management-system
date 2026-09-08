import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Module, ModuleFormData } from '../types';
import api, { moduleTypeApi } from '../services/api';
import { Button } from '../components/ui/button';
import Select from './Select';

interface ModuleFormProps {
  module?: Module | null;
  deviceId: string;
  onClose: () => void;
  onSubmit: (data: ModuleFormData) => Promise<void>;
}

const ModuleForm: React.FC<ModuleFormProps> = ({ module, deviceId, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<ModuleFormData>({
    device_id: deviceId,
    type_id: '',
    version_id: '',
    status: '正常'
  });
  const [moduleTypes, setModuleTypes] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchModuleTypes();
    if (module) {
      setFormData({
        device_id: module.device_id,
        type_id: module.type_id.toString(),
        version_id: '',
        status: '正常'
      });
      if (module.type_id) {
        fetchVersions(module.type_id.toString());
      }
    }
  }, [module, deviceId]);

  const fetchModuleTypes = async () => {
    try {
      const response = await moduleTypeApi.getModuleTypes();
      if (response.success) {
        setModuleTypes(response.data);
      }
    } catch (error) {
      console.error('获取模块类型失败:', error);
    }
  };

  const fetchVersions = async (moduleTypeId: string) => {
    if (!moduleTypeId) {
      setVersions([]);
      return;
    }
    setLoadingVersions(true);
    try {
      const response = await api.get(`/version-releases?module_type_id=${moduleTypeId}`);
      if (response.data.success) {
        setVersions(response.data.data || []);
      }
    } catch (error) {
      console.error('获取版本列表失败:', error);
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 当模块类型改变时，重新加载版本列表并清空已选版本
    if (name === 'type_id') {
      setFormData(prev => ({ ...prev, version_id: '' }));
      fetchVersions(value);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 3xl:p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {module ? '编辑模块' : '添加模块'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 3xl:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模块类型 *
            </label>
            <Select
              value={formData.type_id}
              onChange={v => handleInputChange({ target: { name: 'type_id', value: v } } as any)}
              placeholder="请选择模块类型"
              options={[{ value: '', label: '请选择模块类型' }, ...moduleTypes.map((type) => ({ value: type.id, label: type.name }))]}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              初始版本
            </label>
            <Select
              value={formData.version_id || ''}
              onChange={v => handleInputChange({ target: { name: 'version_id', value: v } } as any)}
              placeholder={loadingVersions ? '加载中...' : '请选择版本（可选）'}
              options={[{ value: '', label: loadingVersions ? '加载中...' : '请选择版本（可选）' }, ...versions.map((version) => ({ value: version.id, label: `${version.version_number} - ${version.title || ''}` }))]}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={!formData.type_id || loadingVersions}
            />
            {!formData.type_id && (
              <p className="mt-1 text-xs text-gray-500">请先选择模块类型</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态 *
            </label>
            <Select
              value={formData.status}
              onChange={v => handleInputChange({ target: { name: 'status', value: v } } as any)}
              options={[{ value: '正常', label: '正常' }, { value: '异常', label: '异常' }, { value: '维护中', label: '维护中' }]}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={loading}>{loading ? '保存中...' : (module ? '更新' : '创建')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModuleForm;

