import React, { useState, useEffect } from 'react';
import { XMarkIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, DocumentIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { ProductVersion, ProductVersionFormData, ProductVersionDocument } from '../types';
import { productVersionApi } from '../services/api';
import AttachmentViewer, { Attachment } from './AttachmentViewer';

interface ProductVersionFormProps {
    productId: number;
    version?: ProductVersion | null;
    onClose: () => void;
    onSuccess: () => void;
}

const VERSION_STATUS_OPTIONS = [
    { value: '开发中', label: '开发中', color: 'bg-yellow-100 text-yellow-800' },
    { value: '量产中', label: '量产中', color: 'bg-green-100 text-green-800' },
    { value: '已停产', label: '已停产', color: 'bg-red-100 text-red-800' },
];

const DOC_CATEGORIES = ['规格书', '变更记录', '图纸', '其他'] as const;

const ProductVersionForm: React.FC<ProductVersionFormProps> = ({ productId, version, onClose, onSuccess }) => {
    const [formData, setFormData] = useState<ProductVersionFormData>({
        product_id: productId,
        version_number: '',
        version_name: '',
        description: '',
        specifications: undefined,
        status: '开发中',
        release_date: '',
        is_current: false,
        sort_order: 0,
    });

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // 文件上传
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploadCategory, setUploadCategory] = useState<string>('其他');
    const [existingDocs, setExistingDocs] = useState<ProductVersionDocument[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [previewAtts, setPreviewAtts] = useState<Attachment[]>([]);
    const [previewIdx, setPreviewIdx] = useState(0);

    useEffect(() => {
        if (version) {
            setFormData({
                product_id: productId,
                version_number: version.version_number,
                version_name: version.version_name || '',
                description: version.description || '',
                specifications: version.specifications,
                status: version.status,
                release_date: version.release_date ? version.release_date.split('T')[0] : '',
                is_current: version.is_current,
                sort_order: version.sort_order,
            });
            // 加载已有文档
            fetchDocuments(version.id);
        }
    }, [version, productId]);

    const fetchDocuments = async (versionId: number) => {
        try {
            const res = await productVersionApi.getDocuments(versionId);
            if (res.success) {
                setExistingDocs(res.data);
            }
        } catch (err) {
            console.error('获取版本文档失败:', err);
        }
    };

    const handleChange = (field: keyof ProductVersionFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        setUploadFiles(prev => [...prev, ...files]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setUploadFiles(prev => [...prev, ...files]);
    };

    const removeFile = (index: number) => {
        setUploadFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDeleteDoc = async (docId: number) => {
        if (!window.confirm('确定要删除此文档吗？')) return;
        try {
            await productVersionApi.deleteDocument(docId);
            setExistingDocs(prev => prev.filter(d => d.id !== docId));
        } catch (err) {
            console.error('删除文档失败:', err);
            alert('删除文档失败');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!formData.version_number.trim()) {
            newErrors.version_number = '版本号不能为空';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            let versionId: number;

            if (version) {
                // 更新
                await productVersionApi.updateVersion(version.id, formData);
                versionId = version.id;
            } else {
                // 新建
                const res = await productVersionApi.createVersion(formData);
                versionId = res.data.id;
            }

            // 上传新文件
            if (uploadFiles.length > 0) {
                const fd = new FormData();
                uploadFiles.forEach(file => fd.append('files', file));
                fd.append('category', uploadCategory);
                await productVersionApi.uploadDocuments(versionId, fd);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('保存迭代版本失败:', err);
            const msg = err.response?.data?.error || '保存失败';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
    <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {version ? '编辑迭代版本' : '新增迭代版本'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 版本号 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                版本号 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.version_number}
                                onChange={(e) => handleChange('version_number', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${errors.version_number ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="如 V1, V2.1"
                            />
                            {errors.version_number && <p className="text-red-500 text-xs mt-1">{errors.version_number}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">版本名称</label>
                            <input
                                type="text"
                                value={formData.version_name || ''}
                                onChange={(e) => handleChange('version_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="如 2025款改进型"
                            />
                        </div>
                    </div>

                    {/* 状态 + 发布日期 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                            <select
                                value={formData.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                                {VERSION_STATUS_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">发布日期</label>
                            <input
                                type="date"
                                value={formData.release_date || ''}
                                onChange={(e) => handleChange('release_date', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                    </div>

                    {/* 当前版本 + 排序 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="is_current"
                                checked={formData.is_current || false}
                                onChange={(e) => handleChange('is_current', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 mr-2"
                            />
                            <label htmlFor="is_current" className="text-sm font-medium text-gray-700">
                                设为当前在产版本
                            </label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">排序权重</label>
                            <input
                                type="number"
                                value={formData.sort_order || 0}
                                onChange={(e) => handleChange('sort_order', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                min="0"
                            />
                        </div>
                    </div>

                    {/* 变更说明 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">变更说明</label>
                        <textarea
                            value={formData.description || ''}
                            onChange={(e) => handleChange('description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            rows={3}
                            placeholder="描述该版本相对上一版本的变更内容..."
                        />
                    </div>

                    {/* 已有文档 */}
                    {existingDocs.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">已有文档</label>
                            <div className="space-y-1">
                                {existingDocs.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <DocumentIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                            <span className="truncate">{doc.name}</span>
                                            <span className="text-xs text-gray-400">({doc.category})</span>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const atts: Attachment[] = [];
                                                        for (const d of existingDocs) {
                                                            const res = await productVersionApi.previewDocument(d.id);
                                                            if (res.success) {
                                                                atts.push({ name: d.name, url: res.data.url });
                                                            }
                                                        }
                                                        const idx = existingDocs.findIndex(d => d.id === doc.id);
                                                        setPreviewAtts(atts);
                                                        setPreviewIdx(idx >= 0 ? idx : 0);
                                                    } catch (err) {
                                                        console.error('获取预览链接失败:', err);
                                                        alert('获取预览链接失败');
                                                    }
                                                }}
                                                className="p-1 text-blue-500 hover:text-blue-700"
                                                title="预览/下载"
                                            >
                                                <EyeIcon className="h-4 w-4" />
                                            </button>
                                            <a
                                                href={productVersionApi.downloadDocument(doc.id)}
                                                className="p-1 text-green-500 hover:text-green-700"
                                                title="下载"
                                                download
                                            >
                                                <ArrowDownTrayIcon className="h-4 w-4" />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteDoc(doc.id)}
                                                className="p-1 text-red-400 hover:text-red-600"
                                                title="删除"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 上传新文档 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">上传附件/文档</label>
                        <div className="mb-2">
                            <select
                                value={uploadCategory}
                                onChange={(e) => setUploadCategory(e.target.value)}
                                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                {DOC_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div
                            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleFileDrop}
                        >
                            <ArrowUpTrayIcon className="mx-auto h-8 w-8 text-gray-400" />
                            <p className="mt-1 text-sm text-gray-600">拖拽文件到此处，或</p>
                            <label className="mt-1 inline-flex items-center px-3 py-1 bg-white border border-gray-300 rounded text-sm text-blue-600 hover:bg-gray-50 cursor-pointer">
                                选择文件
                                <input type="file" className="hidden" onChange={handleFileSelect} multiple />
                            </label>
                        </div>
                        {uploadFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {uploadFiles.map((file, i) => (
                                    <div key={i} className="flex items-center justify-between py-1 px-2 bg-blue-50 rounded text-sm">
                                        <span className="truncate">{file.name} <span className="text-gray-400">({formatFileSize(file.size)})</span></span>
                                        <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 ml-2">
                                            <XMarkIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? '保存中...' : (version ? '更新' : '创建')}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        {previewAtts.length > 0 && (
            <AttachmentViewer
                attachments={previewAtts}
                initialIndex={previewIdx}
                onClose={() => setPreviewAtts([])}
            />
        )}
    </>
    );
};

export default ProductVersionForm;
