import React, { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, CogIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { formatDate } from '../utils';

// 设备类型接口
interface DeviceType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 模块类型接口
interface ModuleType {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 表单数据接口
interface DeviceTypeFormData {
  name: string;
  description: string;
  is_active: boolean;
}

interface ModuleTypeFormData {
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'device-types' | 'module-types'>('device-types');
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [moduleTypes, setModuleTypes] = useState<ModuleType[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 设备类型相关状态
  const [showDeviceTypeModal, setShowDeviceTypeModal] = useState(false);
  const [editingDeviceType, setEditingDeviceType] = useState<DeviceType | null>(null);
  const [deviceTypeForm, setDeviceTypeForm] = useState<DeviceTypeFormData>({
    name: '',
    description: '',
    is_active: true
  });
  
  // 模块类型相关状态
  const [showModuleTypeModal, setShowModuleTypeModal] = useState(false);
  const [editingModuleType, setEditingModuleType] = useState<ModuleType | null>(null);
  const [moduleTypeForm, setModuleTypeForm] = useState<ModuleTypeFormData>({
    name: '',
    code: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    if (activeTab === 'device-types') {
      fetchDeviceTypes();
    } else {
      fetchModuleTypes();
    }
  }, [activeTab]);

  const fetchDeviceTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/device-types');
      const result = await response.json();
      
      if (result.success) {
        setDeviceTypes(result.data);
      }
    } catch (error) {
      console.error('获取设备类型列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModuleTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/module-types');
      const result = await response.json();
      
      if (result.success) {
        setModuleTypes(result.data);
      }
    } catch (error) {
      console.error('获取模块类型列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 设备类型操作
  const handleCreateDeviceType = () => {
    setEditingDeviceType(null);
    setDeviceTypeForm({ name: '', description: '', is_active: true });
    setShowDeviceTypeModal(true);
  };

  const handleEditDeviceType = (deviceType: DeviceType) => {
    setEditingDeviceType(deviceType);
    setDeviceTypeForm({
      name: deviceType.name,
      description: deviceType.description,
      is_active: deviceType.is_active
    });
    setShowDeviceTypeModal(true);
  };

  const handleSaveDeviceType = async () => {
    try {
      const url = editingDeviceType 
        ? `/api/device-types/${editingDeviceType.id}`
        : '/api/device-types';
      
      const method = editingDeviceType ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceTypeForm)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(editingDeviceType ? '设备类型更新成功' : '设备类型创建成功');
        setShowDeviceTypeModal(false);
        fetchDeviceTypes();
      } else {
        alert(result.message || '操作失败');
      }
    } catch (error) {
      console.error('保存设备类型失败:', error);
      alert('操作失败');
    }
  };

  const handleDeleteDeviceType = async (id: number) => {
    if (!window.confirm('确定要删除这个设备类型吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/device-types/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      
      if (result.success) {
        alert('删除成功');
        fetchDeviceTypes();
      } else {
        alert(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除设备类型失败:', error);
      alert('删除失败');
    }
  };

  // 模块类型操作
  const handleCreateModuleType = () => {
    setEditingModuleType(null);
    setModuleTypeForm({ name: '', code: '', description: '', is_active: true });
    setShowModuleTypeModal(true);
  };

  const handleEditModuleType = (moduleType: ModuleType) => {
    setEditingModuleType(moduleType);
    setModuleTypeForm({
      name: moduleType.name,
      code: moduleType.code,
      description: moduleType.description,
      is_active: moduleType.is_active
    });
    setShowModuleTypeModal(true);
  };

  const handleSaveModuleType = async () => {
    try {
      const url = editingModuleType 
        ? `/api/module-types/${editingModuleType.id}`
        : '/api/module-types';
      
      const method = editingModuleType ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleTypeForm)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(editingModuleType ? '模块类型更新成功' : '模块类型创建成功');
        setShowModuleTypeModal(false);
        fetchModuleTypes();
      } else {
        alert(result.message || '操作失败');
      }
    } catch (error) {
      console.error('保存模块类型失败:', error);
      alert('操作失败');
    }
  };

  const handleDeleteModuleType = async (id: number) => {
    if (!window.confirm('确定要删除这个模块类型吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/module-types/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      
      if (result.success) {
        alert('删除成功');
        fetchModuleTypes();
      } else {
        alert(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除模块类型失败:', error);
      alert('删除失败');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center space-x-3">
          <CogIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">基础设置</h1>
        </div>

        {/* 标签页 */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('device-types')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'device-types'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              设备类型管理
            </button>
            <button
              onClick={() => setActiveTab('module-types')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'module-types'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              模块类型管理
            </button>
          </nav>
        </div>

        {/* 设备类型管理 */}
        {activeTab === 'device-types' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">设备类型管理</h2>
              <button
                onClick={handleCreateDeviceType}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                新增设备类型
              </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">加载中...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型名称</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">描述</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deviceTypes.map((deviceType) => (
                        <tr key={deviceType.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {deviceType.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {deviceType.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={deviceType.description}>
                            {deviceType.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(deviceType.created_at, 'yyyy-MM-dd')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditDeviceType(deviceType)}
                                className="text-blue-600 hover:text-blue-800"
                                title="编辑"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDeviceType(deviceType.id)}
                                className="text-red-600 hover:text-red-800"
                                title="删除"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 模块类型管理 */}
        {activeTab === 'module-types' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">模块类型管理</h2>
              <button
                onClick={handleCreateModuleType}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                新增模块类型
              </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">加载中...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型名称</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型代码</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">描述</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {moduleTypes.map((moduleType) => (
                        <tr key={moduleType.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {moduleType.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {moduleType.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded text-sm">
                              {moduleType.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={moduleType.description}>
                            {moduleType.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              moduleType.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {moduleType.is_active ? '启用' : '禁用'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(moduleType.created_at, 'yyyy-MM-dd')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditModuleType(moduleType)}
                                className="text-blue-600 hover:text-blue-800"
                                title="编辑"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteModuleType(moduleType.id)}
                                className="text-red-600 hover:text-red-800"
                                title="删除"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 设备类型编辑模态框 */}
        {showDeviceTypeModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingDeviceType ? '编辑设备类型' : '新增设备类型'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">类型名称 *</label>
                    <input
                      type="text"
                      value={deviceTypeForm.name}
                      onChange={(e) => setDeviceTypeForm({ ...deviceTypeForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入设备类型名称"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <textarea
                      value={deviceTypeForm.description}
                      onChange={(e) => setDeviceTypeForm({ ...deviceTypeForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="请输入设备类型描述"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowDeviceTypeModal(false)}
                    className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveDeviceType}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 模块类型编辑模态框 */}
        {showModuleTypeModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingModuleType ? '编辑模块类型' : '新增模块类型'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">类型名称 *</label>
                    <input
                      type="text"
                      value={moduleTypeForm.name}
                      onChange={(e) => setModuleTypeForm({ ...moduleTypeForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入模块类型名称"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">类型代码 *</label>
                    <input
                      type="text"
                      value={moduleTypeForm.code}
                      onChange={(e) => setModuleTypeForm({ ...moduleTypeForm, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入模块类型代码"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <textarea
                      value={moduleTypeForm.description}
                      onChange={(e) => setModuleTypeForm({ ...moduleTypeForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="请输入模块类型描述"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="moduleTypeActive"
                      checked={moduleTypeForm.is_active}
                      onChange={(e) => setModuleTypeForm({ ...moduleTypeForm, is_active: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="moduleTypeActive" className="ml-2 block text-sm text-gray-900">
                      启用
                    </label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowModuleTypeModal(false)}
                    className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveModuleType}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
