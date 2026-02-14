import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
    PlusIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    ChatBubbleLeftRightIcon,
    ChevronUpIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline';
import { issueApi } from '../services/api';
import { Issue, FilterOptions, IssueFormData } from '../types';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import IssueForm from '../components/IssueForm';
import { formatDate, getStatusColor, getSeverityColor } from '../utils';

export default function AfterSales() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'issues' | 'upgrades'>('issues');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'issues' || tab === 'upgrades') {
            setActiveTab(tab as any);
        }
    }, [location.search]);

    const [loading, setLoading] = useState(true);

    // Issues State
    const [allIssues, setAllIssues] = useState<Issue[]>([]);
    const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
    const [issuePagination, setIssuePagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
        pages: 0
    });
    const [issueFilters, setIssueFilters] = useState<FilterOptions>({
        page: 1,
        limit: 10,
        search: '',
        status: '',
        severity: ''
    });
    const [issueSortField, setIssueSortField] = useState<string>('created_at');
    const [issueSortOrder, setIssueSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showIssueForm, setShowIssueForm] = useState(false);
    const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
    const [isIssuesInitialized, setIsIssuesInitialized] = useState(false);

    // Upgrades State - 改为子模块版本历史
    const [upgrades, setUpgrades] = useState<any[]>([]);
    const [upgradeTotal, setUpgradeTotal] = useState(0);
    const [upgradePage] = useState(1);
    const [upgradeFilters, setUpgradeFilters] = useState({
        search: '',
        module_type: '',
        version_type: '',
        customer: ''
    });

    // 客户和地区列表
    const [customers, setCustomers] = useState<any[]>([]);
    const [regions, setRegions] = useState<string[]>([]);

    const fetchCustomers = async () => {
        try {
            const res = await fetch('/api/customers');
            const result = await res.json();
            if (result.success) {
                setCustomers(result.data);
            }
        } catch (error) {
            console.error('获取客户列表失败:', error);
        }
    };

    const fetchAllIssues = async () => {
        try {
            console.log('开始获取所有故障数据');
            setLoading(true);
            const res = await issueApi.getIssues({ page: 1, limit: 1000 });
            console.log('故障列表API响应:', res);
            if (res.success) {
                console.log('设置所有故障数据:', res.data);
                setAllIssues(res.data);
                // 提取唯一地区列表
                const uniqueRegions = [...new Set(res.data.map((i: any) => i.device_location).filter(Boolean))];
                setRegions(uniqueRegions as string[]);
            } else {
                console.error('API返回失败:', res);
            }
        } catch (error) {
            console.error('获取问题列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyIssueFilters = useCallback(() => {
        let filtered = [...allIssues];

        // 搜索过滤
        if (issueFilters.search) {
            const searchLower = issueFilters.search.toLowerCase();
            filtered = filtered.filter(issue =>
                issue.description.toLowerCase().includes(searchLower) ||
                (issue.device_name && issue.device_name.toLowerCase().includes(searchLower)) ||
                issue.device_id.toLowerCase().includes(searchLower) ||
                (issue.assignee && issue.assignee.toLowerCase().includes(searchLower)) ||
                (issue.customer_name && issue.customer_name.toLowerCase().includes(searchLower)) ||
                (issue.device_location && issue.device_location.toLowerCase().includes(searchLower))
            );
        }

        // 状态过滤
        if (issueFilters.status) {
            filtered = filtered.filter(issue => issue.status === issueFilters.status);
        }

        // 严重性过滤
        if (issueFilters.severity) {
            filtered = filtered.filter(issue => issue.severity === issueFilters.severity);
        }

        // 客户过滤
        if ((issueFilters as any).customer) {
            const custId = (issueFilters as any).customer;
            const cust = customers.find(c => String(c.id) === String(custId));
            if (cust) {
                filtered = filtered.filter(issue => (issue as any).customer_name === cust.name);
            }
        }

        // 地区过滤
        if ((issueFilters as any).region) {
            filtered = filtered.filter(issue => (issue as any).device_location === (issueFilters as any).region);
        }

        // 排序
        if (issueSortField) {
            filtered.sort((a, b) => {
                const aValue = a[issueSortField as keyof Issue];
                const bValue = b[issueSortField as keyof Issue];

                if (aValue === bValue) return 0;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return issueSortOrder === 'asc'
                        ? aValue.localeCompare(bValue, 'zh-CN')
                        : bValue.localeCompare(aValue, 'zh-CN');
                }

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return issueSortOrder === 'asc' ? aValue - bValue : bValue - aValue;
                }

                return 0;
            });
        }

        // 分页
        const page = issueFilters.page || 1;
        const limit = issueFilters.limit || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedIssues = filtered.slice(startIndex, endIndex);

        setFilteredIssues(paginatedIssues);
        setIssuePagination({
            current: page,
            pageSize: limit,
            total: filtered.length,
            pages: Math.ceil(filtered.length / limit)
        });
    }, [allIssues, issueFilters, issueSortField, issueSortOrder, customers]);

    useEffect(() => {
        fetchCustomers();
    }, []);

    // 初始化时获取数据
    useEffect(() => {
        if (activeTab === 'issues' && !isIssuesInitialized) {
            console.log('首次初始化故障列表，获取数据');
            fetchAllIssues();
            setIsIssuesInitialized(true);
        }
    }, [activeTab, isIssuesInitialized]);

    // 实时过滤效果
    useEffect(() => {
        if (isIssuesInitialized && allIssues.length > 0) {
            console.log('执行实时过滤，filters:', issueFilters);
            applyIssueFilters();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issueFilters, allIssues, isIssuesInitialized, issueSortField, issueSortOrder]);

    // 其他tab的数据获取
    useEffect(() => {
        if (activeTab === 'upgrades') fetchUpgrades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, upgradePage, upgradeFilters]);

    const fetchUpgrades = async () => {
        try {
            setLoading(true);
            // 构建查询参数
            const params = new URLSearchParams({
                page: upgradePage.toString(),
                limit: '200'  // 增加limit以便前端筛选
            });
            if (upgradeFilters.search) params.append('search', upgradeFilters.search);
            if (upgradeFilters.version_type) params.append('version_type', upgradeFilters.version_type);
            
            // 获取所有模块版本历史
            const res = await fetch(`/api/versions?${params.toString()}`);
            const result = await res.json();
            if (result.success) {
                // 如果有模块类型或客户筛选，在前端过滤
                let filteredData = result.data;
                if (upgradeFilters.module_type) {
                    filteredData = filteredData.filter((item: any) => 
                        item.module_type === upgradeFilters.module_type
                    );
                }
                if (upgradeFilters.customer) {
                    // 通过客户名称筛选（简化版本）
                    filteredData = filteredData.filter((item: any) => 
                        item.customer_name === upgradeFilters.customer
                    );
                }
                setUpgrades(filteredData);
                setUpgradeTotal(filteredData.length);
            }
        } catch (error) {
            console.error('获取版本升级历史失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleIssueSubmit = async (data: IssueFormData) => {
        if (editingIssue) {
            await issueApi.updateIssue(editingIssue.id, data);
        } else {
            await issueApi.createIssue(data);
        }
        fetchAllIssues();
        setShowIssueForm(false);
    };

    const handleSort = (field: string) => {
        let newOrder: 'asc' | 'desc' = 'asc';
        if (issueSortField === field && issueSortOrder === 'asc') {
            newOrder = 'desc';
        }
        setIssueSortField(field);
        setIssueSortOrder(newOrder);
        // 排序逻辑现在在applyIssueFilters中处理，无需重新请求
    };

    const SortableHeader = ({ field, title }: { field: string; title: string }) => {
        const isActive = issueSortField === field;
        return (
            <div
                className="flex items-center space-x-1 cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
                onClick={() => handleSort(field)}
            >
                <span>{title}</span>
                <div className="flex flex-col">
                    <ChevronUpIcon
                        className={`h-3 w-3 ${isActive && issueSortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                    />
                    <ChevronDownIcon
                        className={`h-3 w-3 -mt-1 ${isActive && issueSortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                    />
                </div>
            </div>
        );
    };

    const renderIssues = () => {
        const columns = [
            { 
                key: 'id', 
                title: <SortableHeader field="id" title="编号" />,
                width: '80px',
                render: (val: any) => <span className="text-blue-600 font-medium">#{val}</span> 
            },
            {
                key: 'device_name',
                title: <SortableHeader field="device_name" title="设备名称" />,
                render: (val: string) => <span className="font-medium text-gray-900">{val || '未知设备'}</span>
            },
            {
                key: 'device_id',
                title: <SortableHeader field="device_id" title="SN码" />,
                render: (val: string) => <span className="font-mono text-sm text-gray-700">{val}</span>
            },
            {
                key: 'customer_name',
                title: <SortableHeader field="customer_name" title="客户" />,
                render: (val: string) => <span className="text-sm text-gray-900">{val || '-'}</span>
            },
            {
                key: 'device_location',
                title: <SortableHeader field="device_location" title="位置" />,
                render: (val: string) => <span className="text-sm text-gray-600">{val || '-'}</span>
            },
            {
                key: 'description',
                title: <SortableHeader field="description" title="故障描述" />,
                render: (val: string) => <div className="font-medium text-gray-900 truncate max-w-[120px]" title={val}>{val}</div>
            },
            {
                key: 'severity',
                title: <SortableHeader field="severity" title="严重性" />,
                width: '90px',
                render: (val: string) => (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getSeverityColor(val)}`}>
                        {val === 'high' ? '紧急' : val === 'medium' ? '中等' : '轻微'}
                    </span>
                )
            },
            {
                key: 'status',
                title: <SortableHeader field="status" title="当前状态" />,
                width: '100px',
                render: (val: string) => (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(val)}`}>
                        {val === 'open' ? '待处理' : val === 'in_progress' ? '处理中' : '已关闭'}
                    </span>
                )
            },
            { 
                key: 'assignee', 
                title: <SortableHeader field="assignee" title="负责人" />
            },
            {
                key: 'created_at',
                title: <SortableHeader field="created_at" title="提报日期" />,
                width: '110px',
                render: (val: string) => formatDate(val, 'yyyy-MM-dd')
            },
            {
                key: 'resolved_at',
                title: <SortableHeader field="resolved_at" title="处理时间" />,
                width: '110px',
                render: (val: string, item: Issue) => (
                    item.status === 'closed' && val
                        ? <span className="text-green-600 text-sm">{formatDate(val, 'yyyy-MM-dd')}</span>
                        : <span className="text-gray-400 text-sm">-</span>
                )
            },
            {
                key: 'actions',
                title: '操作',
                width: '60px',
                render: (_: any, item: Issue) => (
                    <button
                        onClick={() => { setEditingIssue(item); setShowIssueForm(true); }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                        详情/流转
                    </button>
                )
            }
        ];

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索故障描述、设备ID..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={issueFilters.search}
                                onChange={e => setIssueFilters(f => ({ ...f, search: e.target.value }))}
                            />
                        </div>
                        <select
                            className="bg-gray-50 border-none rounded-lg py-2 pl-3 pr-8 focus:ring-2 focus:ring-blue-500"
                            value={issueFilters.status}
                            onChange={e => setIssueFilters(f => ({ ...f, status: e.target.value }))}
                        >
                            <option value="">所有状态</option>
                            <option value="open">待处理</option>
                            <option value="in_progress">处理中</option>
                            <option value="closed">已关闭</option>
                        </select>
                        <select
                            className="bg-gray-50 border-none rounded-lg py-2 pl-3 pr-8 focus:ring-2 focus:ring-blue-500"
                            value={issueFilters.severity}
                            onChange={e => setIssueFilters(f => ({ ...f, severity: e.target.value }))}
                        >
                            <option value="">所有严重性</option>
                            <option value="high">紧急</option>
                            <option value="medium">中等</option>
                            <option value="low">轻微</option>
                        </select>
                        <select
                            className="bg-gray-50 border-none rounded-lg py-2 pl-3 pr-8 focus:ring-2 focus:ring-blue-500"
                            value={(issueFilters as any).customer || ''}
                            onChange={e => setIssueFilters(f => ({ ...f, customer: e.target.value } as any))}
                        >
                            <option value="">所有客户</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <select
                            className="bg-gray-50 border-none rounded-lg py-2 pl-3 pr-8 focus:ring-2 focus:ring-blue-500"
                            value={(issueFilters as any).region || ''}
                            onChange={e => setIssueFilters(f => ({ ...f, region: e.target.value } as any))}
                        >
                            <option value="">所有地区</option>
                            {regions.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowIssueForm(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium whitespace-nowrap"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            提报售后故障
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <DataTable
                        columns={columns as any}
                        data={filteredIssues}
                        loading={loading}
                        rowKey="id"
                        compact
                    />
                    {issuePagination.pages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                显示 {((issuePagination.current - 1) * issuePagination.pageSize) + 1} 到 {Math.min(issuePagination.current * issuePagination.pageSize, issuePagination.total)} 条，共 {issuePagination.total} 条记录
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setIssueFilters(prev => ({ ...prev, page: Math.max(1, issuePagination.current - 1) }))}
                                    disabled={issuePagination.current === 1}
                                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    上一页
                                </button>
                                {Array.from({ length: issuePagination.pages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setIssueFilters(prev => ({ ...prev, page }))}
                                        className={`px-3 py-1 text-sm border rounded ${
                                            issuePagination.current === page
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setIssueFilters(prev => ({ ...prev, page: Math.min(issuePagination.pages, issuePagination.current + 1) }))}
                                    disabled={issuePagination.current === issuePagination.pages}
                                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderUpgrades = () => {
        const columns = [
            { 
                key: 'device_name', 
                title: '设备名称',
                render: (_: any, item: any) => (
                    <div>
                        <div className="font-medium text-gray-900">{item.device_name}</div>
                        <div className="text-xs text-gray-500">{item.device_id}</div>
                    </div>
                )
            },
            { 
                key: 'module_type', 
                title: '模块类型',
                render: (val: string) => (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {val}
                    </span>
                )
            },
            {
                key: 'module_name',
                title: '模块',
                render: (_: any, item: any) => (
                    <div>
                        <div className="font-medium text-gray-900">{item.module_type || '-'}</div>
                        <div className="text-xs text-gray-500">{item.device_name || '-'}</div>
                    </div>
                )
            },
            {
                key: 'version_number',
                title: '版本号',
                render: (val: string, item: any) => (
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600">{val}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.version_type === 'factory' 
                                ? 'bg-gray-100 text-gray-600' 
                                : 'bg-green-100 text-green-700'
                        }`}>
                            {item.version_type === 'factory' ? '出厂' : '更新'}
                        </span>
                    </div>
                )
            },
            {
                key: 'description',
                title: '变更说明',
                render: (val: string) => (
                    <div className="text-sm text-gray-600 max-w-xs truncate" title={val}>
                        {val || '-'}
                    </div>
                )
            },
            { 
                key: 'updated_by', 
                title: '操作人',
                render: (val: string) => val || '-'
            },
            {
                key: 'release_date',
                title: '发布日期',
                render: (val: string) => val ? new Date(val).toLocaleDateString() : '-'
            }
        ];

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索设备、子模块名称..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={upgradeFilters.search}
                                onChange={e => setUpgradeFilters(f => ({ ...f, search: e.target.value }))}
                            />
                        </div>
                        <select
                            className="bg-gray-50 border-none rounded-lg py-2 pl-3 pr-8 focus:ring-2 focus:ring-blue-500"
                            value={upgradeFilters.module_type}
                            onChange={e => setUpgradeFilters(f => ({ ...f, module_type: e.target.value }))}
                        >
                            <option value="">所有模块类型</option>
                            <option value="机械">机械</option>
                            <option value="电气">电气</option>
                            <option value="上位机">上位机</option>
                            <option value="服务器">服务器</option>
                            <option value="视觉">视觉</option>
                        </select>
                        <select
                            className="bg-gray-50 border-none rounded-lg py-2 pl-3 pr-8 focus:ring-2 focus:ring-blue-500"
                            value={upgradeFilters.version_type}
                            onChange={e => setUpgradeFilters(f => ({ ...f, version_type: e.target.value }))}
                        >
                            <option value="">所有版本类型</option>
                            <option value="factory">出厂版本</option>
                            <option value="update">更新版本</option>
                        </select>
                        <select
                            className="bg-gray-50 border-none rounded-lg py-2 pl-3 pr-8 focus:ring-2 focus:ring-blue-500"
                            value={upgradeFilters.customer}
                            onChange={e => setUpgradeFilters(f => ({ ...f, customer: e.target.value }))}
                        >
                            <option value="">所有客户</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                        <div className="flex-1"></div>
                        <p className="text-sm text-gray-500 whitespace-nowrap">共 {upgradeTotal} 条</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <DataTable
                        columns={columns as any}
                        data={upgrades}
                        loading={loading}
                        rowKey="id"
                    />
                </div>
            </div>
        );
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* 顶部标题与Tab切换 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">售后中心</h1>
                            <p className="text-gray-500 text-sm mt-1 font-medium">统一管理全生命周期的故障报修、远程调试与升级演进</p>
                        </div>
                        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
                            {[
                                { id: 'issues', label: '故障管理', icon: ChatBubbleLeftRightIcon },
                                { id: 'upgrades', label: '版本演进', icon: ArrowPathIcon }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <tab.icon className={`w-4 h-4 mr-2 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="min-h-[60vh]">
                    {activeTab === 'issues' && renderIssues()}
                    {activeTab === 'upgrades' && renderUpgrades()}
                </div>
            </div>

            {/* 弹窗组件 */}
            {showIssueForm && (
                <IssueForm
                    issue={editingIssue}
                    onClose={() => { setShowIssueForm(false); setEditingIssue(null); }}
                    onSubmit={handleIssueSubmit}
                />
            )}
        </Layout>
    );
}
