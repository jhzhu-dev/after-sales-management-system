import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PrinterIcon,
  DocumentIcon,
  ArrowUpTrayIcon,
  FolderIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { DeviceBundle } from '../types';
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
  const [bgUpload, setBgUpload] = useState<{ fileCount: number; progress: number; done: boolean; error: string | null; statusText?: string; failedFiles?: string[]; skippedCount?: number } | null>(null);
  const [docSelectMode, setDocSelectMode] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<{
    url: string; title: string; type: string;
    docId: number; originalName: string;
    catDocs: any[]; catIndex: number; loading: boolean;
  } | null>(null);

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

  // 文档树控制：记录哪些文件夹已展开（默认全部折叠）
  const [expandedDocFolders, setExpandedDocFolders] = useState<Set<string>>(new Set());

  // 构建文档树（支持 title 中以 '/' 分隔的子目录）
  interface DocTreeNode {
    name: string;
    isFile: boolean;
    doc?: any;
    docIndex?: number;
    children: DocTreeNode[];
    path: string;
  }

  function buildDocTree(docs: any[]): DocTreeNode[] {
    const root: DocTreeNode = { name: '', isFile: false, children: [], path: '' };
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const rawTitle = (doc.title || '').trim();
      const parts = rawTitle ? rawTitle.split('/').filter(Boolean) : [];
      const fileName = doc.original_name || (parts.length > 0 ? parts[parts.length - 1] : `file_${doc.id}`);
      if (parts.length <= 1) {
        root.children.push({ name: fileName, isFile: true, doc, docIndex: i, children: [], path: rawTitle });
      } else {
        let node = root;
        for (let j = 0; j < parts.length - 1; j++) {
          let child = node.children.find(c => !c.isFile && c.name === parts[j]);
          if (!child) {
            child = { name: parts[j], isFile: false, children: [], path: parts.slice(0, j + 1).join('/') };
            node.children.push(child);
          }
          node = child;
        }
        node.children.push({ name: fileName, isFile: true, doc, docIndex: i, children: [], path: rawTitle });
      }
    }
    return root.children;
  }

  const renderDocTreeNodes = (nodes: DocTreeNode[], depth: number, catDocs: any[]): React.ReactNode => {
    return nodes.map(node => {
      if (node.isFile) {
        const doc = node.doc!;
        const docIdx = node.docIndex!;
        const ext = (doc.original_name || '').split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
        const isPdf = ext === 'pdf';
        const canPreview = isImage || isPdf;
        return (
          <div
            key={doc.id}
            style={{ marginLeft: `${depth * 16}px` }}
            className={`bg-white p-3 rounded-lg shadow-sm border flex items-center justify-between transition-colors ${selectedDocIds.has(doc.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-green-200'}`}
          >
            {docSelectMode && (
              <input
                type="checkbox"
                checked={selectedDocIds.has(doc.id)}
                onChange={() => toggleDocSelect(doc.id)}
                className="w-4 h-4 text-blue-600 rounded flex-shrink-0 mr-2"
              />
            )}
            <div
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
              onClick={() => docSelectMode ? toggleDocSelect(doc.id) : handlePreviewDoc(doc, catDocs, docIdx)}
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
                <span className="text-sm font-medium text-gray-900 truncate">{node.name}</span>
                {canPreview && <span className="text-xs text-green-500 font-normal flex-shrink-0">可预览</span>}
                {doc.file_size ? <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(doc.file_size)}</span> : null}
                {doc.created_at && <span className="text-xs text-gray-400 flex-shrink-0">{new Date(doc.created_at).toLocaleDateString()}</span>}
                {doc.uploaded_by && <span className="text-xs text-gray-400 flex-shrink-0">上传人: {doc.uploaded_by}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-4">
              <button
                onClick={() => handlePreviewDoc(doc, catDocs, docIdx)}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                title="阅览"
              >
                <EyeIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDownloadDoc(doc)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                title="下载"
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDeleteDoc(doc.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="删除"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        );
      } else {
        const folderKey = node.path;
        const isCollapsed = !expandedDocFolders.has(folderKey);
        const fileCount = (function countFiles(n: DocTreeNode): number {
          return n.isFile ? 1 : n.children.reduce((s, c) => s + countFiles(c), 0);
        })(node);
        return (
          <div key={node.path} style={{ marginLeft: `${depth * 16}px` }}>
            <button
              onClick={() => setExpandedDocFolders(prev => {
                const next = new Set(prev);
                if (next.has(folderKey)) next.delete(folderKey); else next.add(folderKey);
                return next;
              })}
              className="flex items-center gap-1.5 py-1.5 px-2 w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <FolderIcon className="h-4 w-4 text-yellow-500 flex-shrink-0" />
              <span>{node.name}</span>
              <span className="text-xs text-gray-400 ml-1">({fileCount})</span>
              {isCollapsed
                ? <ChevronRightIcon className="h-3 w-3 text-gray-400 ml-auto" />
                : <ChevronDownIcon className="h-3 w-3 text-gray-400 ml-auto" />
              }
            </button>
            {!isCollapsed && (
              <div className="mt-1 space-y-2">
                {renderDocTreeNodes(node.children, depth + 1, catDocs)}
              </div>
            )}
          </div>
        );
      }
    });
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
    const isLast = bundle.devices && bundle.devices.length === 1;
    const confirmMsg = isLast
      ? '移出最后一台设备后，该多合一组合会整体移除，是否继续？'
      : '确定要从多合一设备中移除该设备吗？';
    if (window.confirm(confirmMsg)) {
      try {
        await bundleApi.removeDevice(bundleId, deviceId);
        if (isLast) {
          await bundleApi.deleteBundle(bundleId);
          navigate('/devices?view=bundles');
        } else {
          await fetchBundle();
        }
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
    setBgUpload({ fileCount: filesToUpload.length, progress: 0, done: false, error: null, statusText: '正在检查已存在文件...' });

    try {
      // ── Phase A: 去重检查 ──────────────────────────────────────
      const existsFlags: boolean[] = new Array(filesToUpload.length).fill(false);
      try {
        const CHECK_BATCH = 500;
        for (let ci = 0; ci < filesToUpload.length; ci += CHECK_BATCH) {
          const batch = filesToUpload.slice(ci, ci + CHECK_BATCH);
          const { data: checkResult } = await api.post('/device-documents/check-exists', {
            bundle_id: bundleId,
            category,
            files: batch.map(f => ({
              relativePath: (f as any).webkitRelativePath || f.name,
              originalName: f.name,
            })),
          });
          if (checkResult.success && Array.isArray(checkResult.exists)) {
            checkResult.exists.forEach((e: boolean, j: number) => { existsFlags[ci + j] = e; });
          }
        }
      } catch (checkErr) {
        console.warn('去重检查失败，将继续上传全部文件:', checkErr);
      }

      const toUpload = filesToUpload.filter((_, i) => !existsFlags[i]);
      const skippedCount = filesToUpload.length - toUpload.length;

      if (toUpload.length === 0) {
        setBgUpload(prev => prev ? { ...prev, done: true, progress: 100, skippedCount, statusText: undefined } : prev);
        await fetchDocuments();
        setTimeout(() => setBgUpload(null), 3500);
        return;
      }

      setBgUpload(prev => prev ? { ...prev, skippedCount, statusText: '正在上传...' } : prev);

      // ── Phase B: 3批并行上传，每批最多50文件 ──────────────────
      const BATCH_SIZE = 50;
      const PARALLEL_BATCHES = 3;
      const batches: File[][] = [];
      for (let bi = 0; bi < toUpload.length; bi += BATCH_SIZE) {
        batches.push(toUpload.slice(bi, bi + BATCH_SIZE));
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

      // ── Phase C: 完成 ─────────────────────────────────────────
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

  const handlePreviewDoc = async (doc: any, catDocs: any[] = [], catIndex: number = 0) => {
    const ext = (doc.original_name || '').split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
    const isPdf = ext === 'pdf';
    if (!isImage && !isPdf) {
      setPreviewDoc({ url: '', title: doc.original_name, type: 'other', docId: doc.id, originalName: doc.original_name, catDocs, catIndex, loading: false });
      return;
    }
    setPreviewDoc(prev => {
      const base = { url: '', title: doc.original_name, type: isImage ? 'image' : 'pdf', docId: doc.id, originalName: doc.original_name, catDocs, catIndex, loading: true };
      return prev ? { ...prev, ...base } : base;
    });
    try {
      const { data: result } = await api.get(`/device-documents/${doc.id}/preview`);
      if (result.success) {
        let url = result.data.url;
        if (url.startsWith('/api/') || url.startsWith('/uploads/')) {
          const token = localStorage.getItem('auth_token');
          url = `${url}${url.includes('?') ? '&' : '?'}token=${token}`;
        }
        setPreviewDoc({ url, title: result.data.title || doc.original_name, type: isImage ? 'image' : 'pdf', docId: doc.id, originalName: doc.original_name, catDocs, catIndex, loading: false });
      } else {
        setPreviewDoc(prev => prev ? { ...prev, loading: false, type: 'other' } : null);
      }
    } catch (error) {
      console.error('预览失败:', error);
      setPreviewDoc(prev => prev ? { ...prev, loading: false, type: 'other' } : null);
    }
  };

  // 键盘导航（←/→/Esc）
  useEffect(() => {
    if (!previewDoc) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPreviewDoc(null); return; }
      if (previewDoc.catDocs.length <= 1) return;
      let newIdx = previewDoc.catIndex;
      if (e.key === 'ArrowLeft') newIdx = (previewDoc.catIndex - 1 + previewDoc.catDocs.length) % previewDoc.catDocs.length;
      else if (e.key === 'ArrowRight') newIdx = (previewDoc.catIndex + 1) % previewDoc.catDocs.length;
      if (newIdx !== previewDoc.catIndex) {
        handlePreviewDoc(previewDoc.catDocs[newIdx], previewDoc.catDocs, newIdx);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewDoc]);

  const handleDownloadDoc = (doc: any) => {
    const token = localStorage.getItem('auth_token');
    window.open(`/api/device-documents/${doc.id}/download?token=${token}`, '_blank');
  };

  const handleDownloadCategory = (cat: string) => {
    const token = localStorage.getItem('auth_token');
    const a = document.createElement('a');
    a.href = `/api/device-documents/download-category?bundle_id=${bundleId}&category=${encodeURIComponent(cat)}&token=${token}`;
    const bundleName = (bundle?.name || bundle?.bundle_code || `多合一_${bundleId}`).replace(/[\\/:*?"<>|]/g, '_');
    const safeCat = (cat || '分类').replace(/[\\/:*?"<>|]/g, '_');
    a.download = `${bundleName}_${safeCat}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleDocSelect = (docId: number) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleSelectAllDocs = () => {
    if (selectedDocIds.size === documents.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(documents.map((d: any) => d.id)));
    }
  };

  const handleBatchDeleteDocs = async () => {
    if (selectedDocIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedDocIds.size} 个文件吗？`)) return;
    try {
      const { data: result } = await api.post('/device-documents/batch-delete', { ids: Array.from(selectedDocIds) });
      if (result.success) {
        setSelectedDocIds(new Set());
        setDocSelectMode(false);
        await fetchDocuments();
      } else {
        alert(result.error || '批量删除失败');
      }
    } catch (error: any) {
      console.error('批量删除失败:', error);
      alert(error?.response?.data?.error || '批量删除失败');
    }
  };

  const handleBatchDownloadDocs = async () => {
    if (selectedDocIds.size === 0) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/device-documents/batch-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedDocIds) }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(err.error || '批量下载失败');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const bundleName = (bundle?.name || bundle?.bundle_code || `多合一_${bundleId}`).replace(/[\\/:*?"<>|]/g, '_');
      a.download = `${bundleName}_出厂资料.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('批量下载失败:', error);
      alert('批量下载失败');
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
    { key: 'device_code', label: '设备编码' },
    { key: 'product_name', label: '产品名称' },
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
            <button onClick={() => navigate('/devices?view=bundles')} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors no-print">
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              返回设备列表
            </button>
            <div>
              <h1 className="text-2xl 3xl:text-3xl font-bold text-gray-900">
                {bundle.name || bundle.bundle_code}
              </h1>
              {bundle.name && (
                <div className="text-sm text-gray-500 mt-0.5">订单号: {bundle.bundle_code}</div>
              )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 行1: 多合一设备订单号 | 客户 | 设备数量 */}
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
            {/* 行2: 设备状态汇总（2列）| 备注 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">设备状态汇总</label>
              <div className="flex flex-wrap gap-2 mt-0.5">
                {bundle.devices && bundle.devices.length > 0 ? (() => {
                  const counts: Record<string, number> = {};
                  bundle.devices!.forEach((d: any) => { counts[d.status] = (counts[d.status] || 0) + 1; });
                  return Object.entries(counts).map(([status, count]) => (
                    <span key={status} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                      {status} × {count}
                    </span>
                  ));
                })() : <span className="text-gray-400 text-sm">暂无设备</span>}
              </div>
            </div>
            <div title={bundle.description || ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
              <p className="text-gray-600 truncate" title={bundle.description || ''}>{bundle.description || '-'}</p>
            </div>
            {/* 倒数第三行: 远程码 | 远程密码 | （空） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">远程码</label>
              <p className="text-lg">
                {bundle.remote_code ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-mono font-medium bg-white text-blue-600 border border-blue-200">
                    {bundle.remote_code.includes(' ') ? bundle.remote_code : bundle.remote_code.replace(/(\d{3})(?=\d)/g, '$1 ')}
                  </span>
                ) : '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">远程密码</label>
              <p className="text-lg">
                {bundle.password ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-mono font-medium bg-gray-50 text-gray-700 border border-gray-200">
                    {bundle.password}
                  </span>
                ) : '-'}
              </p>
            </div>
            <div />
            {/* 倒数第二行: 商户号 | 商户密码 | （空） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商户号</label>
              <p className="text-lg">
                {bundle.merchant_id ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-mono font-medium bg-gray-50 text-gray-700 border border-gray-200">
                    {bundle.merchant_id}
                  </span>
                ) : '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商户密码</label>
              <p className="text-lg">
                {bundle.merchant_password ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-mono font-medium bg-gray-50 text-gray-700 border border-gray-200">
                    {bundle.merchant_password}
                  </span>
                ) : '-'}
              </p>
            </div>
            <div />
            {/* 倒数第一行: 创建时间 | 更新时间 | （空） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">创建时间</label>
              <p className="text-lg">{formatDate(bundle.created_at, 'yyyy-MM-dd')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">更新时间</label>
              <p className="text-lg">{formatDate(bundle.updated_at, 'yyyy-MM-dd')}</p>
            </div>
            <div />
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备编码</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">简称</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">产品名称</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商户号</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商户密码</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">待解决问题</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase no-print">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bundle.devices && bundle.devices.length > 0 ? bundle.devices.map((device: any) => (
                        <tr key={device.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/devices/${device.id}?from=bundle&bundleId=${id}`)}>  
                          <td className="px-4 py-3">
                            <span className="text-blue-600 font-mono font-medium">
                              {device.id}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{device.device_code || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{device.nickname || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{device.product_name || '-'}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-700">{bundle.merchant_id || '-'}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-700">{bundle.merchant_password || '-'}</td>
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
                          <td className="px-4 py-3 no-print" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleRemoveDevice(device.id)}
                              className="text-xs text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 rounded px-2 py-1 transition-colors"
                            >
                              移出
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">暂无成员设备</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 出厂资料 Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center no-print">
                  <h3 className="text-base font-medium text-gray-900">多合一设备出厂资料</h3>
                  <div className="flex items-center gap-2">
                    {documents.length > 0 && (
                      <button
                        onClick={() => { const entering = !docSelectMode; setDocSelectMode(entering); setSelectedDocIds(new Set()); if (entering) setExpandedCategories(new Set(docCategories)); }}
                        className={`flex items-center gap-1 px-3 py-2 rounded-md transition-colors text-sm ${
                          docSelectMode ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {docSelectMode ? '取消选择' : '批量管理'}
                      </button>
                    )}
                    <button
                      onClick={() => setShowDocUploadModal(true)}
                      className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
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
                        checked={selectedDocIds.size === documents.length && documents.length > 0}
                        onChange={toggleSelectAllDocs}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      全选
                    </label>
                    <span className="text-sm text-gray-500">已选 {selectedDocIds.size} / {documents.length}</span>
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

                {documents.length === 0 ? (
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
                    {docCategories.map(cat => {
                      const docs = (groupedDocs[cat] || []) as any[];
                      if (docs.length === 0) return null;
                      const isExpanded = expandedCategories.has(cat);
                      const catSelectedCount = docs.filter((d: any) => selectedDocIds.has(d.id)).length;
                      const catAllSelected = catSelectedCount === docs.length && docs.length > 0;
                      const catSomeSelected = catSelectedCount > 0 && catSelectedCount < docs.length;
                      return (
                        <div key={cat} className={`bg-gray-50 rounded-xl border overflow-hidden ${catAllSelected ? 'border-blue-400' : catSomeSelected ? 'border-blue-200' : 'border-gray-200'}`}>
                          <div className="flex items-center">
                            {docSelectMode && (
                              <label className="flex items-center pl-3 cursor-pointer flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  ref={(el) => { if (el) el.indeterminate = catSomeSelected; }}
                                  checked={catAllSelected}
                                  onChange={() => {
                                    setSelectedDocIds(prev => {
                                      const next = new Set(prev);
                                      if (catAllSelected || catSomeSelected) {
                                        docs.forEach((d: any) => next.delete(d.id));
                                      } else {
                                        docs.forEach((d: any) => next.add(d.id));
                                      }
                                      return next;
                                    });
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                              </label>
                            )}
                            <button
                              onClick={() => toggleCategory(cat)}
                              className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors text-left"
                            >
                              <span className="font-semibold text-gray-900 flex items-center">
                                <FolderIcon className="h-5 w-5 mr-2 text-green-500" />
                                {cat} ({docs.length})
                                {docSelectMode && catSelectedCount > 0 && (
                                  <span className="ml-2 text-xs font-normal text-blue-600">已选 {catSelectedCount}</span>
                                )}
                              </span>
                              {isExpanded
                                ? <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                : <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              }
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadCategory(cat); }}
                              className="flex items-center gap-1 px-3 py-3 text-blue-600 hover:bg-blue-50 transition-colors text-xs font-medium flex-shrink-0 border-l border-gray-200"
                              title={`下载 ${cat} 下所有文件`}
                            >
                              <DocumentArrowDownIcon className="h-4 w-4" />
                              下载全部
                            </button>
                          </div>
                            {isExpanded && (
                            <div className="px-4 pb-4">
                              <div className="space-y-2 pt-2">
                                {renderDocTreeNodes(buildDocTree(docs), 0, docs)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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

      {/* 文件阅览器 */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50" onClick={() => setPreviewDoc(null)}>
          <div
            className="relative w-full mx-4 flex flex-col bg-gray-900 rounded-xl overflow-hidden shadow-2xl"
            style={{ maxWidth: '1100px', maxHeight: '92vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶部工具栏 */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700 flex-shrink-0">
              <DocumentIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-white text-sm font-medium truncate flex-1">{previewDoc.title}</span>
              {previewDoc.catDocs.length > 1 && (
                <span className="text-gray-400 text-xs flex-shrink-0 bg-gray-700 px-2 py-0.5 rounded">
                  {previewDoc.catIndex + 1} / {previewDoc.catDocs.length}
                </span>
              )}
              <button
                onClick={() => handleDownloadDoc({ id: previewDoc.docId, original_name: previewDoc.originalName })}
                className="flex items-center gap-1 text-gray-300 hover:text-white text-xs transition-colors flex-shrink-0 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                title="下载文件"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                下载
              </button>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                title="关闭 (Esc)"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>

            {/* 主内容区 + 左右导航 */}
            <div className="flex items-stretch flex-1 min-h-0" style={{ minHeight: '55vh' }}>
              {previewDoc.catDocs.length > 1 && (
                <button
                  onClick={() => {
                    const newIdx = (previewDoc.catIndex - 1 + previewDoc.catDocs.length) % previewDoc.catDocs.length;
                    handlePreviewDoc(previewDoc.catDocs[newIdx], previewDoc.catDocs, newIdx);
                  }}
                  className="flex-shrink-0 w-12 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white hover:bg-opacity-10 transition-colors"
                  title="上一个 (←)"
                >
                  <ChevronLeftIcon className="h-8 w-8" />
                </button>
              )}

              <div className="flex-1 min-w-0 flex items-center justify-center overflow-auto bg-gray-800">
                {previewDoc.loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm">加载中...</span>
                  </div>
                ) : previewDoc.type === 'image' ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    className="max-w-full max-h-full object-contain p-2"
                    style={{ maxHeight: 'calc(92vh - 160px)' }}
                  />
                ) : previewDoc.type === 'pdf' ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.title}
                    className="w-full border-0"
                    style={{ height: 'calc(92vh - 160px)' }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 py-16">
                    <DocumentIcon className="h-16 w-16 text-gray-500" />
                    <p className="text-gray-400 text-sm">{previewDoc.originalName}</p>
                    <p className="text-gray-500 text-xs">该文件类型不支持预览</p>
                    <button
                      onClick={() => handleDownloadDoc({ id: previewDoc.docId, original_name: previewDoc.originalName })}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm mt-2"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4" />
                      下载文件
                    </button>
                  </div>
                )}
              </div>

              {previewDoc.catDocs.length > 1 && (
                <button
                  onClick={() => {
                    const newIdx = (previewDoc.catIndex + 1) % previewDoc.catDocs.length;
                    handlePreviewDoc(previewDoc.catDocs[newIdx], previewDoc.catDocs, newIdx);
                  }}
                  className="flex-shrink-0 w-12 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white hover:bg-opacity-10 transition-colors"
                  title="下一个 (→)"
                >
                  <ChevronRightIcon className="h-8 w-8" />
                </button>
              )}
            </div>

            {/* 缩略图条 */}
            {previewDoc.catDocs.length > 1 && (
              <div className="flex-shrink-0 border-t border-gray-700 px-3 py-2 overflow-x-auto">
                <div className="flex gap-1.5">
                  {previewDoc.catDocs.map((d: any, i: number) => {
                    const tExt = (d.original_name || '').split('.').pop()?.toLowerCase() || '';
                    const tIsImg = ['jpg','jpeg','png','gif','bmp','webp','svg'].includes(tExt);
                    const tIsPdf = tExt === 'pdf';
                    const token = localStorage.getItem('auth_token');
                    return (
                      <button
                        key={d.id}
                        onClick={() => handlePreviewDoc(d, previewDoc.catDocs, i)}
                        className={`flex-shrink-0 w-14 h-14 rounded overflow-hidden border-2 transition-colors ${
                          i === previewDoc.catIndex ? 'border-blue-400' : 'border-gray-600 hover:border-gray-400'
                        }`}
                        title={d.original_name}
                      >
                        {tIsImg ? (
                          <img src={`/api/device-documents/${d.id}/download?token=${token}`} loading="lazy" className="w-full h-full object-cover" alt={d.original_name} />
                        ) : (
                          <div className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${tIsPdf ? 'bg-red-900' : 'bg-gray-700'}`}>
                            <DocumentIcon className="h-5 w-5 text-gray-300" />
                            {tIsPdf && <span className="text-xs text-red-300 font-bold leading-none">PDF</span>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default BundleDetail;
