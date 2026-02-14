import React, { useState, useEffect } from 'react';
import {
    PlusIcon,
    ArrowPathIcon,
    TrashIcon,
    PencilSquareIcon,
    WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import { deviceUpgradeApi } from '../services/api';
import { DeviceUpgrade } from '../types';
import DataTable from '../components/DataTable';
import Layout from '../components/Layout';

export default function Upgrades() {
    const [upgrades, setUpgrades] = useState<DeviceUpgrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);

    useEffect(() => {
        fetchUpgrades();
    }, [page]);

    const fetchUpgrades = async () => {
        try {
            setLoading(true);
            const response = await deviceUpgradeApi.getUpgrades({ page, limit });
            if (response.success) {
                setUpgrades(response.data);
                setTotal(response.pagination.total);
            }
        } catch (error) {
            console.error('获取升级记录失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('确定要删除这条升级记录吗？')) return;
        try {
            const response = await deviceUpgradeApi.deleteUpgrade(id);
            if (response.success) {
                fetchUpgrades();
            }
        } catch (error) {
            console.error('删除升级记录失败:', error);
        }
    };

    const columns = [
        { key: 'device_name' as keyof DeviceUpgrade, title: '设备名称' },
        { key: 'device_id' as keyof DeviceUpgrade, title: '设备代码' },
        {
            key: 'upgrade_type' as keyof DeviceUpgrade,
            title: '升级类型',
            render: (val: string) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${val === '硬件升级' ? 'bg-orange-100 text-orange-700' :
                        val === '软件更新' ? 'bg-blue-100 text-blue-700' :
                            'bg-purple-100 text-purple-700'
                    }`}>
                    {val}
                </span>
            )
        },
        {
            key: 'old_version' as keyof DeviceUpgrade,
            title: '版本演进',
            render: (_: any, item: DeviceUpgrade) => (
                <div className="text-sm">
                    <span className="text-gray-400">{item.old_version || 'N/A'}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium text-blue-600">{item.new_version || 'N/A'}</span>
                </div>
            )
        },
        { key: 'operator_id' as keyof DeviceUpgrade, title: '执行人' },
        {
            key: 'upgrade_at' as keyof DeviceUpgrade,
            title: '升级时间',
            render: (val: string) => new Date(val).toLocaleString('zh-CN')
        },
        {
            key: 'cost' as keyof DeviceUpgrade,
            title: '成本',
            render: (val: number) => `¥${val.toLocaleString()}`
        },
        {
            key: 'id' as keyof DeviceUpgrade,
            title: '操作',
            render: (_: any, item: DeviceUpgrade) => (
                <div className="flex space-x-2">
                    <button
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="编辑"
                    >
                        <PencilSquareIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="删除"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            )
        }
    ];

    if (loading && upgrades.length === 0) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-64">加载中...</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">设备升级记录</h1>
                        <p className="text-sm text-gray-500 mt-1">追踪所有设备的软硬件版本迭代历史</p>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={fetchUpgrades}
                            className="p-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            新增升级记录
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <DataTable
                        columns={columns as any}
                        data={upgrades}
                        loading={loading}
                        rowKey="id"
                    />

                    {/* 分页 */}
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                        <div className="text-sm text-gray-500">
                            共 <span className="font-medium text-gray-900">{total}</span> 条记录
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-white"
                            >
                                上一页
                            </button>
                            <span className="px-3 py-1 text-sm font-medium">
                                第 {page} 页 / 共 {Math.ceil(total / limit) || 1} 页
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= Math.ceil(total / limit) || loading}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-white"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                </div>

                {upgrades.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
                        <WrenchScrewdriverIcon className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-gray-500">暂无升级记录</p>
                        <button className="mt-4 text-blue-600 font-medium hover:underline">立即添加首条记录</button>
                    </div>
                )}
            </div>
        </Layout>
    );
}
