import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Product, ProductDocument, ProductModule, ModuleType, ProductVersion } from '../types';
import { productModuleApi, moduleTypeApi, productVersionApi } from '../services/api';
import api from '../services/api';
import { PlusIcon, TrashIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, DocumentIcon, XMarkIcon, PrinterIcon, CheckCircleIcon, PencilIcon, EyeIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import ProductVersionForm from '../components/ProductVersionForm';
import AttachmentViewer, { Attachment } from '../components/AttachmentViewer';

const DOC_TYPES = ['规格书', '使用说明', '用户手册', '其他'] as const;

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [documents, setDocuments] = useState<ProductDocument[]>([]);
    const [modules, setModules] = useState<ProductModule[]>([]);
    const [moduleTypes, setModuleTypes] = useState<ModuleType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'docs' | 'modules'>('info');
    const [showModuleForm, setShowModuleForm] = useState(false);
    const [selectedModuleTypes, setSelectedModuleTypes] = useState<number[]>([]);
    const [isRequired, setIsRequired] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // 迭代版本相关状态
    const [versions, setVersions] = useState<ProductVersion[]>([]);
    const [showVersionForm, setShowVersionForm] = useState(false);
    const [editingVersion, setEditingVersion] = useState<ProductVersion | null>(null);
    const [expandedVersionId, setExpandedVersionId] = useState<number | null>(null);
    const [previewAttachments, setPreviewAttachments] = useState<Attachment[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);

    // 文档上传相关状态
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadDocType, setUploadDocType] = useState<string>('规格书');
    const [uploadBy, setUploadBy] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    useEffect(() => {
        if (id) {
            fetchProductDetail();
            fetchDocuments();
            fetchModules();
            fetchModuleTypes();
            fetchVersions();
        }
    }, [id]);

    const fetchProductDetail = async () => {
        try {
            const { data } = await api.get(`/products/${id}`);
            if (data.success) {
                setProduct(data.data);
            } else {
                setError(data.error || '获取产品详情失败');
            }
        } catch (err) {
            console.error('获取产品详情失败:', err);
            setError('网络错误');
        } finally {
            setLoading(false);
        }
    };

    const fetchDocuments = async () => {
        try {
            const { data } = await api.get(`/product-documents`, { params: { product_id: id } });
            if (data.success) {
                setDocuments(data.data);
            }
        } catch (err) {
            console.error('获取文档失败:', err);
        }
    };

    const fetchModules = async () => {
        if (!id) return;
        try {
            const response = await productModuleApi.getProductModules(parseInt(id));
            if (response.success) {
                setModules(response.data);
            }
        } catch (err) {
            console.error('获取模块配置失败:', err);
        }
    };

    const fetchModuleTypes = async () => {
        try {
            const response = await moduleTypeApi.getActiveModuleTypes();
            if (response.success) {
                setModuleTypes(response.data);
            }
        } catch (err) {
            console.error('获取模块类型失败:', err);
        }
    };

    const fetchVersions = async () => {
        if (!id) return;
        try {
            const response = await productVersionApi.getVersions({ product_id: parseInt(id) });
            if (response.success) {
                setVersions(response.data);
            }
        } catch (err) {
            console.error('获取迭代版本失败:', err);
        }
    };

    const handleDeleteVersion = async (versionId: number, versionNumber: string) => {
        if (!window.confirm(`确定要删除版本「${versionNumber}」吗？此操作不可恢复。`)) return;
        try {
            const res = await productVersionApi.deleteVersion(versionId);
            if (res.success) {
                fetchVersions();
            } else {
                alert(res.error || '删除失败');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || '删除失败');
        }
    };

    const handleSetCurrentVersion = async (versionId: number) => {
        try {
            const res = await productVersionApi.setCurrentVersion(versionId);
            if (res.success) {
                fetchVersions();
            } else {
                alert(res.error || '操作失败');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || '操作失败');
        }
    };

    const getVersionStatusColor = (status: string) => {
        switch (status) {
            case '量产中': return 'bg-green-100 text-green-800';
            case '开发中': return 'bg-yellow-100 text-yellow-800';
            case '已停产': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const handleAddModules = async () => {
        if (!id || selectedModuleTypes.length === 0) {
            alert('请至少选择一个模块类型');
            return;
        }

        setSubmitting(true);
        try {
            for (const moduleTypeId of selectedModuleTypes) {
                await productModuleApi.createProductModule(parseInt(id), {
                    module_type_id: moduleTypeId,
                    is_required: isRequired
                });
            }
            setShowModuleForm(false);
            setSelectedModuleTypes([]);
            fetchModules();
        } catch (err: any) {
            console.error('添加模块配置失败:', err);
            console.error('错误详情:', err.response?.data);
            const errorMsg = err.response?.data?.message || err.response?.data?.error || '添加失败';
            alert(`添加失败：${errorMsg}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteModule = async (moduleId: number, moduleName: string) => {
        if (!window.confirm(`确定要删除 ${moduleName} 模块配置吗？此操作不可恢复。`)) {
            return;
        }

        try {
            await productModuleApi.deleteProductModule(parseInt(id!), moduleId);
            fetchModules();
        } catch (err: any) {
            console.error('删除模块配置失败:', err);
            alert(err.response?.data?.message || '删除失败');
        }
    };

    const downloadFile = async (docId: number, title: string) => {
        const token = localStorage.getItem('auth_token');
        window.open(`/api/product-documents/${docId}/download?token=${token}`, '_blank');
    };

    const handlePreviewProductDocument = async (docId: number, title: string, allDocs: ProductDocument[]) => {
        try {
            const atts: Attachment[] = [];
            for (const d of allDocs) {
                const { data: res } = await api.get(`/product-documents/${d.id}/preview`);
                if (res.success) {
                    atts.push({
                        name: d.original_name || d.title,  // 含扩展名，用于文件类型判断
                        title: d.title,                     // 用户填写的标题，用于弹窗显示
                        url: res.data.url,
                        size: d.file_size
                    });
                }
            }
            const idx = allDocs.findIndex(d => d.id === docId);
            setPreviewAttachments(atts);
            setPreviewIndex(idx >= 0 ? idx : 0);
        } catch (err) {
            console.error('获取预览链接失败:', err);
            alert('获取预览链接失败');
        }
    };

    const resetUploadForm = () => {
        setUploadFile(null);
        setUploadTitle('');
        setUploadDocType('规格书');
        setUploadBy('');
        setShowUploadModal(false);
    };

    const handleUploadDocument = async () => {
        if (!uploadFile || !uploadTitle.trim()) {
            alert('请填写文档标题并选择文件');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('product_id', id!);
            formData.append('doc_type', uploadDocType);
            formData.append('title', uploadTitle.trim());
            if (uploadBy.trim()) {
                formData.append('uploaded_by', uploadBy.trim());
            }

            const { data } = await api.post('/product-documents/upload', formData, {
                timeout: 120000,
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (data.success) {
                resetUploadForm();
                fetchDocuments();
            } else {
                alert(data.error || '上传失败');
            }
        } catch (err) {
            console.error('上传文档失败:', err);
            alert('上传文档失败，请重试');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteDocument = async (docId: number, title: string) => {
        if (!window.confirm(`确定要删除文档「${title}」吗？此操作不可恢复。`)) {
            return;
        }
        try {
            const { data } = await api.delete(`/product-documents/${docId}`);
            if (data.success) {
                fetchDocuments();
            } else {
                alert(data.error || '删除失败');
            }
        } catch (err) {
            console.error('删除文档失败:', err);
            alert('删除文档失败，请重试');
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            setUploadFile(file);
            if (!uploadTitle.trim()) {
                setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
            }
        }
    };


    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFile(file);
            if (!uploadTitle.trim()) {
                setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
            }
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };

    const handlePrint = () => window.print();

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </Layout>
        );
    }

    if (!product) {
        return (
            <Layout>
                <div className="p-4 3xl:p-6 text-center text-red-600">
                    {error || '产品不存在'}
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-4 3xl:p-6">
                {/* 顶部面包屑和标题 */}
                <div className="mb-6">
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                        <Link to="/product-lines" className="hover:text-blue-600">产品线管理</Link>
                        <span className="mx-2">/</span>
                        <span className="text-gray-900">{product.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl 3xl:text-2xl font-bold text-gray-900">
                            {product.name}
                            <span className="ml-3 text-sm font-normal text-gray-500 px-2 py-1 bg-gray-100 rounded">
                                {product.model}
                            </span>
                        </h1>
                        <div className="space-x-3">
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                            >
                                <PrinterIcon className="h-4 w-4" />
                                打印
                            </button>
                            <button
                                onClick={() => alert('编辑产品功能开发中...')}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                                编辑产品
                            </button>
                            {activeTab === 'modules' && (
                                <button
                                    onClick={() => {
                                        fetchModules();
                                        setShowModuleForm(true);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center gap-2"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                    新增模块配置
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 标签页导航 */}
                <div className="border-b border-gray-200 mb-6 no-print">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'info'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            基本信息
                        </button>
                        <button
                            onClick={() => setActiveTab('docs')}
                            className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'docs'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            技术文档 ({documents.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('modules')}
                            className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'modules'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            模块配置
                        </button>
                    </nav>
                </div>

                {/* 标签页内容 */}
                <div className="bg-white shadow rounded-lg p-4 3xl:p-6">
                    {activeTab === 'info' && (
                        <div>
                            {/* 产品详情 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 3xl:gap-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">产品详情</h3>
                                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                                        <div className="sm:col-span-1">
                                            <dt className="text-sm font-medium text-gray-500">所属产品线</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{product.product_line_name}</dd>
                                        </div>
                                        <div className="sm:col-span-1">
                                            <dt className="text-sm font-medium text-gray-500">产品型号</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{product.model}</dd>
                                        </div>
                                        <div className="sm:col-span-1">
                                            <dt className="text-sm font-medium text-gray-500">状态</dt>
                                            <dd className="mt-1 text-sm text-gray-900">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {product.is_active ? '启用' : '停用'}
                                                </span>
                                            </dd>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <dt className="text-sm font-medium text-gray-500">描述</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{product.description || '无描述'}</dd>
                                        </div>
                                    </dl>
                                </div>

                                {product.specifications && (
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-4">技术规格</h3>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                                                {JSON.stringify(product.specifications, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 迭代版本部分 */}
                            <div className="mt-8 border-t border-gray-200 pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-medium text-gray-900">迭代版本 ({versions.length})</h3>
                                    <button
                                        onClick={() => { setEditingVersion(null); setShowVersionForm(true); }}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 inline-flex items-center gap-1.5"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        新增迭代版本
                                    </button>
                                </div>

                                {versions.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                                        <p className="text-gray-500">暂无迭代版本记录</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {versions.map((v) => (
                                            <div key={v.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                                <div
                                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                                                    onClick={() => setExpandedVersionId(expandedVersionId === v.id ? null : v.id)}
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-100 text-blue-800">
                                                            {v.version_number}
                                                        </span>
                                                        {v.is_current && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                                                <CheckCircleIcon className="h-3 w-3" />当前版本
                                                            </span>
                                                        )}
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getVersionStatusColor(v.status)}`}>
                                                            {v.status}
                                                        </span>
                                                        {v.version_name && (
                                                            <span className="text-sm text-gray-700 truncate">{v.version_name}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {v.release_date && (
                                                            <span className="text-xs text-gray-400">{new Date(v.release_date).toLocaleDateString('zh-CN')}</span>
                                                        )}
                                                        {!v.is_current && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleSetCurrentVersion(v.id); }}
                                                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-50 rounded"
                                                                title="设为当前版本"
                                                            >
                                                                设为当前
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingVersion(v); setShowVersionForm(true); }}
                                                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                                                            title="编辑"
                                                        >
                                                            <PencilIcon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteVersion(v.id, v.version_number); }}
                                                            className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                                            title="删除"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                        {expandedVersionId === v.id ? (
                                                            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                                                        ) : (
                                                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                                                        )}
                                                    </div>
                                                </div>
                                                {expandedVersionId === v.id && (
                                                    <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                                                        {v.description && (
                                                            <p className="text-sm text-gray-600 mt-3">{v.description}</p>
                                                        )}
                                                        {v.documents && v.documents.length > 0 && (
                                                            <div className="mt-3">
                                                                <p className="text-xs font-medium text-gray-500 mb-2">附件 ({v.documents.length})</p>
                                                                <div className="space-y-1">
                                                                    {v.documents.map((doc) => (
                                                                        <div key={doc.id} className="flex items-center gap-2 text-sm">
                                                                            <DocumentIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                                            <span className="truncate text-gray-700">{doc.name}</span>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        const atts: Attachment[] = [];
                                                                                        for (const d of (v.documents || [])) {
                                                                                            const res = await productVersionApi.previewDocument(d.id);
                                                                                            if (res.success) atts.push({ name: d.name, url: res.data.url });
                                                                                        }
                                                                                        const idx = (v.documents || []).findIndex(d => d.id === doc.id);
                                                                                        setPreviewAttachments(atts);
                                                                                        setPreviewIndex(idx >= 0 ? idx : 0);
                                                                                    } catch (err) {
                                                                                        console.error('获取预览链接失败:', err);
                                                                                        alert('获取预览链接失败');
                                                                                    }
                                                                                }}
                                                                                className="ml-auto text-blue-500 hover:text-blue-700 p-1 flex-shrink-0"
                                                                                title="预览"
                                                                            >
                                                                                <EyeIcon className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'docs' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-900">产品文档列表</h3>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 inline-flex items-center gap-1.5 transition-colors"
                                >
                                    <ArrowUpTrayIcon className="h-4 w-4" />
                                    上传新文档
                                </button>
                            </div>

                            {documents.length === 0 ? (
                                <div className="text-center py-12">
                                    <DocumentIcon className="mx-auto h-12 w-12 text-gray-300" />
                                    <p className="mt-2 text-gray-500">暂无文档</p>
                                    <p className="text-sm text-gray-400 mt-1">点击"上传新文档"按钮添加产品技术文档</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-200">
                                    {documents.map((doc) => (
                                        <li key={doc.id} className="py-4 flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                                            <div className="flex items-center min-w-0">
                                                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                                                    <DocumentIcon className="h-5 w-5 text-blue-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                                                    <p className="text-xs text-gray-500">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 mr-2">{doc.doc_type}</span>
                                                        {doc.file_size ? formatFileSize(doc.file_size) : '未知大小'}
                                                        {doc.uploaded_by && <span> • {doc.uploaded_by}</span>}
                                                        <span> • {new Date(doc.created_at).toLocaleDateString('zh-CN')}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex space-x-3 flex-shrink-0 ml-4">
                                                <button
                                                    onClick={() => handlePreviewProductDocument(doc.id, doc.title, documents)}
                                                    className="text-gray-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1"
                                                    title="预览"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                    预览
                                                </button>
                                                <button
                                                    onClick={() => downloadFile(doc.id, doc.title)}
                                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                >
                                                    下载
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                                                >
                                                    删除
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {activeTab === 'modules' && (
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">模块配置列表</h3>

                            {modules.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 rounded-lg">
                                    <p className="text-gray-500">暂无模块配置</p>
                                    <p className="text-sm text-gray-400 mt-2">点击右上角"新增模块配置"按钮添加</p>
                                </div>
                            ) : (
                                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    模块类型
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    必需/可选
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    创建时间
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    操作
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {modules.map((module) => (
                                                <React.Fragment key={module.id}>
                                                    <tr className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {module.module_type_name}
                                                                </div>
                                                                <div className="ml-2 text-xs text-gray-500">
                                                                    ({module.module_type_code})
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                                module.is_required
                                                                    ? 'bg-red-100 text-red-800'
                                                                    : 'bg-green-100 text-green-800'
                                                            }`}>
                                                                {module.is_required ? '必需' : '可选'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {new Date(module.created_at).toLocaleString('zh-CN')}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => handleDeleteModule(module.id, module.module_type_name || '')}
                                                                className="text-red-600 hover:text-red-900 inline-flex items-center"
                                                            >
                                                                <TrashIcon className="h-4 w-4 mr-1" />
                                                                删除
                                                            </button>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 新增模块配置表单对话框 */}
                            {showModuleForm && (
                                <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
                                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-4 3xl:p-6">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">新增模块配置</h3>

                                        <div className="space-y-4">
                                            {/* 模块类型多选 */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    选择模块类型 <span className="text-red-500">*</span>
                                                </label>
                                                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                                                    {moduleTypes.map((type) => {
                                                        const isConfigured = modules.some(m => m.module_type_id === type.id);
                                                        return (
                                                            <label
                                                                key={type.id}
                                                                className={`flex items-center py-2 px-3 rounded hover:bg-gray-50 ${
                                                                    isConfigured ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    disabled={isConfigured}
                                                                    checked={selectedModuleTypes.includes(type.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setSelectedModuleTypes([...selectedModuleTypes, type.id]);
                                                                        } else {
                                                                            setSelectedModuleTypes(selectedModuleTypes.filter(id => id !== type.id));
                                                                        }
                                                                    }}
                                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                />
                                                                <span className="ml-3 text-sm text-gray-700">
                                                                    {type.name} ({type.code})
                                                                    {isConfigured && <span className="ml-2 text-xs text-gray-500">(已配置)</span>}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 必需/可选 */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    模块属性
                                                </label>
                                                <div className="flex items-center space-x-4">
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            checked={isRequired}
                                                            onChange={() => setIsRequired(true)}
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">必需</span>
                                                    </label>
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            checked={!isRequired}
                                                            onChange={() => setIsRequired(false)}
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">可选</span>
                                                    </label>
                                                </div>
                                            </div>


                                        </div>

                                        {/* 按钮 */}
                                        <div className="mt-6 flex justify-end space-x-3">
                                            <button
                                                onClick={() => {
                                                    setShowModuleForm(false);
                                                    setSelectedModuleTypes([]);
                                                }}
                                                disabled={submitting}
                                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                取消
                                            </button>
                                            <button
                                                onClick={handleAddModules}
                                                disabled={submitting || selectedModuleTypes.length === 0}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {submitting ? '提交中...' : '确认添加'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 文档上传弹窗 */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={resetUploadForm} />
                        <div className="relative bg-white rounded-xl shadow-xl transform transition-all sm:max-w-lg sm:w-full mx-auto">
                            {/* 弹窗头部 */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900">上传产品文档</h3>
                                <button
                                    onClick={resetUploadForm}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {/* 弹窗内容 */}
                            <div className="px-6 py-5 space-y-4">
                                {/* 文件拖拽区域 */}
                                <div
                                    className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                                        dragOver
                                            ? 'border-blue-400 bg-blue-50'
                                            : uploadFile
                                            ? 'border-green-300 bg-green-50'
                                            : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleFileDrop}
                                >
                                    {uploadFile ? (
                                        <div className="flex items-center justify-center gap-3">
                                            <DocumentIcon className="h-8 w-8 text-green-500" />
                                            <div className="text-left">
                                                <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                                                <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                                            </div>
                                            <button
                                                onClick={() => setUploadFile(null)}
                                                className="ml-2 text-gray-400 hover:text-red-500"
                                            >
                                                <XMarkIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400" />
                                            <p className="mt-2 text-sm text-gray-600">拖拽文件到此处，或</p>
                                            <label className="mt-1 inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-blue-600 hover:bg-gray-50 cursor-pointer">
                                                选择文件
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleFileSelect}
                                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.png,.jpg,.jpeg,.gif,.dwg,.dxf,.step,.stp,.igs,.stl"
                                                />
                                            </label>
                                            <p className="mt-2 text-xs text-gray-400">支持 PDF、Office、图片、压缩包、CAD 等格式，最大 50MB</p>
                                        </>
                                    )}
                                </div>

                                {/* 文档标题 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        文档标题 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadTitle}
                                        onChange={(e) => setUploadTitle(e.target.value)}
                                        placeholder="输入文档标题"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                </div>

                                {/* 文档类型 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        文档类型 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={uploadDocType}
                                        onChange={(e) => setUploadDocType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    >
                                        {DOC_TYPES.map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 上传者 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">上传者</label>
                                    <input
                                        type="text"
                                        value={uploadBy}
                                        onChange={(e) => setUploadBy(e.target.value)}
                                        placeholder="输入上传者姓名（选填）"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                </div>
                            </div>

                            {/* 弹窗底部按钮 */}
                            <div className="px-4 py-3 3xl:px-6 3xl:py-4 border-t border-gray-200 flex justify-end space-x-3">
                                <button
                                    onClick={resetUploadForm}
                                    disabled={uploading}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleUploadDocument}
                                    disabled={uploading || !uploadFile || !uploadTitle.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                                >
                                    {uploading ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            上传中...
                                        </>
                                    ) : (
                                        <>
                                            <ArrowUpTrayIcon className="h-4 w-4" />
                                            确认上传
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 迭代版本表单 */}
            {showVersionForm && (
                <ProductVersionForm
                    productId={parseInt(id!)}
                    version={editingVersion}
                    onClose={() => { setShowVersionForm(false); setEditingVersion(null); }}
                    onSuccess={() => { setShowVersionForm(false); setEditingVersion(null); fetchVersions(); }}
                />
            )}

            {/* 附件预览 */}
            {previewAttachments.length > 0 && (
                <AttachmentViewer
                    attachments={previewAttachments}
                    initialIndex={previewIndex}
                    onClose={() => setPreviewAttachments([])}
                />
            )}
        </Layout>
    );
};

export default ProductDetail;
