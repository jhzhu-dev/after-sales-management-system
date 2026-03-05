import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CogIcon,
  ClipboardDocumentCheckIcon,
  XMarkIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { formatDate } from '../utils';
import { moduleTypeApi, customerApi } from '../services/api';
import { ModuleType, Customer } from '../types';

// 表单数据接口
interface ModuleTypeFormData {
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'module-types' | 'customers'>('module-types');
  const [moduleTypes, setModuleTypes] = useState<ModuleType[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 模块类型相关状态
  const [showModuleTypeModal, setShowModuleTypeModal] = useState(false);
  const [editingModuleType, setEditingModuleType] = useState<ModuleType | null>(null);
  const [moduleTypeForm, setModuleTypeForm] = useState<ModuleTypeFormData>({
    name: '',
    code: '',
    description: '',
    is_active: true
  });

  // 客户管理相关状态
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', short_name: '' });
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'module-types') {
      fetchModuleTypes();
    }
    if (activeTab === 'customers') {
      fetchCustomersList();
    }
  }, [activeTab]);

  const fetchModuleTypes = async () => {
    try {
      setLoading(true);
      const response = await moduleTypeApi.getModuleTypes();
      if (response.success) {
        setModuleTypes(response.data);
      }
    } catch (error) {
      console.error('获取模块类型列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (moduleType?: ModuleType) => {
    if (moduleType) {
      setEditingModuleType(moduleType);
      setModuleTypeForm({
        name: moduleType.name,
        code: moduleType.code,
        description: moduleType.description || '',
        is_active: moduleType.is_active
      });
    } else {
      setEditingModuleType(null);
      setModuleTypeForm({
        name: '',
        code: '',
        description: '',
        is_active: true
      });
    }
    setShowModuleTypeModal(true);
  };

  const handleCloseModal = () => {
    setShowModuleTypeModal(false);
    setEditingModuleType(null);
    setModuleTypeForm({
      name: '',
      code: '',
      description: '',
      is_active: true
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!moduleTypeForm.name.trim() || !moduleTypeForm.code.trim()) {
      alert('名称和代码为必填项');
      return;
    }

    setSubmitting(true);
    try {
      if (editingModuleType) {
        // 更新
        await moduleTypeApi.updateModuleType(editingModuleType.id, moduleTypeForm);
        alert('模块类型更新成功');
      } else {
        // 创建
        await moduleTypeApi.createModuleType(moduleTypeForm);
        alert('模块类型创建成功');
      }
      handleCloseModal();
      fetchModuleTypes();
    } catch (error: any) {
      console.error('操作失败:', error);
      alert(error.response?.data?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (moduleType: ModuleType) => {
    if (!window.confirm(`确定要删除模块类型"${moduleType.name}"吗？`)) {
      return;
    }

    try {
      await moduleTypeApi.deleteModuleType(moduleType.id);
      alert('模块类型删除成功');
      fetchModuleTypes();
    } catch (error: any) {
      console.error('删除失败:', error);
      const errorData = error.response?.data;
      if (errorData?.usage) {
        const { device_modules, product_configs, history_records } = errorData.usage;
        const messages = [];
        if (device_modules > 0) messages.push(`${device_modules} 个设备模块`);
        if (product_configs > 0) messages.push(`${product_configs} 个产品配置`);
        if (history_records > 0) messages.push(`${history_records} 条历史记录`);
        alert(`无法删除：该模块类型被以下内容使用：\n- ${messages.join('\n- ')}\n\n请先删除相关引用后再试。`);
      } else {
        alert(errorData?.message || '删除失败');
      }
    }
  };

  // ===== 客户管理逻辑 =====
  const fetchCustomersList = async () => {
    try {
      setLoading(true);
      const response = await customerApi.getCustomers();
      if (response.success) {
        setCustomersList(response.data);
      }
    } catch (error) {
      console.error('获取客户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({ name: customer.name, short_name: customer.short_name });
    } else {
      setEditingCustomer(null);
      setCustomerForm({ name: '', short_name: '' });
    }
    setShowCustomerModal(true);
  };

  const handleCloseCustomerModal = () => {
    setShowCustomerModal(false);
    setEditingCustomer(null);
    setCustomerForm({ name: '', short_name: '' });
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim() || !customerForm.short_name.trim()) {
      alert('客户名称和简称为必填项');
      return;
    }
    setSubmitting(true);
    try {
      if (editingCustomer) {
        await customerApi.updateCustomer(editingCustomer.id, customerForm);
        alert('客户更新成功');
      } else {
        await customerApi.createCustomer(customerForm);
        alert('客户创建成功');
      }
      handleCloseCustomerModal();
      fetchCustomersList();
    } catch (error: any) {
      console.error('操作失败:', error);
      alert(error.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!window.confirm(`确定要删除客户"${customer.name}"吗？`)) {
      return;
    }
    try {
      await customerApi.deleteCustomer(customer.id);
      alert('客户删除成功');
      fetchCustomersList();
    } catch (error: any) {
      console.error('删除失败:', error);
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const filteredCustomersList = customersList.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.short_name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-4 3xl:space-y-6">
        <div className="flex items-center space-x-3">
          <CogIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl 3xl:text-2xl font-bold text-gray-900">基础设置</h1>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button onClick={() => setActiveTab('module-types')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'module-types' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>模块类型管理</button>
            <button onClick={() => setActiveTab('customers')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'customers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>客户管理</button>
          </nav>
        </div>

        {activeTab === 'module-types' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">模块类型列表</h2>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5" />
                新增模块类型
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : moduleTypes.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">暂无模块类型</p>
                <p className="text-sm text-gray-400 mt-2">点击"新增模块类型"按钮添加</p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">代码</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">描述</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {moduleTypes.map((moduleType) => (
                      <tr key={moduleType.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{moduleType.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{moduleType.code}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{moduleType.description || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            moduleType.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {moduleType.is_active ? '启用' : '停用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(moduleType.created_at).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          <button
                            onClick={() => handleOpenModal(moduleType)}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                          >
                            <PencilIcon className="h-4 w-4 mr-1" />
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(moduleType)}
                            className="text-red-600 hover:text-red-900 inline-flex items-center"
                          >
                            <TrashIcon className="h-4 w-4 mr-1" />
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 模块类型表单对话框 */}
            {showModuleTypeModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-4 3xl:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {editingModuleType ? '编辑模块类型' : '新增模块类型'}
                    </h3>
                    <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 名称 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        名称 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={moduleTypeForm.name}
                        onChange={(e) => setModuleTypeForm({ ...moduleTypeForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例如：机械"
                      />
                    </div>

                    {/* 代码 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        代码 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={moduleTypeForm.code}
                        onChange={(e) => setModuleTypeForm({ ...moduleTypeForm, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例如：mechanical"
                      />
                    </div>

                    {/* 描述 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        描述
                      </label>
                      <textarea
                        value={moduleTypeForm.description}
                        onChange={(e) => setModuleTypeForm({ ...moduleTypeForm, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="描述此模块类型..."
                      />
                    </div>

                    {/* 启用状态 */}
                    <div>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={moduleTypeForm.is_active}
                          onChange={(e) => setModuleTypeForm({ ...moduleTypeForm, is_active: e.target.checked })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">启用此模块类型</span>
                      </label>
                    </div>

                    {/* 按钮 */}
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        disabled={submitting}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? '提交中...' : editingModuleType ? '更新' : '创建'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'customers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">客户列表</h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="搜索客户..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleOpenCustomerModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5" />
                  新增客户
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredCustomersList.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">暂无客户</p>
                <p className="text-sm text-gray-400 mt-2">点击"新增客户"按钮添加</p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">简称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomersList.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{customer.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.short_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.created_at ? new Date(customer.created_at).toLocaleDateString('zh-CN') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          <button
                            onClick={() => handleOpenCustomerModal(customer)}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                          >
                            <PencilIcon className="h-4 w-4 mr-1" />
                            编辑
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer)}
                            className="text-red-600 hover:text-red-900 inline-flex items-center"
                          >
                            <TrashIcon className="h-4 w-4 mr-1" />
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 客户表单对话框 */}
            {showCustomerModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-4 3xl:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {editingCustomer ? '编辑客户' : '新增客户'}
                    </h3>
                    <button onClick={handleCloseCustomerModal} className="text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <form onSubmit={handleCustomerSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        客户名称 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例如：某某科技有限公司"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        英文简称 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={customerForm.short_name}
                        onChange={(e) => setCustomerForm({ ...customerForm, short_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例如：ABC Tech"
                      />
                      <p className="text-xs text-gray-400 mt-1">英文简称需唯一，用于快速识别</p>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        type="button"
                        onClick={handleCloseCustomerModal}
                        disabled={submitting}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? '提交中...' : editingCustomer ? '更新' : '创建'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
