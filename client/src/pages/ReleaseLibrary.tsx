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
    DocumentTextIcon
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { versionReleaseApi, moduleTypeApi } from '../services/api';
import { VersionRelease } from '../types';

const ReleaseLibrary: React.FC = () => {
    const [releases, setReleases] = useState<VersionRelease[]>([]);
    const [moduleTypes, setModuleTypes] = useState<any[]>([]);
    const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newRelease, setNewRelease] = useState({
        module_type_id: 0,
        version_number: '',
        title: '',
        change_log: ''
    });

    const fetchModuleTypes = async () => {
        try {
            const response = await moduleTypeApi.getModuleTypes({ limit: 100 });
            if (response.success) {
                setModuleTypes(response.data);
                if (response.data.length > 0 && activeTypeId === null) {
                    setActiveTypeId(response.data[0].id);
                }
            }
        } catch (error) {
            console.error('获取模块类型失败:', error);
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
            }
        } catch (error) {
            console.error('获取版本发布列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModuleTypes();
    }, []);

    useEffect(() => {
        if (activeTypeId !== null) {
            fetchReleases();
        }
    }, [activeTypeId]);

    const handleCreateRelease = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await versionReleaseApi.createRelease({
                ...newRelease,
                module_type_id: activeTypeId || newRelease.module_type_id
            });
            if (response.success) {
                setShowAddModal(false);
                setNewRelease({ module_type_id: 0, version_number: '', title: '', change_log: '' });
                fetchReleases();
            }
        } catch (error) {
            console.error('创建发布版本失败:', error);
            alert('创建失败，请检查输入');
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

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">版本发布中心</h1>
                        <p className="text-gray-600 mt-1">管理各模块类型的正式发布版本</p>
                    </div>
                    <button
                        onClick={() => {
                            setNewRelease({ ...newRelease, module_type_id: activeTypeId || 0 });
                            setShowAddModal(true);
                        }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        <PlusIcon className="h-5 w-5" />
                        发布新版本
                    </button>
                </div>

                {/* 模块类型 Tabs */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="border-b border-gray-200">
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
                        {loading ? (
                            <div className="text-center py-12">加载中...</div>
                        ) : releases.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {releases.map((release) => (
                                    <div key={release.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-gray-50">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold font-mono">
                                                {release.version_number}
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
                                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center bg-transparent">
                                            <span className="text-xs text-gray-400">ID: {release.id}</span>
                                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                                查看详情 →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                <TagIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">该分类下暂无已发布的版本记录</p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="mt-4 text-blue-600 font-medium hover:underline"
                                >
                                    立即发布第一个版本
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 新增发布版本 Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">发布新版本 - {moduleTypes.find(t => t.id === activeTypeId)?.name}</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                                <PlusIcon className="h-6 w-6 rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRelease} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">版本号</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例如: V1.2.0"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    value={newRelease.version_number}
                                    onChange={e => setNewRelease({ ...newRelease, version_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">版本标题</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例如: 优化视觉算法，提升识别率"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    value={newRelease.title}
                                    onChange={e => setNewRelease({ ...newRelease, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">变更日志 (Change Log)</label>
                                <textarea
                                    rows={4}
                                    placeholder="详细说明本次发布的改进内容..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    value={newRelease.change_log}
                                    onChange={e => setNewRelease({ ...newRelease, change_log: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                                >
                                    确认发布
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ReleaseLibrary;
