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
  PrinterIcon,
  DocumentIcon,
  ArrowUpTrayIcon,
  FolderIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { Device, Module, Issue, ModuleFormData, DeviceFormData, VersionRelease, DeviceUpgrade, SOPTemplate, ChecklistItem, SOPTemplateItem } from '../types';
import { deviceApi, moduleApi, issueApi, versionReleaseApi, moduleVersionApi, deviceUpgradeApi, sopTemplateApi, uploadChecklistImage } from '../services/api';
import api from '../services/api';
import Layout from '../components/Layout';
import ModuleForm from '../components/ModuleForm';
import DeviceForm from '../components/DeviceForm';
import UpgradeForm from '../components/UpgradeForm';
import SOPChecklistSection from '../components/SOPChecklistSection';

const DeviceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'modules' | 'versions' | 'issues' | 'after-sales' | 'documents'>('modules');
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
  const [selectedReleaseForVersion, setSelectedReleaseForVersion] = useState<VersionRelease | null>(null);
  const [moduleVersions, setModuleVersions] = useState<any[]>([]);
  const [showModuleVersionHistory, setShowModuleVersionHistory] = useState(false);
  const [deviceUpgrades, setDeviceUpgrades] = useState<any[]>([]);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [sopTemplate, setSopTemplate] = useState<SOPTemplate | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [versionSubmitting, setVersionSubmitting] = useState(false);

  // 设备出厂资料相关状态
  const [deviceDocuments, setDeviceDocuments] = useState<any[]>([]);
  const [deviceDocCategories, setDeviceDocCategories] = useState<string[]>([]);
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [docUploadFiles, setDocUploadFiles] = useState<File[]>([]);
  const [docUploadCategory, setDocUploadCategory] = useState('');
  const [docUploadNewCategory, setDocUploadNewCategory] = useState('');
  const [docUploadBy, setDocUploadBy] = useState('');
  const [docUploading, setDocUploading] = useState(false);
  const [docDragOver, setDocDragOver] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState('');
  const [bgUpload, setBgUpload] = useState<{ fileCount: number; progress: number; done: boolean; error: string | null } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{url: string; title: string; type: string} | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [docSelectMode, setDocSelectMode] = useState(false);

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

  // 获取设备模块版本升级记录
  const fetchDeviceUpgrades = async () => {
    if (!id) return;
    try {
      const { data: result } = await api.get('/versions', { params: { device_id: id, limit: 200 } });
      if (result.success) {
        const allVersions = result.data;
        // 按模块分组，按时间排序
        const byModule: Record<string, any[]> = {};
        allVersions.forEach((v: any) => {
          const key = v.module_id;
          if (!byModule[key]) byModule[key] = [];
          byModule[key].push(v);
        });
        // 每组按创建时间升序
        Object.values(byModule).forEach(arr => arr.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
        // 为每个update版本找到前一个版本
        const updates = allVersions
          .filter((v: any) => v.version_type === 'update')
          .map((v: any) => {
            const moduleVersions = byModule[v.module_id] || [];
            const idx = moduleVersions.findIndex((mv: any) => mv.id === v.id);
            const oldVersion = idx > 0 ? moduleVersions[idx - 1].version_number : null;
            return { ...v, old_version: oldVersion };
          });
        // 按时间倒序
        updates.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setDeviceUpgrades(updates);
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

  // 获取设备出厂资料
  const fetchDeviceDocuments = async () => {
    if (!id) return;
    try {
      const { data: result } = await api.get('/device-documents', { params: { device_id: id } });
      if (result.success) {
        setDeviceDocuments(result.data);
        // 提取所有分类
        const cats = [...new Set(result.data.map((d: any) => d.category))] as string[];
        setDeviceDocCategories(cats);
      }
    } catch (error) {
      console.error('获取设备资料失败:', error);
    }
  };

  // 批量上传设备资料
  const handleDocUpload = async () => {
    if (docUploadFiles.length === 0) return;
    const category = docUploadNewCategory.trim() || docUploadCategory;
    if (!category) {
      alert('请选择或输入分类');
      return;
    }
    // 提前捕获上传参数，关闭弹窗后仍可使用
    const filesToUpload = [...docUploadFiles];
    const uploadedBy = docUploadBy.trim();
    const fileCount = filesToUpload.length;

    // 立即关闭弹窗，切换为后台上传模式
    resetDocUploadForm();
    setBgUpload({ fileCount, progress: 0, done: false, error: null });

    try {
      const formData = new FormData();
      filesToUpload.forEach(file => formData.append('files', file));
      filesToUpload.forEach(file => {
        const relPath = (file as any).webkitRelativePath as string;
        // 发送完整相对路径（含文件夹），后端据此构建 OSS 目录层级
        formData.append('relative_paths', relPath || file.name);
        // 标题使用相对路径去扩展名（如 "v1.2/firmware/image"），体现层级结构
        formData.append('titles', (relPath || file.name).replace(/\.[^/.]+$/, ''));
      });
      formData.append('device_id', id!);
      formData.append('category', category);
      if (uploadedBy) formData.append('uploaded_by', uploadedBy);

      const { data: result } = await api.post('/device-documents/upload', formData, {
        onUploadProgress: (e: any) => {
          if (e.total) {
            const pct = Math.round((e.loaded * 100) / e.total);
            setBgUpload(prev => prev ? { ...prev, progress: pct } : prev);
          }
        },
      });

      if (result.success) {
        setBgUpload(prev => prev ? { ...prev, done: true, progress: 100 } : prev);
        await fetchDeviceDocuments();
        setTimeout(() => setBgUpload(null), 3500);
      } else {
        setBgUpload(prev => prev ? { ...prev, error: result.error || '上传失败' } : prev);
      }
    } catch (error) {
      console.error('上传设备资料失败:', error);
      setBgUpload(prev => prev ? { ...prev, error: '上传失败，请重试' } : prev);
    }
  };

  // 删除设备资料
  const handleDeleteDocument = async (docId: number) => {
    if (!window.confirm('确定要删除这个文件吗？')) return;
    try {
      const { data: result } = await api.delete(`/device-documents/${docId}`);
      if (result.success) {
        await fetchDeviceDocuments();
      } else {
        alert(result.error || '删除失败');
      }
    } catch (error) {
      console.error('删除设备资料失败:', error);
      alert('删除失败');
    }
  };

  // 下载设备资料
  const handleDownloadDocument = (docId: number) => {
    const token = localStorage.getItem('auth_token');
    window.open(`/api/device-documents/${docId}/download?token=${token}`, '_blank');
  };

  // 切换文档选择
  const toggleDocSelect = (docId: number) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAllDocs = () => {
    if (selectedDocIds.size === deviceDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(deviceDocuments.map(d => d.id)));
    }
  };

  // 批量删除
  const handleBatchDeleteDocs = async () => {
    if (selectedDocIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedDocIds.size} 个文件吗？`)) return;
    try {
      const { data: result } = await api.post('/device-documents/batch-delete', { ids: Array.from(selectedDocIds) });
      if (result.success) {
        setSelectedDocIds(new Set());
        setDocSelectMode(false);
        await fetchDeviceDocuments();
      } else {
        alert(result.error || '批量删除失败');
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('批量删除失败');
    }
  };

  // 批量下载
  const handleBatchDownloadDocs = () => {
    if (selectedDocIds.size === 0) return;
    const token = localStorage.getItem('auth_token');
    selectedDocIds.forEach(docId => {
      setTimeout(() => {
        window.open(`/api/device-documents/${docId}/download?token=${token}`, '_blank');
      }, 0);
    });
  };

  // 预览文档
  const handlePreviewDocument = async (docId: number, originalName: string) => {
    try {
      const ext = (originalName || '').split('.').pop()?.toLowerCase() || '';
      const previewableImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
      const previewablePdf = ext === 'pdf';
      if (!previewableImage && !previewablePdf) {
        // 不可预览的文件类型，直接下载
        handleDownloadDocument(docId);
        return;
      }
      const { data: result } = await api.get(`/device-documents/${docId}/preview`);
      if (result.success) {
        const fileType = previewableImage ? 'image' : 'pdf';
        setPreviewDoc({ url: result.data.url, title: result.data.title || originalName, type: fileType });
      } else {
        handleDownloadDocument(docId);
      }
    } catch (error) {
      console.error('预览失败:', error);
      handleDownloadDocument(docId);
    }
  };

  // 重置上传表单
  const resetDocUploadForm = () => {
    setShowDocUploadModal(false);
    setDocUploadFiles([]);
    setDocUploadCategory('');
    setDocUploadNewCategory('');
    setDocUploadBy('');
    setDocDragOver(false);
    setDocUploadProgress('');
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDevice(),
        fetchModules(),
        fetchIssues(),
        fetchDeviceUpgrades(),
        fetchDeviceDocuments()
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
        await moduleApi.updateModule(editingModule.id.toString(), data);
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
    await fetchModuleVersions(module.id.toString());
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
    setSelectedReleaseForVersion(null);
    setSopTemplate(null);
    setChecklistItems([]);
    await fetchModuleReleases(module.type_id.toString());
    try {
      const tplRes = await sopTemplateApi.getByModuleType(module.type_id);
      if (tplRes?.success && tplRes.data) {
        const tpl: SOPTemplate = tplRes.data;
        setSopTemplate(tpl);
        setChecklistItems(
          (tpl.items as SOPTemplateItem[]).map(item => ({
            id: item.id,
            text: item.text,
            required: item.required,
            status: 'pending',
            attachments: [],
          }))
        );
      }
    } catch (_) {}
    setShowVersionUpdateForm(true);
  };

  // 版本更新提交 (模块/子模块)
  const handleVersionUpdateSubmit = async (versionData: {
    version_number: string,
    release_id?: number,
    description: string,
    updated_by: string,
    checklist?: ChecklistItem[]
  }) => {
    try {
      const { version_number, release_id, description, updated_by, checklist } = versionData;

      // 如果有检查项，先把 blob 附件上传到服务器，用真实 URL 替换
      setVersionSubmitting(true);
      let finalChecklist = checklist;
      if (checklist && checklist.length > 0) {
        finalChecklist = await Promise.all(
          checklist.map(async item => {
            if (item.attachments.length === 0) return item;
            const uploadedAttachments = await Promise.all(
              item.attachments.map(async (att: any) => {
                if (att._file) {
                  try {
                    const result = await uploadChecklistImage(att._file, {
                      moduleId: selectedModuleForVersion?.id,
                      moduleType: selectedModuleForVersion?.module_type,
                      fromVersion: (selectedModuleForVersion as any)?.current_version ?? undefined,
                      toVersion: version_number,
                    });
                    return { name: result.name, url: result.url, size: result.size };
                  } catch (e) {
                    // 上传失败则保留原始名称，去掉无效 blob url
                    return { name: att.name, url: '', size: att.size };
                  }
                }
                return att;
              })
            );
            return { ...item, attachments: uploadedAttachments };
          })
        );
      }

      if (selectedModuleForVersion) {
        // 判断是出厂版本还是更新版本
        const isFactory = !(selectedModuleForVersion as any).current_version;
        await moduleVersionApi.createModuleVersion({
          module_id: selectedModuleForVersion.id,
          version_number,
          release_id,
          version_type: isFactory ? 'factory' : 'update',
          description,
          updated_by,
          checklist: finalChecklist && finalChecklist.length > 0 ? finalChecklist : undefined,
        });
        await fetchModules();
        await fetchDeviceUpgrades();
      }

      setShowVersionUpdateForm(false);
      setSelectedModuleForVersion(null);
      setSelectedReleaseForVersion(null);
      setSopTemplate(null);
      setChecklistItems([]);
      setVersionSubmitting(false);
    } catch (error: any) {
      console.error('更新版本失败:', error);
      const errorMsg = error.response?.data?.error || '更新版本失败';
      setVersionSubmitting(false);
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
      await issueApi.updateIssue(selectedIssueForResolve.id.toString(), {
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
      // 如果序列号有变更，传递new_id
      const submitData: any = { ...data };
      if (data.id && data.id !== id) {
        submitData.new_id = data.id;
      }
      delete submitData.id;
      // product_line_id 在编辑模式是只读的，不需要发送（也不能发送空字符串到 INT NOT NULL 列）
      delete submitData.product_line_id;
      const response: any = await deviceApi.updateDevice(id!, submitData);
      console.log('设备更新响应:', response);
      // 如果序列号变更了，跳转到新的URL
      if (response.data?.new_id && response.data.new_id !== id) {
        navigate(`/devices/${response.data.new_id}`, { replace: true });
      } else {
        await fetchDevice();
      }
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
      <div className="space-y-4 3xl:space-y-6">
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
              <h1 className="text-2xl 3xl:text-3xl font-bold text-gray-900">{device.name}</h1>
              <p className="text-gray-600 mt-1">设备详细信息</p>
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
        <div className="bg-white rounded-lg shadow p-4 3xl:p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 3xl:gap-6 print:grid-cols-2 print:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">生产序列号</label>
              <p className="text-lg font-mono print:text-base">{device.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备编码</label>
              <p className="text-lg font-mono print:text-base">{device.device_code || '-'}</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">产品线 / 产品型号</label>
              <p className="text-lg print:text-base">
                {device.product_line_name || '-'}
                {device.product_model && (
                  <span className="text-gray-500 text-base ml-2">/ {device.product_model}</span>
                )}
                {device.product_version_number && (
                  <span className="text-blue-600 text-sm ml-2">
                    [{device.product_version_number}{device.product_version_name ? ` - ${device.product_version_name}` : ''}]
                  </span>
                )}
              </p>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <div className="flex items-center space-x-2">
                {getStatusIcon(device.status)}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(device.status)}`}>
                  {device.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 3xl:gap-6">
          <div className="bg-white rounded-lg shadow p-4 3xl:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">M</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">模块数量</p>
                <p className="text-xl 3xl:text-2xl font-semibold text-gray-900">{modules.length}</p>
              </div>
            </div>
          </div>


          <div className="bg-white rounded-lg shadow p-4 3xl:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">问题数量</p>
                <p className="text-xl 3xl:text-2xl font-semibold text-gray-900">{issues.length}</p>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-red-600">待处理 {issues.filter(i => i.status === 'open').length}</span>
                  <span className="text-yellow-600">处理中 {issues.filter(i => i.status === 'in_progress').length}</span>
                  <span className="text-green-600">已解决 {issues.filter(i => i.status === 'closed').length}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="bg-white rounded-lg shadow p-4 3xl:p-6 cursor-pointer hover:shadow-md transition-shadow border-2 border-transparent hover:border-green-300"
            onClick={() => setActiveTab('documents' as any)}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <FolderIcon className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">出厂资料</p>
                <p className="text-xl 3xl:text-2xl font-semibold text-gray-900">{deviceDocuments.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 no-print">
            <nav className="-mb-px flex space-x-8 px-4 3xl:px-6">
              {[
                { key: 'modules', label: '模块信息', count: modules.length },
                { key: 'after-sales', label: '售后服务', count: issues.length + deviceUpgrades.length },
                { key: 'documents', label: '出厂资料', count: deviceDocuments.length }
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

          <div className="p-4 3xl:p-6">
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
                <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2 print:grid print:grid-cols-3 print:flex-wrap">
                  {modules.map((module) => (
                    <div key={module.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all flex flex-col flex-shrink-0 min-w-[180px] print:break-inside-avoid">
                      {/* 模块名称和版本号 */}
                      <div className="flex items-center justify-center gap-3 mb-3 print:gap-1 print:mb-2">
                        <h4 className="font-semibold text-lg text-gray-900 print:text-sm">{module.module_type}</h4>
                        {(module as any).current_version && (
                          <span className="px-3 py-1 bg-blue-600 text-white text-sm font-mono font-bold rounded-md shadow-sm print:px-2 print:py-0.5 print:text-xs">
                            {(module as any).current_version}
                          </span>
                        )}
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="flex gap-2 mb-3 justify-center no-print">
                        <button
                          onClick={() => handleShowModuleVersionHistory(module)}
                          className="flex items-center justify-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-200 hover:border-green-400"
                          title="版本历史"
                        >
                          <ClockIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">版本历史</span>
                        </button>
                        <button
                          onClick={() => handleUpdateModuleVersion(module)}
                          className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors border ${
                            (module as any).current_version
                              ? 'text-purple-600 hover:bg-purple-50 border-purple-200 hover:border-purple-400'
                              : 'text-blue-600 hover:bg-blue-50 border-blue-200 hover:border-blue-400'
                          }`}
                          title={(module as any).current_version ? '更新版本' : '设置出厂版本'}
                        >
                          <WrenchScrewdriverIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{(module as any).current_version ? '更新版本' : '出厂版本'}</span>
                        </button>
                      </div>
                      
                      {/* 创建时间 */}
                      <p className="text-xs text-gray-500 text-center">创建时间: {new Date(module.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 出厂资料标签页 */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">出厂资料</h3>
                  <div className="flex items-center gap-2 no-print">
                    {deviceDocuments.length > 0 && (
                      <button
                        onClick={() => { setDocSelectMode(!docSelectMode); setSelectedDocIds(new Set()); }}
                        className={`flex items-center gap-1 px-3 py-2 rounded-md transition-colors text-sm ${
                          docSelectMode ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {docSelectMode ? '取消选择' : '批量管理'}
                      </button>
                    )}
                    <button
                      onClick={() => setShowDocUploadModal(true)}
                      className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors"
                    >
                      <ArrowUpTrayIcon className="h-4 w-4" />
                      上传资料
                    </button>
                  </div>
                </div>
                {docSelectMode && (
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.size === deviceDocuments.length && deviceDocuments.length > 0}
                        onChange={toggleSelectAllDocs}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      全选
                    </label>
                    <span className="text-sm text-gray-500">已选 {selectedDocIds.size} / {deviceDocuments.length}</span>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={handleBatchDownloadDocs}
                        disabled={selectedDocIds.size === 0}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <DocumentArrowDownIcon className="h-4 w-4" />
                        批量下载
                      </button>
                      <button
                        onClick={handleBatchDeleteDocs}
                        disabled={selectedDocIds.size === 0}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                        批量删除
                      </button>
                    </div>
                  </div>
                )}

                {deviceDocuments.length === 0 ? (
                  <div className="text-center py-16">
                    <FolderIcon className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">暂无出厂资料</p>
                    <button
                      onClick={() => setShowDocUploadModal(true)}
                      className="mt-3 text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      上传第一个文件
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 3xl:space-y-6">
                    {deviceDocCategories.map(cat => {
                      const docs = deviceDocuments.filter(d => d.category === cat);
                      if (docs.length === 0) return null;
                      return (
                        <div key={cat} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                            <FolderIcon className="h-5 w-5 mr-2 text-green-500" />
                            {cat} ({docs.length})
                          </h4>
                          <div className="space-y-2">
                            {docs.map(doc => {
                              const ext = (doc.original_name || '').split('.').pop()?.toLowerCase() || '';
                              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
                              const isPdf = ext === 'pdf';
                              const canPreview = isImage || isPdf;
                              return (
                              <div key={doc.id} className={`bg-white p-3 rounded-lg shadow-sm border flex items-center justify-between transition-colors ${selectedDocIds.has(doc.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-green-200'}`}>
                                {docSelectMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedDocIds.has(doc.id)}
                                    onChange={() => toggleDocSelect(doc.id)}
                                    className="w-4 h-4 text-blue-600 rounded flex-shrink-0 mr-2"
                                  />
                                )}
                                <div
                                  className={`flex items-center gap-3 min-w-0 flex-1 ${canPreview && !docSelectMode ? 'cursor-pointer' : docSelectMode ? 'cursor-pointer' : ''}`}
                                  onClick={() => docSelectMode ? toggleDocSelect(doc.id) : (canPreview && handlePreviewDocument(doc.id, doc.original_name))}
                                >
                                  {isImage ? (
                                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                      <img
                                        src={`/api/device-documents/${doc.id}/download`}
                                        alt={doc.title}
                                        className="w-10 h-10 object-cover rounded"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                    </div>
                                  ) : (
                                    <DocumentIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {doc.title}
                                    </span>
                                    {canPreview && <span className="text-xs text-green-500 font-normal flex-shrink-0">可预览</span>}
                                    <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(doc.file_size)}</span>
                                    <span className="text-xs text-gray-400 flex-shrink-0">{new Date(doc.created_at).toLocaleDateString()}</span>
                                    {doc.uploaded_by && <span className="text-xs text-gray-400 flex-shrink-0">上传人: {doc.uploaded_by}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                                  {canPreview && (
                                    <button
                                      onClick={() => handlePreviewDocument(doc.id, doc.original_name)}
                                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                      title="预览"
                                    >
                                      <EyeIcon className="h-5 w-5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDownloadDocument(doc.id)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    title="下载"
                                  >
                                    <DocumentArrowDownIcon className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDocument(doc.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="删除"
                                  >
                                    <TrashIcon className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 售后中心标签页 */}
            {activeTab === 'after-sales' && (
              <div className="space-y-4 3xl:space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">售后与版本迭代</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 3xl:gap-6">
                  {/* 历史故障问题 */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-500" />
                      历史故障问题 ({issues.length})
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {[...issues].sort((a, b) => {
                        const statusOrder: Record<string, number> = { 'open': 0, 'in_progress': 1, 'closed': 2 };
                        return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
                      }).map(issue => (
                        <div
                          key={issue.id}
                          className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 cursor-pointer transition-colors"
                          onClick={() => navigate(`/issues/${issue.id}`)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              {(issue as any).module_category && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">
                                  {(issue as any).module_category}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                                issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                issue.status === 'open' ? 'bg-red-50 text-red-600' :
                                issue.status === 'in_progress' ? 'bg-orange-50 text-orange-600' :
                                'bg-green-50 text-green-600'
                              }`}>
                                {issue.status === 'open' ? '待处理' : issue.status === 'in_progress' ? '处理中' : '已关闭'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">{new Date(issue.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-800 line-clamp-2">{issue.description}</p>
                          <div className="mt-2 flex justify-end">
                            <span className="text-xs text-blue-600 hover:underline">查看详情 →</span>
                          </div>
                        </div>
                      ))}
                      {issues.length === 0 && (
                        <p className="text-center py-8 text-sm text-gray-400">暂无故障记录</p>
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
                            <span className="text-xs font-bold text-purple-600">{upgrade.module_type || '模块'}</span>
                            <span className="text-xs text-gray-400">{upgrade.release_date ? new Date(upgrade.release_date).toLocaleDateString() : '-'}</span>
                          </div>
                          <div className="mt-1 flex items-center space-x-2 text-xs">
                            {upgrade.old_version && (
                              <>
                                <span className="font-mono text-gray-400">{upgrade.old_version}</span>
                                <span className="text-gray-400">→</span>
                              </>
                            )}
                            <span className="font-mono font-bold text-blue-600">{upgrade.version_number}</span>
                          </div>
                          <p className="mt-2 text-xs text-gray-600">{upgrade.description || '-'}</p>
                          {upgrade.updated_by && <p className="mt-1 text-xs text-gray-400">操作人: {upgrade.updated_by}</p>}
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
            <div className="flex items-center justify-between p-4 3xl:p-6 border-b border-gray-200">
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
            <div className="p-4 3xl:p-6 overflow-y-auto max-h-[60vh]">
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
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-4 py-3 3xl:px-6 3xl:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                {(selectedModuleForVersion as any).current_version ? '版本更新登记' : '设置出厂版本'} - {selectedModuleForVersion.module_type}
              </h3>
              <button
                onClick={() => {
                  setShowVersionUpdateForm(false);
                  setSelectedModuleForVersion(null);
                  setSelectedReleaseForVersion(null);
                  setSopTemplate(null);
                  setChecklistItems([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 3xl:p-6 space-y-5 overflow-y-auto flex-1">
              {/* 版本库必选区 */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <label className="block text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <TagIcon className="h-4 w-4" /> 从发布库勾选正式版本 (必选)
                </label>
                {moduleReleases.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-500">
                    暂无可选版本，请先前往<span className="font-semibold text-blue-600">版本发布中心</span>添加版本
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {moduleReleases.map((rel) => (
                      <label key={rel.id} className={`flex items-center justify-between p-2 bg-white rounded border cursor-pointer transition-colors group ${
                        selectedReleaseForVersion?.id === rel.id
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-blue-200 hover:bg-blue-50'
                      }`}>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="releaseSelection"
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            checked={selectedReleaseForVersion?.id === rel.id}
                            onChange={() => setSelectedReleaseForVersion(rel)}
                          />
                          <span className="ml-3 text-sm font-bold font-mono text-gray-900">{rel.version_number}</span>
                        </div>
                        <span className="text-xs text-gray-500 group-hover:text-blue-600">{rel.title}</span>
                      </label>
                    ))}
                  </div>
                )}
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

              {/* 版本更新检查项（仅迭代更新时显示，出厂版本不需要） */}
              {checklistItems.length > 0 && !!(selectedModuleForVersion as any).current_version && (
                <SOPChecklistSection
                  items={checklistItems}
                  onChange={setChecklistItems}
                />
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowVersionUpdateForm(false);
                    setSelectedModuleForVersion(null);
                    setSelectedReleaseForVersion(null);
                    setSopTemplate(null);
                    setChecklistItems([]);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const descriptionInput = document.getElementById('versionDescription') as HTMLTextAreaElement;
                    const updatedByInput = document.getElementById('updatedBy') as HTMLInputElement;

                    const description = descriptionInput.value.trim();
                    const updated_by = updatedByInput.value.trim();

                    if (!selectedReleaseForVersion) {
                      alert('请从发布库中选择一个版本');
                      return;
                    }

                    if (!updated_by) {
                      alert('请填写更新执行人');
                      return;
                    }

                    if (!description || description.length < 5) {
                      alert('说明过短，请提供更详细的执行记录');
                      return;
                    }

                    const pendingRequired = checklistItems.filter(
                      i => i.required && i.status === 'pending'
                    ).length;
                    if (pendingRequired > 0) {
                      alert(`请先确认 ${pendingRequired} 项必填检查项`);
                      return;
                    }

                    handleVersionUpdateSubmit({
                      version_number: selectedReleaseForVersion.version_number,
                      release_id: selectedReleaseForVersion.id,
                      description,
                      updated_by,
                      checklist: checklistItems.length > 0 ? checklistItems : undefined,
                    });
                  }}
                  disabled={moduleReleases.length === 0 || versionSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {versionSubmitting
                    ? '上传中...'
                    : checklistItems.filter(i => i.required && i.status === 'pending').length > 0
                      ? `${checklistItems.filter(i => i.required && i.status === 'pending').length} 项待确认`
                      : '确认并保存记录'
                  }
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
            <div className="flex items-center justify-between p-4 3xl:p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">添加问题</h3>
              <button
                onClick={handleCloseIssueForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 3xl:p-6">
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
                        <option key={module.id} value={module.id.toString()}>
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
            <div className="flex items-center justify-between p-4 3xl:p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">解决问题</h3>
              <button
                onClick={handleCloseResolveForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 3xl:p-6">
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

      {/* 设备出厂资料上传弹窗 (批量) */}
      {showDocUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 3xl:px-6 3xl:py-4 border-b border-gray-200 bg-green-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ArrowUpTrayIcon className="h-5 w-5 text-green-600" />
                批量上传出厂资料
              </h3>
              <button
                onClick={resetDocUploadForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 文件拖拽区域 (多文件) */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  docDragOver
                    ? 'border-green-400 bg-green-50'
                    : docUploadFiles.length > 0
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDocDragOver(true); }}
                onDragLeave={() => setDocDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDocDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const newFiles = Array.from(e.dataTransfer.files);
                    setDocUploadFiles(prev => [...prev, ...newFiles]);
                  }
                }}
              >
                {docUploadFiles.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {docUploadFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white rounded-md px-3 py-1.5 border border-gray-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <DocumentIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-900 truncate">{(file as any).webkitRelativePath || file.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                        </div>
                        <button
                          onClick={() => setDocUploadFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0"
                        >
                          <XCircleIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <label className="inline-flex items-center px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-medium text-green-600 hover:bg-gray-50 cursor-pointer mt-1">
                      继续添加文件
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) {
                            setDocUploadFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <label className="inline-flex items-center px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-medium text-blue-600 hover:bg-gray-50 cursor-pointer mt-1">
                      <FolderIcon className="h-3.5 w-3.5 mr-1" />
                      添加文件夹
                      <input
                        type="file"
                        className="hidden"
                        {...({ webkitdirectory: '', multiple: true } as any)}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setDocUploadFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">拖拽文件到此处，或</p>
                    <div className="mt-1 flex items-center justify-center gap-2 flex-wrap">
                      <label className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-green-600 hover:bg-gray-50 cursor-pointer">
                        选择文件（可多选）
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              setDocUploadFiles(Array.from(e.target.files));
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <label className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-blue-600 hover:bg-gray-50 cursor-pointer">
                        <FolderIcon className="h-4 w-4 mr-1" />
                        选择文件夹
                        <input
                          type="file"
                          className="hidden"
                          {...({ webkitdirectory: '', multiple: true } as any)}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setDocUploadFiles(Array.from(e.target.files));
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">支持批量选择文件或整个文件夹，每个文件最大 50MB</p>
                  </>
                )}
              </div>

              {/* 分类选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  资料分类 <span className="text-red-500">*</span>
                </label>
                {deviceDocCategories.length > 0 && (
                  <select
                    value={docUploadCategory}
                    onChange={(e) => {
                      setDocUploadCategory(e.target.value);
                      if (e.target.value) setDocUploadNewCategory('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm mb-2"
                  >
                    <option value="">-- 选择已有分类 --</option>
                    {deviceDocCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={docUploadNewCategory}
                  onChange={(e) => {
                    setDocUploadNewCategory(e.target.value);
                    if (e.target.value) setDocUploadCategory('');
                  }}
                  placeholder={deviceDocCategories.length > 0 ? '或输入新分类名称' : '输入分类名称'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>

              {/* 上传者 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">上传者</label>
                <input
                  type="text"
                  value={docUploadBy}
                  onChange={(e) => setDocUploadBy(e.target.value)}
                  placeholder="输入上传者姓名（选填）"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="px-4 py-3 3xl:px-6 3xl:py-4 border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {docUploadFiles.length > 0 ? `已选择 ${docUploadFiles.length} 个文件` : ''}
              </span>
              <div className="flex space-x-3">
                <button
                  onClick={resetDocUploadForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleDocUpload}
                  disabled={docUploadFiles.length === 0 || (!docUploadCategory && !docUploadNewCategory.trim())}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  开始上传 {docUploadFiles.length > 0 ? `(${docUploadFiles.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 后台上传进度悬浮面板 */}
      {bgUpload && (
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 w-72 overflow-hidden">
          <div
            className={`h-1.5 transition-all duration-300 ${bgUpload.error ? 'bg-red-500' : bgUpload.done ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${bgUpload.progress}%` }}
          />
          <div className="px-4 py-3 flex items-start gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${bgUpload.error ? 'bg-red-100' : bgUpload.done ? 'bg-green-100' : 'bg-blue-50'}`}>
              {bgUpload.error ? (
                <XCircleIcon className="h-5 w-5 text-red-500" />
              ) : bgUpload.done ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              ) : (
                <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {bgUpload.error ? '上传失败' : bgUpload.done ? '上传完成' : '正在上传...'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {bgUpload.error
                  ? bgUpload.error
                  : bgUpload.done
                  ? `${bgUpload.fileCount} 个文件已成功上传`
                  : `${bgUpload.fileCount} 个文件 · ${bgUpload.progress}%`}
              </p>
              {!bgUpload.error && !bgUpload.done && (
                <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${bgUpload.progress}%` }}
                  />
                </div>
              )}
            </div>
            {(bgUpload.done || bgUpload.error) && (
              <button onClick={() => setBgUpload(null)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
                <XCircleIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 文件预览弹窗 */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setPreviewDoc(null)}>
          <div className="relative max-w-5xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between bg-gray-900 px-4 py-2 rounded-t-lg">
              <span className="text-white text-sm truncate">{previewDoc.title}</span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            {/* 预览内容 */}
            <div className="bg-white rounded-b-lg overflow-auto flex-1 flex items-center justify-center" style={{ maxHeight: 'calc(90vh - 48px)' }}>
              {previewDoc.type === 'image' ? (
                <img src={previewDoc.url} alt={previewDoc.title} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={previewDoc.url} title={previewDoc.title} className="w-full h-full min-h-[80vh]" />
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DeviceDetail;
