import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Module, ModuleFormData } from '../types';
import { moduleTypeApi } from '../services/api';

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
    status: '正常'
  });
  const [moduleTypes, setModuleTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchModuleTypes();
    if (module) {
      setFormData({
        device_id: module.device_id,
        type_id: module.type_id,
        status: module.status as '正常' | '异常' | '维护中'
      });
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
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模块类型 *
            </label>
            <select
              name="type_id"
              value={formData.type_id}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">请选择模块类型</option>
              {moduleTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态 *
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="正常">正常</option>
              <option value="异常">异常</option>
              <option value="维护中">维护中</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? '保存中...' : (module ? '更新' : '创建')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModuleForm;

