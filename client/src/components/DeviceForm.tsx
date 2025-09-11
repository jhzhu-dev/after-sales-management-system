import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Device, DeviceFormData } from '../types';

interface DeviceFormProps {
  device?: Device | null;
  onClose: () => void;
  onSubmit: (data: DeviceFormData) => Promise<void>;
}

const DeviceForm: React.FC<DeviceFormProps> = ({ device, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<DeviceFormData>({
    name: '',
    type_id: '',
    location: '',
    status: '正常',
    remote_code: '',
    password: ''
  });
  const [deviceTypes, setDeviceTypes] = useState<Array<{id: string, name: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDeviceTypes();
    if (device) {
      setFormData({
        id: device.id, // 编辑时保留ID
        name: device.name,
        type_id: device.type_id || '',
        location: device.location || '',
        status: device.status as '正常' | '异常' | '维护中',
        remote_code: device.remote_code || '',
        password: device.password || ''
      });
    }
  }, [device]);

  const fetchDeviceTypes = async () => {
    try {
      const response = await fetch('/api/device-types/active');
      const result = await response.json();
      if (result.success) {
        setDeviceTypes(result.data);
      }
    } catch (error) {
      console.error('获取设备类型失败:', error);
    }
  };

  const handleChange = (field: keyof DeviceFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '设备名称不能为空';
    }
    if (!formData.type_id || formData.type_id === '' || formData.type_id === 0) {
      newErrors.type_id = '请选择设备类型';
    }
    if (!formData.location.trim()) {
      newErrors.location = '位置不能为空';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      console.log('表单验证失败');
      return;
    }

    // 处理数据，新增时不包含id字段
    const processedData = {
      ...formData,
      remote_code: formData.remote_code?.trim() || '',
      password: formData.password?.trim() || ''
    };
    
    // 如果是新增设备（没有device参数），移除id字段
    if (!device) {
      delete processedData.id;
    }
    
    console.log('提交设备数据:', processedData);
    setLoading(true);
    try {
      await onSubmit(processedData);
      console.log('设备更新成功');
      onClose();
    } catch (error) {
      console.error('保存设备失败:', error);
      alert('保存设备失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {device ? '编辑设备' : '新增设备'}
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
              设备名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入设备名称"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              设备类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type_id}
              onChange={(e) => handleChange('type_id', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.type_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">请选择设备类型</option>
              {deviceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {errors.type_id && <p className="text-red-500 text-sm mt-1">{errors.type_id}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              位置 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.location ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入设备位置"
            />
            {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="正常">正常</option>
              <option value="异常">异常</option>
              <option value="维护中">维护中</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              远程码
            </label>
            <input
              type="text"
              value={formData.remote_code || ''}
              onChange={(e) => handleChange('remote_code', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入远程码"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={formData.password || ''}
              onChange={(e) => handleChange('password', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入密码"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
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
              {loading ? '保存中...' : (device ? '更新' : '创建')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceForm;
