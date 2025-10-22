import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  PencilIcon, 
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { Device, Module, Submodule, Issue, ModuleFormData, SubmoduleFormData, DeviceFormData } from '../types';
import { deviceApi, moduleApi, submoduleApi, issueApi, submoduleVersionApi } from '../services/api';
import Layout from '../components/Layout';
import ModuleForm from '../components/ModuleForm';
import SubmoduleForm from '../components/SubmoduleForm';
import DeviceForm from '../components/DeviceForm';

const DeviceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [device, setDevice] = useState<Device | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [submodules, setSubmodules] = useState<Submodule[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'modules' | 'submodules' | 'versions' | 'issues'>('modules');
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [showSubmoduleForm, setShowSubmoduleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingSubmodule, setEditingSubmodule] = useState<Submodule | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showVersionUpdateForm, setShowVersionUpdateForm] = useState(false);
  const [selectedSubmoduleForVersion, setSelectedSubmoduleForVersion] = useState<Submodule | null>(null);
  const [submoduleVersions, setSubmoduleVersions] = useState<any[]>([]);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [selectedIssueForResolve, setSelectedIssueForResolve] = useState<Issue | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // 获取设备详情
  const fetchDevice = async () => {
    if (!id) return;
    try {
      console.log('获取设备详情，ID:', id, '类型:', typeof id);
      const response = await deviceApi.getDevice(id);
      if (response.success) {
        console.log('设备数据:', response.data);
        setDevice(response.data);
      } else {
        // 如果设备不存在，跳转到设备列表页
        console.log('设备不存在，跳转到设备列表页');
        navigate('/devices');
      }
    } catch (error) {
      console.error('获取设备详情失败:', error);
      // 如果是404错误，跳转到设备列表页
      if (error instanceof Error && error.message.includes('404')) {
        navigate('/devices');
      }
    }
  };

  // 获取设备模块
  const fetchModules = async () => {
    if (!id) return;
    try {
      const response = await moduleApi.getModules({ device_id: id, limit: 1000 });
      if (response.success) {
        setModules(response.data);
      }
    } catch (error) {
      console.error('获取设备模块失败:', error);
    }
  };

  // 获取设备子模块
  const fetchSubmodules = async () => {
    if (!id) return;
    try {
      // 获取所有模块的子模块
      const allSubmodules: Submodule[] = [];
      for (const module of modules) {
        const response = await submoduleApi.getSubmodulesByModule(module.id);
        if (response.success) {
          allSubmodules.push(...response.data);
        }
      }
      // 根据ID去重，避免重复显示
      const uniqueSubmodules = allSubmodules.filter((submodule, index, self) => 
        index === self.findIndex(s => s.id === submodule.id)
      );
      setSubmodules(uniqueSubmodules);
    } catch (error) {
      console.error('获取设备子模块失败:', error);
    }
  };


  // 获取设备问题
  const fetchIssues = async () => {
    if (!id) return;
    try {
      const response = await issueApi.getIssues({ device_id: id, limit: 1000 });
      if (response.success) {
        setIssues(response.data);
      }
    } catch (error) {
      console.error('获取设备问题失败:', error);
    }
  };

  // 获取子模块版本历史
  const fetchSubmoduleVersions = async (submoduleId?: string) => {
    try {
      const response = await submoduleVersionApi.getSubmoduleVersions();
      if (response.success) {
        let filteredVersions = response.data;
        if (submoduleId) {
          filteredVersions = response.data.filter((version: any) => version.submodule_id === submoduleId);
        }
        setSubmoduleVersions(filteredVersions);
      }
    } catch (error) {
      console.error('获取子模块版本历史失败:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchDevice();
      await fetchModules();
      setLoading(false);
    };
    loadData();
  }, [id]);

  useEffect(() => {
    if (modules.length > 0) {
      fetchSubmodules();
    }
  }, [modules]);


  useEffect(() => {
    if (id) {
      fetchIssues();
    }
  }, [id]);

  // 筛选子模块
  const filteredSubmodules = selectedModuleId 
    ? submodules.filter(sub => sub.module_id === selectedModuleId)
    : submodules;


  // 模块CRUD处理函数
  const handleEditModule = (module: Module) => {
    setEditingModule(module);
    setShowModuleForm(true);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (window.confirm('确定要删除这个模块吗？这将同时删除该模块下的所有子模块。')) {
      try {
        await moduleApi.deleteModule(moduleId);
        await fetchModules();
        await fetchSubmodules();
      } catch (error) {
        console.error('删除模块失败:', error);
        alert('删除模块失败');
      }
    }
  };

  // 子模块CRUD处理函数
  const handleEditSubmodule = (submodule: Submodule) => {
    setEditingSubmodule(submodule);
    setShowSubmoduleForm(true);
  };

  const handleDeleteSubmodule = async (submoduleId: string) => {
    if (window.confirm('确定要删除这个子模块吗？')) {
      try {
        await submoduleApi.deleteSubmodule(submoduleId);
        await fetchSubmodules();
      } catch (error) {
        console.error('删除子模块失败:', error);
        alert('删除子模块失败');
      }
    }
  };


  // 模块表单提交处理
  const handleModuleSubmit = async (data: ModuleFormData) => {
    try {
      if (editingModule) {
        await moduleApi.updateModule(editingModule.id, data);
      } else {
        await moduleApi.createModule(data);
      }
      await fetchModules();
      setShowModuleForm(false);
      setEditingModule(null);
    } catch (error) {
      console.error('保存模块失败:', error);
      throw error;
    }
  };

  // 子模块表单提交处理
  const handleSubmoduleSubmit = async (data: SubmoduleFormData) => {
    try {
      if (editingSubmodule) {
        // 如果当前版本发生变化，记录版本历史
        if (data.current_version !== editingSubmodule.current_version) {
          await recordVersionChange(editingSubmodule.id, editingSubmodule.current_version || '', data.current_version || '');
        }
        await submoduleApi.updateSubmodule(editingSubmodule.id, data);
      } else {
        await submoduleApi.createSubmodule(data);
      }
      await fetchSubmodules();
      setShowSubmoduleForm(false);
      setEditingSubmodule(null);
    } catch (error) {
      console.error('保存子模块失败:', error);
      throw error;
    }
  };

  // 记录版本变更
  const recordVersionChange = async (submoduleId: string, oldVersion: string, newVersion: string, versionDescription?: string) => {
    try {
      // 构建描述信息
      let description = `版本从 ${oldVersion} 更新到 ${newVersion}`;
      if (versionDescription && versionDescription.trim()) {
        description += `\n更新说明: ${versionDescription.trim()}`;
      }
      
      await submoduleVersionApi.createSubmoduleVersion({
        submodule_id: submoduleId,
        version_number: newVersion,
        version_type: 'update',
        release_date: new Date().toISOString().split('T')[0], // 只取日期部分 YYYY-MM-DD
        updated_by: '当前用户', // 这里可以从用户上下文获取
        description: description
      });
    } catch (error) {
      console.error('记录版本变更失败:', error);
    }
  };

  // 显示版本历史
  const handleShowVersionHistory = async (submodule: Submodule) => {
    setSelectedSubmoduleForVersion(submodule);
    await fetchSubmoduleVersions(submodule.id);
    setShowVersionHistory(true);
  };

  // 修改当前版本
  const handleUpdateCurrentVersion = (submodule: Submodule) => {
    setSelectedSubmoduleForVersion(submodule);
    setShowVersionUpdateForm(true);
  };

  // 版本更新提交
  const handleVersionUpdateSubmit = async (newVersion: string, versionDescription?: string) => {
    if (!selectedSubmoduleForVersion) return;
    
    try {
      const oldVersion = selectedSubmoduleForVersion.current_version;
      
      // 更新子模块的当前版本
      await submoduleApi.updateSubmodule(selectedSubmoduleForVersion.id, {
        ...selectedSubmoduleForVersion,
        current_version: newVersion
      });
      
      // 记录版本变更
      await recordVersionChange(selectedSubmoduleForVersion.id, oldVersion || '', newVersion, versionDescription);
      
      // 刷新数据
      await fetchSubmodules();
      await fetchSubmoduleVersions(selectedSubmoduleForVersion.id);
      
      setShowVersionUpdateForm(false);
      setSelectedSubmoduleForVersion(null);
    } catch (error) {
      console.error('更新版本失败:', error);
      alert('更新版本失败');
    }
  };

  // 关闭表单处理
  const handleCloseModuleForm = () => {
    setShowModuleForm(false);
    setEditingModule(null);
  };

  const handleCloseSubmoduleForm = () => {
    setShowSubmoduleForm(false);
    setEditingSubmodule(null);
  };



  // 问题处理函数
  const handleAddIssue = () => {
    setShowIssueForm(true);
  };

  const handleResolveIssue = (issue: Issue) => {
    setSelectedIssueForResolve(issue);
    setShowResolveForm(true);
  };

  const handleIssueSubmit = async (data: any) => {
    try {
      await issueApi.createIssue({
        ...data,
        device_id: id
      });
      await fetchIssues();
      setShowIssueForm(false);
    } catch (error) {
      console.error('创建问题失败:', error);
      throw error;
    }
  };

  const handleResolveSubmit = async (resolutionDescription: string) => {
    if (!selectedIssueForResolve) return;
    
    try {
      await issueApi.updateIssue(selectedIssueForResolve.id, {
        status: 'closed',
        resolution_description: resolutionDescription,
        resolved_at: new Date().toISOString()
      });
      await fetchIssues();
      setShowResolveForm(false);
      setSelectedIssueForResolve(null);
    } catch (error) {
      console.error('解决问题失败:', error);
      alert('解决问题失败');
    }
  };

  const handleCloseIssueForm = () => {
    setShowIssueForm(false);
  };

  const handleCloseResolveForm = () => {
    setShowResolveForm(false);
    setSelectedIssueForResolve(null);
  };

  // 设备编辑处理函数
  const handleEditDevice = () => {
    setShowDeviceForm(true);
  };

  const handleDeviceSubmit = async (data: DeviceFormData) => {
    try {
      console.log('开始更新设备:', id, data);
      const response = await deviceApi.updateDevice(id!, data);
      console.log('设备更新响应:', response);
      await fetchDevice();
      setShowDeviceForm(false);
      console.log('设备更新完成');
    } catch (error) {
      console.error('更新设备失败:', error);
      throw error;
    }
  };

  const handleCloseDeviceForm = () => {
    setShowDeviceForm(false);
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case '正常': return 'bg-green-100 text-green-800';
      case '异常': return 'bg-red-100 text-red-800';
      case '维护中': return 'bg-yellow-100 text-yellow-800';
      case 'open': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case '正常':
      case 'closed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case '异常':
      case 'open':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case '维护中':
      case 'in_progress':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">加载中...</div>
        </div>
      </Layout>
    );
  }

  if (!device) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-red-600">设备不存在</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/devices')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              返回设备列表
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{device.name}</h1>
              <p className="text-gray-600 mt-1">设备详情信息</p>
            </div>
          </div>
          <button
            onClick={handleEditDevice}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            <PencilIcon className="h-4 w-4" />
            编辑设备
          </button>
        </div>

        {/* 设备基本信息 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备编号</label>
              <p className="text-lg font-mono">{device.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备类型</label>
              <p className="text-lg">{device.device_type}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
              <p className="text-lg">{device.location}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <div className="flex items-center space-x-2">
                {getStatusIcon(device.status)}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(device.status)}`}>
                  {device.status}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">远程码</label>
              <p className="text-lg font-mono text-blue-600">{device.remote_code || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <div className="flex items-center space-x-2">
                <p className="text-lg font-mono text-gray-600">
                  {device.password ? (showPassword ? device.password : '••••••••') : '-'}
                </p>
                {device.password && (
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    title={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">创建时间</label>
              <p className="text-lg">{new Date(device.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">更新时间</label>
              <p className="text-lg">{new Date(device.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">M</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">模块数量</p>
                <p className="text-2xl font-semibold text-gray-900">{modules.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <span className="text-green-600 font-semibold">S</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">子模块数量</p>
                <p className="text-2xl font-semibold text-gray-900">{submodules.length}</p>
              </div>
            </div>
          </div>
          
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">问题数量</p>
                <p className="text-2xl font-semibold text-gray-900">{issues.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { key: 'modules', label: '模块信息', count: modules.length },
                { key: 'submodules', label: '子模块信息', count: submodules.length },
                { key: 'issues', label: '问题信息', count: issues.length }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                    activeTab === tab.key
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* 模块信息标签页 */}
            {activeTab === 'modules' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">模块列表</h3>
                  <button 
                    onClick={() => setShowModuleForm(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    添加模块
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modules.map((module) => (
                    <div key={module.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{module.module_type}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(module.status)}`}>
                            {module.status}
                          </span>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEditModule(module)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="编辑模块"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteModule(module.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="删除模块"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">创建时间: {new Date(module.created_at).toLocaleDateString()}</p>
                      <div className="space-y-2">
                        <div className="text-sm text-gray-500">
                          {submodules.filter(sub => sub.module_id === module.id).length > 0 ? (
                            <div className="space-y-1">
                              {submodules.filter(sub => sub.module_id === module.id).map((submodule) => (
                                <div key={submodule.id} className="flex justify-between items-center">
                                  <span className="text-gray-700">{submodule.name}</span>
                                  <span className="text-blue-600 font-mono text-xs">{submodule.current_version || '-'}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>暂无子模块</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">
                            {submodules.filter(sub => sub.module_id === module.id).length} 个子模块
                          </span>
                          <button
                            onClick={() => {
                              setActiveTab('submodules');
                              setSelectedModuleId(module.id);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm transition-colors"
                          >
                            查看子模块 →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 子模块信息标签页 */}
            {activeTab === 'submodules' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">子模块列表</h3>
                  <button 
                    onClick={() => setShowSubmoduleForm(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    添加子模块
                  </button>
                </div>
                
                {/* 模块筛选 */}
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">筛选模块:</label>
                  <select
                    value={selectedModuleId || ''}
                    onChange={(e) => setSelectedModuleId(e.target.value || null)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                  >
                    <option value="">全部模块</option>
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.module_type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">子模块名称</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">型号</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出厂版本</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前版本</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属模块</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredSubmodules.map((submodule) => (
                        <tr key={submodule.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{submodule.name}</div>
                            <div className="text-sm text-gray-500">{submodule.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{submodule.model || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{submodule.factory_version || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{submodule.current_version || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {modules.find(m => m.id === submodule.module_id)?.module_type || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(submodule.status)}`}>
                              {submodule.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-4">
                              <button
                                onClick={() => handleEditSubmodule(submodule)}
                                className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                                title="编辑子模块"
                              >
                                <PencilIcon className="h-4 w-4" />
                                <span className="text-xs">编辑</span>
                              </button>
                              <button
                                onClick={() => handleShowVersionHistory(submodule)}
                                className="flex items-center space-x-1 text-green-600 hover:text-green-800 transition-colors"
                                title="查看版本历史"
                              >
                                <ClockIcon className="h-4 w-4" />
                                <span className="text-xs">历史</span>
                              </button>
                              <button
                                onClick={() => handleUpdateCurrentVersion(submodule)}
                                className="flex items-center space-x-1 text-purple-600 hover:text-purple-800 transition-colors"
                                title="修改当前版本"
                              >
                                <span className="text-xs font-bold">V</span>
                                <span className="text-xs">版本</span>
                              </button>
                              <button
                                onClick={() => handleDeleteSubmodule(submodule.id)}
                                className="flex items-center space-x-1 text-red-600 hover:text-red-800 transition-colors"
                                title="删除子模块"
                              >
                                <TrashIcon className="h-4 w-4" />
                                <span className="text-xs">删除</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}


            {/* 问题信息标签页 */}
            {activeTab === 'issues' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">问题列表</h3>
                  <button 
                    onClick={handleAddIssue}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    添加问题
                  </button>
                </div>
                <div className="space-y-4">
                  {issues.map((issue) => (
                    <div key={issue.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(issue.status)}
                          <div>
                            <h4 className="font-medium text-gray-900">{issue.description}</h4>
                            <p className="text-sm text-gray-500">模块: {issue.module_category || '设备级别'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            issue.severity === 'high' ? 'bg-red-100 text-red-800' :
                            issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
                            {issue.status === 'open' ? '待处理' : issue.status === 'in_progress' ? '处理中' : '已解决'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>负责人: {issue.assignee}</span>
                        <span>创建时间: {new Date(issue.created_at).toLocaleDateString()}</span>
                      </div>
                      {issue.status !== 'closed' && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleResolveIssue(issue)}
                            className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition-colors text-sm"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            解决问题
                          </button>
                        </div>
                      )}
                      {issue.status === 'closed' && issue.resolution_description && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircleIcon className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">已解决</span>
                          </div>
                          <p className="text-sm text-green-700">{issue.resolution_description}</p>
                          {issue.resolved_at && (
                            <p className="text-xs text-green-600 mt-1">
                              解决时间: {new Date(issue.resolved_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 模块表单弹窗 */}
      {showModuleForm && (
        <ModuleForm
          module={editingModule}
          deviceId={id!}
          onClose={handleCloseModuleForm}
          onSubmit={handleModuleSubmit}
        />
      )}

      {/* 子模块表单弹窗 */}
      {showSubmoduleForm && (
        <SubmoduleForm
          submodule={editingSubmodule}
          modules={modules}
          onClose={handleCloseSubmoduleForm}
          onSubmit={handleSubmoduleSubmit}
        />
      )}

      {/* 版本历史弹窗 */}
      {showVersionHistory && selectedSubmoduleForVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedSubmoduleForVersion.name} - 版本历史
              </h3>
              <button
                onClick={() => {
                  setShowVersionHistory(false);
                  setSelectedSubmoduleForVersion(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {submoduleVersions.length > 0 ? (
                <div className="space-y-4">
                  {submoduleVersions.map((version, index) => (
                    <div key={version.id || index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-semibold text-gray-900">{version.version_number}</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            version.version_type === 'factory' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {version.version_type === 'factory' ? '出厂版本' : '更新版本'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {version.release_date ? new Date(version.release_date).toLocaleDateString() : '未知'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p><strong>更新人:</strong> {version.updated_by || '未知'}</p>
                        {version.description && (
                          <div>
                            <p><strong>描述:</strong></p>
                            <div className="mt-1 whitespace-pre-line text-gray-700">
                              {version.description}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无版本历史记录
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 版本更新弹窗 */}
      {showVersionUpdateForm && selectedSubmoduleForVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                修改当前版本 - {selectedSubmoduleForVersion.name}
              </h3>
              <button
                onClick={() => {
                  setShowVersionUpdateForm(false);
                  setSelectedSubmoduleForVersion(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  当前版本: {selectedSubmoduleForVersion.current_version || '未设置'}
                </label>
                <input
                  type="text"
                  id="newVersion"
                  placeholder="请输入新版本号"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  版本描述
                </label>
                <textarea
                  id="versionDescription"
                  placeholder="请输入版本描述（可选）"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowVersionUpdateForm(false);
                    setSelectedSubmoduleForVersion(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const newVersionInput = document.getElementById('newVersion') as HTMLInputElement;
                    const versionDescriptionInput = document.getElementById('versionDescription') as HTMLTextAreaElement;
                    const newVersion = newVersionInput.value.trim();
                    const versionDescription = versionDescriptionInput.value.trim();
                    
                    if (newVersion) {
                      handleVersionUpdateSubmit(newVersion, versionDescription);
                    } else {
                      alert('请输入新版本号');
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  确认更新
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加问题弹窗 */}
      {showIssueForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">添加问题</h3>
              <button
                onClick={handleCloseIssueForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const data = {
                  description: formData.get('description') as string,
                  severity: formData.get('severity') as string,
                  assignee: formData.get('assignee') as string,
                  module_id: formData.get('module_id') as string || undefined
                };
                handleIssueSubmit(data);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">问题描述</label>
                    <textarea
                      name="description"
                      required
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="请描述遇到的问题"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">严重程度</label>
                    <select
                      name="severity"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">请选择严重程度</option>
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">负责人</label>
                    <input
                      type="text"
                      name="assignee"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="请输入负责人姓名"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">相关模块（可选）</label>
                    <select
                      name="module_id"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">设备级别问题</option>
                      {modules.map((module) => (
                        <option key={module.id} value={module.id}>
                          {module.module_type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseIssueForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    创建问题
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 解决问题弹窗 */}
      {showResolveForm && selectedIssueForResolve && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">解决问题</h3>
              <button
                onClick={handleCloseResolveForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">问题描述:</p>
                <p className="text-sm font-medium text-gray-900">{selectedIssueForResolve.description}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">解决描述</label>
                <textarea
                  id="resolutionDescription"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请描述问题的解决方案"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCloseResolveForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const resolutionInput = document.getElementById('resolutionDescription') as HTMLTextAreaElement;
                    const resolutionDescription = resolutionInput.value.trim();
                    if (resolutionDescription) {
                      handleResolveSubmit(resolutionDescription);
                    } else {
                      alert('请输入解决描述');
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                >
                  确认解决
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 设备表单弹窗 */}
      {showDeviceForm && (
        <DeviceForm
          device={device}
          onClose={handleCloseDeviceForm}
          onSubmit={handleDeviceSubmit}
        />
      )}
    </Layout>
  );
};

export default DeviceDetail;
