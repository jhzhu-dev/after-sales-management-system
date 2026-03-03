import React, { useState, useEffect } from 'react';
import {
    BuildingOfficeIcon,
    CpuChipIcon,
    ServerIcon,
    EyeIcon,
    ComputerDesktopIcon,
    PlusIcon,
    CalendarDaysIcon,
    TagIcon,
    DocumentTextIcon,
    Squares2X2Icon,
    ListBulletIcon,
    PencilIcon,
    TrashIcon,
    PaperClipIcon,
    ArrowDownTrayIcon,
    PrinterIcon
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import VersionReleaseForm from '../components/VersionReleaseForm';
import api, { versionReleaseApi, moduleTypeApi, productLineApi } from '../services/api';
import { VersionRelease } from '../types';

const ReleaseLibrary: React.FC = () => {
    const [releases, setReleases] = useState<VersionRelease[]>([]);
    const [moduleTypes, setModuleTypes] = useState<any[]>([]);
    const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [moduleTypesLoaded, setModuleTypesLoaded] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedRelease, setSelectedRelease] = useState<VersionRelease | null>(null);
    const [editingRelease, setEditingRelease] = useState<VersionRelease | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [detailAttachments, setDetailAttachments] = useState<any[]>([]);
    const [productLines, setProductLines] = useState<{ id: number; name: string }[]>([]);
    const [existingCategories, setExistingCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('');

    const fetchModuleTypes = async () => {
        setModuleTypesLoaded(false);
        try {
            const response = await moduleTypeApi.getModuleTypes({ limit: 100 });
            if (response.success) {
                setModuleTypes(response.data);
                if (response.data.length > 0 && activeTypeId === null) {
                    setActiveTypeId(response.data[0].id);
                }
                if (response.data.length === 0) {
                    setActiveTypeId(null);
                    setReleases([]);
                    setExistingCategories([]);
                    setLoading(false);
                }
            }
        } catch (error) {
            console.error('获取模块类型失败:', error);
        } finally {
            setModuleTypesLoaded(true);
        }
    };

    const fetchReleases = async () => {
        setLoading(true);
        try {
            const response = await versionReleaseApi.getReleases({
                module_type_id: activeTypeId || undefined
            });
            if (response.success) {
                setReleases(response.data);
                // 提取当前 tab 下的所有分类
                const cats = [...new Set(response.data.map((r: any) => r.category).filter(Boolean))];
                setExistingCategories(cats as string[]);
            }
        } catch (error) {
            console.error('获取版本发布列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProductLines = async () => {
        try {
            const response = await productLineApi.getProductLines();
            if (response.success) {
                setProductLines(response.data.map((pl: any) => ({ id: pl.id, name: pl.name })));
            }
        } catch (error) {
            console.error('获取产品线失败:', error);
        }
    };

    useEffect(() => {
        fetchModuleTypes();
        fetchProductLines();
    }, []);

    useEffect(() => {
        if (!moduleTypesLoaded) {
            return;
        }
        if (activeTypeId !== null) {
            fetchReleases();
            setActiveCategory('');
        } else {
            setReleases([]);
            setExistingCategories([]);
            setLoading(false);
        }
    }, [activeTypeId, moduleTypesLoaded]);

    const handleAddRelease = () => {
        setEditingRelease(null);
        setShowForm(true);
    };

    const handleEditRelease = (release: VersionRelease) => {
        setEditingRelease(release);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingRelease(null);
    };

    const handleSubmit = async (formData: any, files?: File[]) => {
        try {
            let releaseId: number | null = null;

            if (editingRelease) {
                // 更新版本
                const response = await api.put(`/version-releases/${editingRelease.id}`, formData);
                if (response.data.success) {
                    releaseId = editingRelease.id;
                    setSuccessMessage('版本更新成功');
                    await fetchReleases();
                }
            } else {
                // 创建版本
                const response = await versionReleaseApi.createRelease({
                    ...formData,
                    module_type_id: activeTypeId || formData.module_type_id
                });
                if (response.success) {
                    releaseId = response.data?.id;
                    setSuccessMessage('版本发布成功');
                    await fetchReleases();
                }
            }

            // 上传附件
            if (releaseId && files && files.length > 0) {
                const fd = new FormData();
                files.forEach(f => fd.append('files', f));
                try {
                    await api.post(`/version-releases/${releaseId}/attachments`, fd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    setSuccessMessage(prev => (prev || '') + `，已上传${files.length}个附件`);
                } catch (uploadErr) {
                    console.error('附件上传失败:', uploadErr);
                    setSuccessMessage(prev => (prev || '') + '，但附件上传失败');
                }
            }
            
            // 3秒后清除成功消息
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error: any) {
            console.error('操作失败:', error);
            throw error;
        }
    };

    const handleDeleteRelease = async (release: VersionRelease) => {
        if (!window.confirm(`确定要删除版本"${release.version_number}"吗？此操作不可恢复。`)) {
            return;
        }

        try {
            const response = await api.delete(`/version-releases/${release.id}`);
            if (response.data.success) {
                setSuccessMessage('版本删除成功');
                await fetchReleases();
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        } catch (error: any) {
            console.error('删除失败:', error);
            alert(error.response?.data?.error || '删除失败，请稍后重试');
        }
    };

    const handleViewDetail = async (release: VersionRelease) => {
        setSelectedRelease(release);
        setShowDetailModal(true);
        // 获取附件
        try {
            const res = await api.get(`/version-releases/${release.id}/attachments`);
            if (res.data.success) {
                setDetailAttachments(res.data.data);
            }
        } catch (e) {
            setDetailAttachments([]);
        }
    };

    const handleDownloadAttachment = async (attachment: any) => {
        try {
            const res = await api.get(`/version-releases/attachments/${attachment.id}/download`);
            if (res.data.success && res.data.data?.url) {
                window.open(res.data.data.url, '_blank');
            }
        } catch (e) {
            console.error('下载失败:', e);
            alert('下载失败');
        }
    };

    const handleDeleteAttachment = async (attachment: any) => {
        if (!window.confirm(`确定要删除附件"${attachment.original_name}"吗？`)) return;
        try {
            const res = await api.delete(`/version-releases/attachments/${attachment.id}`);
            if (res.data.success) {
                setDetailAttachments(prev => prev.filter(a => a.id !== attachment.id));
            }
        } catch (e) {
            console.error('删除附件失败:', e);
            alert('删除附件失败');
        }
    };

    const getTypeIcon = (typeName: string) => {
        switch (typeName) {
            case '机械': return <BuildingOfficeIcon className="h-5 w-5" />;
            case '电气': return <CpuChipIcon className="h-5 w-5" />;
            case '服务器': return <ServerIcon className="h-5 w-5" />;
            case '视觉': return <EyeIcon className="h-5 w-5" />;
            case '上位机': return <ComputerDesktopIcon className="h-5 w-5" />;
            default: return <CpuChipIcon className="h-5 w-5" />;
        }
    };

    const handlePrint = () => window.print();

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">版本发布中心</h1>
                        <p className="text-gray-600 mt-1">管理各模块类型的正式发布版本</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <PrinterIcon className="h-4 w-4 mr-2" />
                            打印
                        </button>
                        {/* 视图切换按钮 */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                title="方块视图"
                            >
                                <Squares2X2Icon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                title="列表视图"
                            >
                                <ListBulletIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {moduleTypes.length > 0 && (
                            <button
                                onClick={handleAddRelease}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                            >
                                <PlusIcon className="h-5 w-5" />
                                发布新版本
                            </button>
                        )}
                    </div>
                </div>

                {/* 成功消息提示 */}
                {successMessage && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-700">{successMessage}</p>
                    </div>
                )}

                {/* 模块类型 Tabs */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="border-b border-gray-200 no-print">
                        <nav className="flex -mb-px">
                            {moduleTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setActiveTypeId(type.id)}
                                    className={`flex items-center gap-2 py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTypeId === type.id
                                            ? 'border-blue-500 text-blue-600 bg-blue-50/30'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    {getTypeIcon(type.name)}
                                    {type.name}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="p-6">
                        {/* 分类过滤 */}
                        {existingCategories.length > 0 && (
                            <div className="flex items-center gap-2 mb-4 flex-wrap no-print">
                                <span className="text-sm text-gray-500 mr-1">分类:</span>
                                <button
                                    onClick={() => setActiveCategory('')}
                                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                        activeCategory === '' 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    全部
                                </button>
                                {existingCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                            activeCategory === cat 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                        {(() => {
                            const filteredReleases = activeCategory
                                ? releases.filter(r => r.category === activeCategory)
                                : releases;
                            if (loading) {
                                return <div className="text-center py-12">加载中...</div>;
                            }
                            if (moduleTypesLoaded && moduleTypes.length === 0) {
                                return (
                                    <div className="text-center py-12 text-gray-500">
                                        暂无模块类型，请先创建模块类型。
                                    </div>
                                );
                            }
                            if (filteredReleases.length === 0) {
                                return (
                                    <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                        <TagIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">暂无已发布的版本记录</p>
                                        {moduleTypes.length > 0 && (
                                            <button
                                                onClick={handleAddRelease}
                                                className="mt-4 text-blue-600 font-medium hover:underline"
                                            >
                                                立即发布第一个版本
                                            </button>
                                        )}
                                    </div>
                                );
                            }
                            return (
                            viewMode === 'grid' ? (
                                // 方块视图 - 突出版本描述
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredReleases.map((release) => (
                                        <div key={release.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-gray-50">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold font-mono">
                                                        {release.version_number}
                                                    </div>
                                                    {release.category && (
                                                        <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full text-xs">
                                                            {release.category}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center text-xs text-gray-400">
                                                    <CalendarDaysIcon className="h-4 w-4 mr-1" />
                                                    {new Date(release.release_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-2 truncate" title={release.title}>
                                                {release.title}
                                            </h3>
                                            <div className="text-sm text-gray-600 line-clamp-3 mb-4 min-h-[4.5rem] whitespace-pre-wrap">
                                                {release.change_log || '无变更说明'}
                                            </div>
                                            <div className="pt-4 border-t border-gray-100">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs text-gray-400">ID: {release.id}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleViewDetail(release)}
                                                        className="flex-1 text-center px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded text-sm font-medium transition-colors"
                                                    >
                                                        查看详情
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditRelease(release)}
                                                        className="px-3 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                                                        title="编辑"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRelease(release)}
                                                        className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                                        title="删除"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                // 列表视图 - 突出版本号、名称、发布时间
                                <div className="divide-y divide-gray-200">
                                    {filteredReleases.map((release) => (
                                        <div key={release.id} className="py-4 px-4 hover:bg-gray-50 transition-colors rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4 flex-1">
                                                    {/* 版本号 - 突出显示 */}
                                                    <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold font-mono text-base min-w-[100px] text-center shadow-md">
                                                        {release.version_number}
                                                    </div>
                                                    {/* 版本名称 - 突出显示 */}
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="text-lg font-bold text-gray-900">{release.title}</h3>
                                                            {release.category && (
                                                                <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full text-xs">
                                                                    {release.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500 line-clamp-1">{release.change_log || '无变更说明'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {/* 发布时间 - 突出显示 */}
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <CalendarDaysIcon className="h-5 w-5" />
                                                        <span className="font-medium">{new Date(release.release_date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleViewDetail(release)}
                                                            className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            详情
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditRelease(release)}
                                                            className="px-3 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                                                            title="编辑"
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRelease(release)}
                                                            className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                                            title="删除"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        );
                        })()}

                        {/* 打印专用版本列表 */}
                        {(() => {
                            const fr = activeCategory ? releases.filter((r: any) => r.category === activeCategory) : releases;
                            const currentType = moduleTypes.find((t: any) => t.id === activeTypeId);
                            return (
                                <div className="hidden print:block" style={{marginTop:'8pt'}}>
                                    <h3 style={{fontSize:'10pt',fontWeight:'700',marginBottom:'4pt'}}>
                                        {currentType?.name || ''}版本发布列表{activeCategory ? ` — ${activeCategory}` : ''}
                                        <span style={{fontSize:'8pt',fontWeight:'400',color:'#6b7280',marginLeft:'6pt'}}>共 {fr.length} 条</span>
                                    </h3>
                                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'8pt'}}>
                                        <thead>
                                            <tr style={{borderBottom:'1pt solid #374151',backgroundColor:'#f9fafb'}}>
                                                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>版本号</th>
                                                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>名称</th>
                                                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>分类</th>
                                                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>变更说明</th>
                                                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>发布日期</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fr.map((release: any, i: number) => (
                                                <tr key={release.id} style={{borderBottom:'0.5pt solid #e5e7eb',backgroundColor:i%2===0?'white':'#f9fafb'}}>
                                                    <td style={{padding:'3pt 6pt',fontFamily:'monospace',fontWeight:'700'}}>{release.version_number}</td>
                                                    <td style={{padding:'3pt 6pt',fontWeight:'500'}}>{release.title}</td>
                                                    <td style={{padding:'3pt 6pt'}}>{release.category || '-'}</td>
                                                    <td style={{padding:'3pt 6pt',maxWidth:'180pt',wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{release.change_log || '-'}</td>
                                                    <td style={{padding:'3pt 6pt'}}>{new Date(release.release_date).toLocaleDateString('zh-CN')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* 版本发布表单 */}
            {showForm && (
                <VersionReleaseForm
                    versionRelease={editingRelease}
                    moduleType={moduleTypes.find(t => t.id === (editingRelease?.module_type_id || activeTypeId)) || null}
                    productLines={productLines}
                    existingCategories={existingCategories}
                    onClose={handleCloseForm}
                    onSubmit={handleSubmit}
                />
            )}

            {/* 版本详情 Modal */}
            {showDetailModal && selectedRelease && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-purple-50">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-bold text-gray-900">版本详情</h3>
                                <span className="px-3 py-1 bg-blue-600 text-white text-sm font-bold font-mono rounded-md shadow-sm">
                                    {selectedRelease.version_number}
                                </span>
                            </div>
                            <button 
                                onClick={() => setShowDetailModal(false)} 
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <PlusIcon className="h-6 w-6 rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* 基本信息 */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide">版本号</label>
                                    <div className="flex items-center gap-2">
                                        <TagIcon className="h-5 w-5 text-blue-600" />
                                        <p className="text-lg font-bold text-gray-900 font-mono">{selectedRelease.version_number}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide">发布日期</label>
                                    <div className="flex items-center gap-2">
                                        <CalendarDaysIcon className="h-5 w-5 text-green-600" />
                                        <p className="text-lg font-medium text-gray-900">
                                            {new Date(selectedRelease.release_date).toLocaleDateString('zh-CN', { 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 模块类型 */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide">模块类型</label>
                                <div className="flex items-center gap-2">
                                    {getTypeIcon(moduleTypes.find(t => t.id === selectedRelease.module_type_id)?.name || '')}
                                    <p className="text-lg font-medium text-gray-900">
                                        {moduleTypes.find(t => t.id === selectedRelease.module_type_id)?.name || '未知'}
                                    </p>
                                    {selectedRelease.category && (
                                        <span className="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-sm font-medium">
                                            {selectedRelease.category}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 版本标题 */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide">版本标题</label>
                                <p className="text-lg font-semibold text-gray-900 bg-gray-50 p-3 rounded-lg">
                                    {selectedRelease.title}
                                </p>
                            </div>

                            {/* 变更日志 */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                    <DocumentTextIcon className="h-5 w-5" />
                                    变更日志 (Change Log)
                                </label>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    {selectedRelease.change_log ? (
                                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                                            {selectedRelease.change_log}
                                        </pre>
                                    ) : (
                                        <p className="text-gray-400 italic">暂无变更说明</p>
                                    )}
                                </div>
                            </div>

                            {/* 附件 */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                    <PaperClipIcon className="h-5 w-5" />
                                    附件 ({detailAttachments.length})
                                </label>
                                {detailAttachments.length > 0 ? (
                                    <div className="space-y-2">
                                        {detailAttachments.map((att: any) => (
                                            <div key={att.id} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <PaperClipIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{att.original_name}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {att.file_size < 1024 * 1024
                                                                ? `${(att.file_size / 1024).toFixed(1)} KB`
                                                                : `${(att.file_size / 1024 / 1024).toFixed(1)} MB`}
                                                            {' · '}
                                                            {new Date(att.created_at).toLocaleString('zh-CN')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleDownloadAttachment(att)}
                                                        className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded transition-colors"
                                                        title="下载"
                                                    >
                                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAttachment(att)}
                                                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors"
                                                        title="删除"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 italic text-sm bg-gray-50 p-3 rounded-lg">暂无附件</p>
                                )}
                            </div>

                            {/* 其他信息 */}
                            <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                                <div className="text-sm">
                                    <span className="text-gray-500">版本ID：</span>
                                    <span className="font-mono text-gray-900 font-medium">{selectedRelease.id}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-gray-500">创建时间：</span>
                                    <span className="text-gray-900">
                                        {new Date(selectedRelease.created_at).toLocaleString('zh-CN')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ReleaseLibrary;
