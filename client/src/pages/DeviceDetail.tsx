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
  EyeSlashIcon,
  TagIcon,
  WrenchScrewdriverIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
import { Device, Module, Issue, ModuleFormData, DeviceFormData, VersionRelease, DeviceUpgrade } from '../types';
import { deviceApi, moduleApi, issueApi, versionReleaseApi, moduleVersionApi, deviceUpgradeApi } from '../services/api';
import Layout from '../components/Layout';
import ModuleForm from '../components/ModuleForm';
import DeviceForm from '../components/DeviceForm';
import UpgradeForm from '../components/UpgradeForm';

const DeviceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'modules' | 'versions' | 'issues' | 'after-sales'>('modules');
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showVersionUpdateForm, setShowVersionUpdateForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [selectedIssueForResolve, setSelectedIssueForResolve] = useState<Issue | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [moduleReleases, setModuleReleases] = useState<VersionRelease[]>([]);
  const [selectedModuleForVersion, setSelectedModuleForVersion] = useState<Module | null>(null);
  const [moduleVersions, setModuleVersions] = useState<any[]>([]);
  const [showModuleVersionHistory, setShowModuleVersionHistory] = useState(false);
  const [deviceUpgrades, setDeviceUpgrades] = useState<DeviceUpgrade[]>([]);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);

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

  // 获取设备升级记录
  const fetchDeviceUpgrades = async () => {
    if (!id) return;
    try {
      const response = await deviceUpgradeApi.getUpgrades({ device_id: id, limit: 1000 });
      if (response.success) {
        setDeviceUpgrades(response.data);
      }
    } catch (error) {
      console.error('获取设备升级记录失败:', error);
    }
  };

  const handleUpgradeSubmit = async (data: any) => {
    try {
      const response = await deviceUpgradeApi.createUpgrade(data);
      if (response.success) {
        await fetchDeviceUpgrades();
        setShowUpgradeForm(false);
      }
    } catch (error) {
      console.error('提交升级记录失败:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDevice(),
        fetchModules(),
        fetchIssues(),
        fetchDeviceUpgrades()
      ]);
      setLoading(false);
    };
    loadData();
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchIssues();
    }
  }, [id]);


  // 模块CRUD处理函数
  const handleEditModule = (module: Module) => {
    setEditingModule(module);
    setShowModuleForm(true);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (window.confirm('确定要删除这个模块吗？')) {
      try {
        await moduleApi.deleteModule(moduleId);
        await fetchModules();
      } catch (error) {
        console.error('删除模块失败:', error);
        alert('删除模块失败');
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

  // 获取模块版本历史
  const fetchModuleVersions = async (moduleId: string) => {
    try {
      const response = await moduleVersionApi.getModuleVersions({ module_id: moduleId });
      if (response.success) {
        setModuleVersions(response.data);
      }
    } catch (error) {
      console.error('获取模块版本历史失败:', error);
    }
  };

  // 显示模块版本历史
  const handleShowModuleVersionHistory = async (module: Module) => {
    setSelectedModuleForVersion(module);
    await fetchModuleVersions(module.id);
    setShowModuleVersionHistory(true);
  };

  // 获取指定模块类型的发布库版本
  const fetchModuleReleases = async (typeId: string) => {
    try {
      const response = await versionReleaseApi.getReleases({ module_type_id: parseInt(typeId) });
      if (response.success) {
        setModuleReleases(response.data);
      }
    } catch (error) {
      console.error('获取发布版本失败:', error);
    }
  };

  // 修改当前版本 (模块)
  const handleUpdateModuleVersion = async (module: Module) => {
    setSelectedModuleForVersion(module);
    await fetchModuleReleases(module.type_id);
    setShowVersionUpdateForm(true);
  };

  // 版本更新提交 (模块/子模块)
  const handleVersionUpdateSubmit = async (versionData: {
    version_number: string,
    release_id?: number,
    description: string,
    updated_by: string
  }) => {
    try {
      const { version_number, release_id, description, updated_by } = versionData;

      if (selectedModuleForVersion) {
        // 更新模块版本
        await moduleVersionApi.createModuleVersion({
          module_id: selectedModuleForVersion.id,
          version_number,
          release_id,
          version_type: 'update',
          description,
          updated_by
        });
        await fetchModules();
      }

      setShowVersionUpdateForm(false);
      setSelectedModuleForVersion(null);
    } catch (error: any) {
      console.error('更新版本失败:', error);
      const errorMsg = error.response?.data?.error || '更新版本失败';
      alert(errorMsg);
    }
  };

  // 关闭表单处理
  const handleCloseModuleForm = () => {
    setShowModuleForm(false);
    setEditingModule(null);
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

  // 打印页面
  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/devices')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors no-print"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              返回设备列表
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{device.name}</h1>
              <p className="text-gray-600 mt-1">设备详情信息</p>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              <PrinterIcon className="h-4 w-4" />
              打印
            </button>
            <button
              onClick={handleEditDevice}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              编辑设备
            </button>
          </div>
        </div>

        {/* 设备基本信息 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备编号</label>
              <p className="text-lg font-mono print:text-base">{device.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">产品线</label>
              <p className="text-lg print:text-base">{device.product_line_name}</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">客户</label>
              <p className="text-lg print:text-base">
                {device.customer_name ? (
                  <>
                    {device.customer_name}
                    {device.customer_short_name && <span className="text-sm text-gray-400 ml-2">({device.customer_short_name})</span>}
                  </>
                ) : '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
              <p className="text-lg print:text-base">{device.location || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">远程码</label>
              <p className="text-lg font-mono text-blue-600 print:text-base">{device.remote_code || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <div className="flex items-center space-x-2">
                <p className="text-lg font-mono text-gray-600 print:text-base">
                  {device.password ? (showPassword ? device.password : '••••••••') : '-'}
                </p>
                {device.password && (
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-gray-500 hover:text-gray-700 transition-colors no-print"
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
              <p className="text-lg print:text-base">{new Date(device.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">更新时间</label>
              <p className="text-lg print:text-base">{new Date(device.updated_at).toLocaleDateString()}</p>
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
          <div className="border-b border-gray-200 no-print">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { key: 'modules', label: '模块信息', count: modules.length },
                { key: 'versions', label: '版本记录', count: modules.some(m => (m as any).current_version) ? modules.length : 0 },
                { key: 'after-sales', label: '售后服务', count: issues.length + deviceUpgrades.length }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {tab.label}
                  <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === tab.key
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
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors no-print"
                  >
                    <PlusIcon className="h-4 w-4" />
                    添加模块
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-4 print:grid-cols-3">
                  {modules.map((module) => (
                    <div key={module.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all flex flex-col print:break-inside-avoid">
                      {/* 模块名称和版本号 */}
                      <div className="flex items-center justify-center gap-3 mb-3 print:gap-1 print:mb-2">
                        <h4 className="font-semibold text-lg text-gray-900 print:text-sm">{module.module_type}</h4>
                        {(module as any).current_version && (
                          <span className="px-3 py-1 bg-blue-600 text-white text-sm font-mono font-bold rounded-md shadow-sm print:px-2 print:py-0.5 print:text-xs">
                            {(module as any).current_version}
                          </span>
                        )}
                      </div>
                      
                      {/* 状态 */}
                      <div className="flex justify-center mb-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(module.status)}`}>
                          {module.status}
                        </span>
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="flex gap-2 mb-3 justify-center no-print">
                        <button
                          onClick={() => handleShowModuleVersionHistory(module)}
                          className="flex items-center justify-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-200 hover:border-green-400"
                          title="版本历史"
                        >
                          <ClockIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">历史</span>
                        </button>
                        <button
                          onClick={() => handleUpdateModuleVersion(module)}
                          className="flex items-center justify-center gap-1 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200 hover:border-purple-400"
                          title="更新版本"
                        >
                          <WrenchScrewdriverIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">更新版本</span>
                        </button>
                        <button
                          onClick={() => handleDeleteModule(module.id)}
                          className="flex items-center justify-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 hover:border-red-400"
                          title="删除模块"
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">删除</span>
                        </button>
                      </div>
                      
                      {/* 创建时间 */}
                      <p className="text-xs text-gray-500 text-center">创建时间: {new Date(module.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 版本记录标签页 */}
            {activeTab === 'versions' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-medium text-gray-900">版本控制中心</h3>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">快照</span>
                  </div>
                  <p className="text-sm text-gray-500">查看各模块的最新版本迭代状态</p>
                </div>

                <div className="space-y-4">
                  {modules.map(module => (
                    <div key={module.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                            <TagIcon className="h-4 w-4" />
                          </span>
                          <span className="font-bold text-gray-900">{module.module_type}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">当前主版本:</span>
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-mono rounded">
                            {(module as any).current_version || '未注册'}
                          </span>
                          <button
                            onClick={() => handleUpdateModuleVersion(module)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="变更登记"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-xs text-gray-400 italic">
                          该模块当前版本信息已在上方展示
                        </div>
                      </div>
                    </div>
                  ))}
                  {modules.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      暂无模块数据，请先添加模块
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* 售后中心标签页 */}
            {activeTab === 'after-sales' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">售后与版本迭代</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleAddIssue}
                      className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors text-sm"
                    >
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      报修
                    </button>
                    <button
                      onClick={() => setShowUpgradeForm(true)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      <WrenchScrewdriverIcon className="h-4 w-4" />
                      等级升级
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 未解决问题 */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-500" />
                      待处理问题 ({issues.filter(i => i.status !== 'closed').length})
                    </h4>
                    <div className="space-y-3">
                      {issues.filter(i => i.status !== 'closed').map(issue => (
                        <div key={issue.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                          <div className="flex justify-between items-start">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${issue.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                              {issue.severity === 'high' ? '高' : '中'}
                            </span>
                            <span className="text-xs text-gray-400">{new Date(issue.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-800 line-clamp-2">{issue.description}</p>
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => handleResolveIssue(issue)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              去解决 →
                            </button>
                          </div>
                        </div>
                      ))}
                      {issues.filter(i => i.status !== 'closed').length === 0 && (
                        <p className="text-center py-8 text-sm text-gray-400">目前没有任何待处理问题</p>
                      )}
                    </div>
                  </div>

                  {/* 最近升级记录 */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <ClockIcon className="h-5 w-5 mr-2 text-blue-500" />
                      最近升级历史
                    </h4>
                    <div className="space-y-3">
                      {deviceUpgrades.slice(0, 5).map(upgrade => (
                        <div key={upgrade.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                          <div className="flex justify-between">
                            <span className="text-xs font-bold text-blue-600">{upgrade.upgrade_type}</span>
                            <span className="text-xs text-gray-400">{new Date(upgrade.upgrade_at).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-1 flex items-center space-x-2 text-xs">
                            <span className="text-gray-400">{upgrade.old_version || 'N/A'}</span>
                            <span>→</span>
                            <span className="font-medium">{upgrade.new_version || 'N/A'}</span>
                          </div>
                          <p className="mt-2 text-xs text-gray-600">{upgrade.description}</p>
                        </div>
                      ))}
                      {deviceUpgrades.length === 0 && (
                        <p className="text-center py-8 text-sm text-gray-400">暂无任何升级记录</p>
                      )}
                    </div>
                  </div>
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

      {/* 模块版本历史弹窗 */}
      {showModuleVersionHistory && selectedModuleForVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedModuleForVersion.module_type} - 版本历史
              </h3>
              <button
                onClick={() => {
                  setShowModuleVersionHistory(false);
                  setSelectedModuleForVersion(null);
                  setModuleVersions([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {moduleVersions.length > 0 ? (
                <div className="space-y-4">
                  {moduleVersions.map((version, index) => (
                    <div key={version.id || index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-semibold text-gray-900">{version.version_number}</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            version.version_type === 'factory' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {version.version_type === 'factory' ? '出厂版本' : '更新版本'}
                          </span>
                          {version.release_id && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              官方发布
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {version.release_date ? new Date(version.release_date).toLocaleDateString() : '未知'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p><strong>更新人:</strong> {version.updated_by || '未知'}</p>
                        {version.description && (
                          <div className="mt-2">
                            <p className="font-medium text-gray-700">变更说明:</p>
                            <div className="mt-1 p-3 bg-gray-50 rounded whitespace-pre-line text-gray-700">
                              {version.description}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">暂无版本历史记录</p>
                  <p className="text-sm text-gray-400 mt-1">请先为该模块创建版本记录</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 版本更新弹窗 (重构) */}
      {showVersionUpdateForm && selectedModuleForVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                强制版本更新登记 - {selectedModuleForVersion.module_type}
              </h3>
              <button
                onClick={() => {
                  setShowVersionUpdateForm(false);
                  setSelectedModuleForVersion(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* 版本库选填区 */}
              {moduleReleases.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <TagIcon className="h-4 w-4" /> 从发布库勾选正式版本 (可选)
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {moduleReleases.map((rel) => (
                      <label key={rel.id} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200 hover:bg-blue-50 cursor-pointer transition-colors group">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="releaseSelection"
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            onChange={() => {
                              const versionInput = document.getElementById('newVersion') as HTMLInputElement;
                              const releaseIdInput = document.getElementById('releaseId') as HTMLInputElement;
                              if (versionInput) versionInput.value = rel.version_number;
                              if (releaseIdInput) releaseIdInput.value = rel.id.toString();
                            }}
                          />
                          <span className="ml-3 text-sm font-bold font-mono text-gray-900">{rel.version_number}</span>
                        </div>
                        <span className="text-xs text-gray-500 group-hover:text-blue-600">{rel.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">目标版本号</label>
                  <input
                    type="text"
                    id="newVersion"
                    required
                    placeholder="V1.x.x"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    defaultValue=""
                  />
                  <input type="hidden" id="releaseId" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">更新执行人 (强制)</label>
                  <input
                    type="text"
                    id="updatedBy"
                    required
                    placeholder="请输入你的姓名"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">变更记录说明 (强制 - 至少5字)</label>
                <textarea
                  id="versionDescription"
                  required
                  rows={4}
                  placeholder="由于发生了[什么]，我们对该模块执行了[什么]操作，以实现[什么]..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowVersionUpdateForm(false);
                    setSelectedModuleForVersion(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const versionInput = document.getElementById('newVersion') as HTMLInputElement;
                    const descriptionInput = document.getElementById('versionDescription') as HTMLTextAreaElement;
                    const updatedByInput = document.getElementById('updatedBy') as HTMLInputElement;
                    const releaseIdInput = document.getElementById('releaseId') as HTMLInputElement;

                    const version_number = versionInput.value.trim();
                    const description = descriptionInput.value.trim();
                    const updated_by = updatedByInput.value.trim();
                    const release_id = releaseIdInput.value ? parseInt(releaseIdInput.value) : undefined;

                    if (!version_number || !description || !updated_by) {
                      alert('所有字段均为必填项');
                      return;
                    }

                    if (description.length < 5) {
                      alert('说明过短，请提供更详细的执行记录');
                      return;
                    }

                    handleVersionUpdateSubmit({ version_number, description, updated_by, release_id });
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  确认并保存记录
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

      {/* 升级表单弹窗 */}
      {showUpgradeForm && (
        <UpgradeForm
          deviceId={id!}
          onClose={() => setShowUpgradeForm(false)}
          onSubmit={handleUpgradeSubmit}
        />
      )}
    </Layout>
  );
};

export default DeviceDetail;
