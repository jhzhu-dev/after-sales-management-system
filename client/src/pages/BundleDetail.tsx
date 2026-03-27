import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  PrinterIcon,
  DocumentIcon,
  ArrowUpTrayIcon,
  FolderIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { DeviceBundle, Device } from '../types';
import { bundleApi } from '../services/api';
import api from '../services/api';
import Layout from '../components/Layout';
import BundleForm from '../components/BundleForm';
import ExportButton from '../components/ExportButton';
import { exportToExcel } from '../utils/exportUtils';
import { formatDate, getStatusColor } from '../utils';

const BundleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bundleId = Number(id);

  const [bundle, setBundle] = useState<DeviceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'devices' | 'documents'>('devices');
  const [showBundleForm, setShowBundleForm] = useState(false);

  // 出厂资料状态
  const [documents, setDocuments] = useState<any[]>([]);
  const [docCategories, setDocCategories] = useState<string[]>([]);
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [docUploadFiles, setDocUploadFiles] = useState<File[]>([]);
  const [docUploadCategory, setDocUploadCategory] = useState('');
  const [docUploadNewCategory, setDocUploadNewCategory] = useState('');
  const [docUploadBy, setDocUploadBy] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [docDragOver, setDocDragOver] = useState(false);
  const [bgUpload, setBgUpload] = useState<{ fileCount: number; progress: number; done: boolean; error: string | null; statusText?: string; failedFiles?: string[] } | null>(null);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const resetDocUploadForm = () => {
    setShowDocUploadModal(false);
    setDocUploadFiles([]);
    setDocUploadCategory('');
    setDocUploadNewCategory('');
    setDocUploadBy('');
    setDocDragOver(false);
  };

  const fetchBundle = useCallback(async () => {
    if (!bundleId) return;
    try {
      setLoading(true);
      const response = await bundleApi.getBundle(bundleId);
      if (response.success) {
        setBundle(response.data);
      } else {
        navigate('/devices?view=bundles');
      }
    } catch (error) {
      console.error('获取多合一设备详情失败:', error);
      navigate('/devices?view=bundles');
    } finally {
      setLoading(false);
    }
  }, [bundleId, navigate]);

  const fetchDocuments = useCallback(async () => {
    if (!bundleId) return;
    try {
      const { data: result } = await api.get('/device-documents', { params: { bundle_id: bundleId } });
      if (result.success) {
        setDocuments(result.data);
        const cats = [...new Set(result.data.map((d: any) => d.category))] as string[];
        setDocCategories(cats);
      }
    } catch (error) {
      console.error('获取多合一设备资料失败:', error);
    }
  }, [bundleId]);

  useEffect(() => {
    fetchBundle();
    fetchDocuments();
  }, [fetchBundle, fetchDocuments]);

  const handleRemoveDevice = async (deviceId: string) => {
    if (!bundle) return;
    if (bundle.devices && bundle.devices.length <= 2) {
      alert('多合一设备至少需要保留2台设备');
      return;
    }
    if (window.confirm('确定要从多合一设备中移除该设备吗？')) {
      try {
        await bundleApi.removeDevice(bundleId, deviceId);
        await fetchBundle();
      } catch (error) {
        console.error('移除设备失败:', error);
        alert('移除设备失败');
      }
    }
  };

  const handleDocUpload = async () => {
    if (docUploadFiles.length === 0) return;
    const category = docUploadNewCategory.trim() || docUploadCategory;
    if (!category) { alert('请选择或输入分类'); return; }

    const filesToUpload = [...docUploadFiles];
    const uploadedBy = docUploadBy.trim();

    // 关闭弹窗，开启后台上传
    setShowDocUploadModal(false);
    setDocUploadFiles([]);
    setDocUploadCategory('');
    setDocUploadNewCategory('');
    setDocUploadBy('');
    setBgUpload({ fileCount: filesToUpload.length, progress: 0, done: false, error: null, statusText: '正在上传...' });

    try {
      const BATCH_SIZE = 50;
      const PARALLEL_BATCHES = 3;
      const batches: File[][] = [];
      for (let bi = 0; bi < filesToUpload.length; bi += BATCH_SIZE) {
        batches.push(filesToUpload.slice(bi, bi + BATCH_SIZE));
      }

      let completedBatches = 0;
      const failedFiles: string[] = [];

      for (let w = 0; w < batches.length; w += PARALLEL_BATCHES) {
        const windowBatches = batches.slice(w, w + PARALLEL_BATCHES);
        const windowResults = await Promise.all(windowBatches.map(async batch => {
          const formData = new FormData();
          batch.forEach(file => {
            formData.append('files', file);
            const relPath = (file as any).webkitRelativePath as string;
            formData.append('relative_paths', relPath || file.name);
            const pathParts = relPath ? relPath.split('/') : [];
            const titlePath = pathParts.length > 1 ? pathParts.slice(1).join('/') : (relPath || file.name);
            formData.append('titles', titlePath.replace(/\.([^./]+)$/, '').trim() || file.name.replace(/\.([^./]+)$/, '') || file.name);
          });
          formData.append('bundle_id', String(bundleId));
          formData.append('category', category);
          if (uploadedBy) formData.append('uploaded_by', uploadedBy);
          try {
            const { data: result } = await api.post('/device-documents/upload', formData, { timeout: 0 });
            return result;
          } catch (err) {
            return { success: false, errors: batch.map(f => ({ name: f.name })) };
          }
        }));

        completedBatches += windowBatches.length;
        windowResults.forEach(result => {
          if (result?.errors?.length) {
            result.errors.forEach((e: any) => {
              if (failedFiles.length < 50) failedFiles.push(e.name || '未知文件');
            });
          }
        });
        const progress = Math.round((completedBatches / batches.length) * 100);
        setBgUpload(prev => prev ? { ...prev, progress } : prev);
      }

      const hasFailed = failedFiles.length > 0;
      setBgUpload(prev => prev ? {
        ...prev,
        done: true,
        progress: 100,
        statusText: undefined,
        failedFiles: hasFailed ? failedFiles : undefined,
      } : prev);
      await fetchDocuments();
      setTimeout(() => setBgUpload(null), hasFailed ? 8000 : 3500);
    } catch (error) {
      console.error('上传失败:', error);
      setBgUpload(prev => prev ? { ...prev, error: '上传失败，请检查网络后重试' } : prev);
      setTimeout(() => setBgUpload(null), 5000);
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (window.confirm('确定要删除这个文件吗？')) {
      try {
        await api.delete(`/device-documents/${docId}`);
        await fetchDocuments();
      } catch (error) {
        console.error('删除文件失败:', error);
      }
    }
  };

  const handlePreviewDoc = async (doc: any) => {
    try {
      const { data: result } = await api.get(`/device-documents/${doc.id}/preview`);
      if (result.success && result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('预览失败:', error);
    }
  };

  const handleDownloadDoc = async (doc: any) => {
    try {
      const { data: result } = await api.get(`/device-documents/${doc.id}/download`);
      if (result.success && result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handlePrint = () => window.print();

  const handleBundleFormSubmit = async () => {
    await fetchBundle();
    setShowBundleForm(false);
  };

  const handleDelete = async () => {
    if (window.confirm('确定要删除这个多合一设备吗？内部设备不会被删除。')) {
      try {
        await bundleApi.deleteBundle(bundleId);
        navigate('/devices?view=bundles');
      } catch (error) {
        console.error('删除多合一设备失败:', error);
        alert('删除多合一设备失败');
      }
    }
  };

  const DEVICE_EXPORT_COLUMNS = [
    { key: 'id', label: '生产序列号' },
    { key: 'name', label: '订单号' },
    { key: 'product_name', label: '产品名称' },
    { key: 'product_version_number', label: '迭代版本' },
    { key: 'customer_name', label: '客户' },
    { key: 'status', label: '状态' },
  ];

  const handleExportDevices = () => {
    if (!bundle?.devices) return;
    const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
    exportToExcel(bundle.devices as any[], DEVICE_EXPORT_COLUMNS, `多合一设备${bundle.bundle_code}_设备_${timestamp}`);
  };

  // 按分类分组文档
  const groupedDocs = documents.reduce((acc: Record<string, any[]>, doc: any) => {
    const cat = doc.category || '未分类';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      </Layout>
    );
  }

  if (!bundle) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">多合一设备不存在</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 3xl:space-y-6">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/devices?view=bundles')} className="text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl 3xl:text-2xl font-bold text-gray-900">
                多合一设备: {bundle.bundle_code}
                {bundle.name && <span className="text-base font-normal text-gray-500 ml-2">{bundle.name}</span>}
              </h1>
              <div className="text-sm text-gray-500 mt-0.5">
                客户: {bundle.customer_name || '-'}
                {bundle.customer_short_name && <span className="ml-1">({bundle.customer_short_name})</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              打印
            </button>
            <button
              onClick={() => setShowBundleForm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              编辑多合一设备
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              删除
            </button>
          </div>
        </div>

        {/* 基本信息卡片 */}
        <div className="bg-white rounded-lg shadow p-4 3xl:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">多合一设备订单号</label>
              <p className="text-lg font-mono">{bundle.bundle_code}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客户</label>
              <p className="text-lg">
                {bundle.customer_name || '-'}
                {bundle.customer_short_name && <span className="text-sm text-gray-400 ml-2">({bundle.customer_short_name})</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备数量</label>
              <p className="text-lg">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-blue-100 text-blue-800">
                  {bundle.devices?.length || 0} 台
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">创建时间</label>
              <p className="text-lg">{formatDate(bundle.created_at, 'yyyy-MM-dd')}</p>
            </div>
            {bundle.remote_code && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">远程码</label>
                <p className="text-lg">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-mono font-medium bg-white text-blue-600 border border-blue-200">
                    {bundle.remote_code.includes(' ') ? bundle.remote_code : bundle.remote_code.replace(/(\d{3})(?=\d)/g, '$1 ')}
                  </span>
                </p>
              </div>
            )}
            {bundle.password && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <p className="text-lg">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-mono font-medium bg-gray-50 text-gray-700 border border-gray-200">
                    {bundle.password}
                  </span>
                </p>
              </div>
            )}
            {bundle.description && (
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <p className="text-gray-600">{bundle.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tab 栏 */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 no-print">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('devices')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'devices'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                成员设备 ({bundle.devices?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                出厂资料 ({documents.length})
              </button>
            </nav>
          </div>

          <div className="p-4 3xl:p-6">
            {/* 成员设备 Tab */}
            {activeTab === 'devices' && (
              <div>
                <div className="flex justify-between items-center mb-4 no-print">
                  <h3 className="text-base font-medium text-gray-900">成员设备列表</h3>
                  <ExportButton onExport={handleExportDevices} />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">生产序列号</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">简称</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">产品名称</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">迭代版本</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">待解决问题</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bundle.devices && bundle.devices.length > 0 ? bundle.devices.map((device: any) => (
                        <tr key={device.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/devices/${device.id}`)}>
                          <td className="px-4 py-3">
                            <span className="text-blue-600 font-mono font-medium">
                              {device.id}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{device.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{device.nickname || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{device.product_name || '-'}</td>
                          <td className="px-4 py-3">
                            {device.product_version_number ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {device.product_version_number}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(device.status)}`}>
                              {device.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {device.open_issues ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{device.open_issues}</span>
                            ) : <span className="text-sm text-gray-400">0</span>}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">暂无成员设备</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 出厂资料 Tab */}
            {activeTab === 'documents' && (
              <div>
                <div className="flex justify-between items-center mb-4 no-print">
                  <h3 className="text-base font-medium text-gray-900">多合一设备出厂资料</h3>
                  <button
                    onClick={() => setShowDocUploadModal(true)}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                    上传资料
                  </button>
                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <DocumentIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>暂无出厂资料</p>
                    <button
                      onClick={() => setShowDocUploadModal(true)}
                      className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      上传第一份资料
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(groupedDocs).map(([cat, docs]) => (
                      <div key={cat} className="border rounded-lg">
                        <button
                          onClick={() => toggleCategory(cat)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-t-lg"
                        >
                          <div className="flex items-center gap-2">
                            {expandedCategories.has(cat) ? (
                              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                            )}
                            <FolderIcon className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium text-gray-900">{cat}</span>
                            <span className="text-xs text-gray-400">({(docs as any[]).length} 个文件)</span>
                          </div>
                        </button>
                        {expandedCategories.has(cat) && (
                          <div className="divide-y">
                            {(docs as any[]).map((doc: any) => (
                              <div key={doc.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <DocumentIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-900 truncate">{doc.original_name}</span>
                                  {doc.uploaded_by && <span className="text-xs text-gray-400">by {doc.uploaded_by}</span>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => handlePreviewDoc(doc)}
                                    className="p-1 text-blue-600 hover:text-blue-800"
                                    title="预览"
                                  >
                                    <EyeIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadDoc(doc)}
                                    className="p-1 text-green-600 hover:text-green-800"
                                    title="下载"
                                  >
                                    <DocumentArrowDownIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    className="p-1 text-red-600 hover:text-red-800"
                                    title="删除"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 上传资料弹窗 */}
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
              {/* 文件拖拽区域 */}
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
                            const SYSTEM_FILES = /^(\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX.*)$/i;
                            const allFiles = Array.from(e.target.files as FileList);
                            const folderName = (allFiles[0] as any)?.webkitRelativePath?.split('/')[0];
                            const files = allFiles.filter(f => !SYSTEM_FILES.test(f.name));
                            setDocUploadFiles(prev => [...prev, ...(files.length > 0 ? files : allFiles)]);
                            if (folderName && !docUploadCategory && !docUploadNewCategory) {
                              setDocUploadNewCategory(folderName);
                            }
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
                              const SYSTEM_FILES = /^(\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX.*)$/i;
                              const allFiles = Array.from(e.target.files as FileList);
                              const folderName = (allFiles[0] as any)?.webkitRelativePath?.split('/')[0];
                              const files = allFiles.filter(f => !SYSTEM_FILES.test(f.name));
                              setDocUploadFiles(files.length > 0 ? files : allFiles);
                              if (folderName) {
                                setDocUploadNewCategory(folderName);
                                setDocUploadCategory('');
                              }
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">支持批量选择文件或整个文件夹，每个文件最大 200MB</p>
                  </>
                )}
              </div>

              {/* 分类选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  资料分类 <span className="text-red-500">*</span>
                </label>
                {docCategories.length > 0 && (
                  <select
                    value={docUploadCategory}
                    onChange={(e) => {
                      setDocUploadCategory(e.target.value);
                      if (e.target.value) setDocUploadNewCategory('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm mb-2"
                  >
                    <option value="">-- 选择已有分类 --</option>
                    {docCategories.map(cat => (
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
                  placeholder={docCategories.length > 0 ? '或输入新分类名称' : '输入分类名称'}
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

      {/* 后台上传进度浮窗 */}
      {bgUpload && (
        <div className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border w-80 overflow-hidden ${bgUpload.failedFiles?.length ? 'border-yellow-300' : 'border-gray-200'}`}>
          <div
            className={`h-1.5 transition-all duration-300 ${bgUpload.error ? 'bg-red-500' : bgUpload.done ? (bgUpload.failedFiles?.length ? 'bg-yellow-400' : 'bg-green-500') : 'bg-blue-500'}`}
            style={{ width: `${bgUpload.progress}%` }}
          />
          <div className="px-4 py-3 flex items-start gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${bgUpload.error ? 'bg-red-100' : bgUpload.done ? (bgUpload.failedFiles?.length ? 'bg-yellow-100' : 'bg-green-100') : 'bg-blue-50'}`}>
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
                {bgUpload.error ? '上传失败' : bgUpload.done ? (bgUpload.failedFiles?.length ? '部分文件上传失败' : '上传完成') : (bgUpload.statusText || '正在上传...')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {bgUpload.error
                  ? bgUpload.error
                  : bgUpload.done
                  ? `${bgUpload.fileCount} 个文件`
                  : `共 ${bgUpload.fileCount} 个 · ${bgUpload.progress}%`}
              </p>
              {bgUpload.failedFiles?.length ? (
                <div className="mt-1.5 text-xs text-yellow-700 bg-yellow-50 rounded p-1.5">
                  {bgUpload.failedFiles.slice(0, 5).map((name, idx) => (
                    <div key={idx} className="truncate">{name}</div>
                  ))}
                  {bgUpload.failedFiles.length > 5 && (
                    <div className="text-yellow-600">...等 {bgUpload.failedFiles.length - 5} 个文件失败</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 编辑多合一设备弹窗 */}
      {showBundleForm && (
        <BundleForm
          bundle={bundle}
          onClose={() => setShowBundleForm(false)}
          onSubmit={handleBundleFormSubmit}
        />
      )}
    </Layout>
  );
};

export default BundleDetail;
