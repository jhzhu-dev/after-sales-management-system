import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PlusIcon, TrashIcon, EyeIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon, ChatBubbleLeftRightIcon, ArrowPathIcon, MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { issueApi, customerApi, moduleTypeApi, productLineApi, moduleVersionApi } from '../services/api';
import { Issue, FilterOptions, IssueFormData } from '../types';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import IssueForm from '../components/IssueForm';
import ExportButton from '../components/ExportButton';
import { exportToExcel } from '../utils/exportUtils';
import { formatDate, getStatusColor, getSeverityColor } from '../utils';

export default function Issues() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'issues' | 'upgrades'>('issues');

  // 从URL参数读取tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'issues' || tab === 'upgrades') {
      setActiveTab(tab);
    }
  }, [location.search]);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState<FilterOptions>({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    severity: '',
    module: '',
    device_type: '',
    customer: ''
  });
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIssues, setSelectedIssues] = useState<number[]>([]);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [moduleTypes, setModuleTypes] = useState<Array<{id: number, name: string}>>([]);
const [productLines, setProductLines] = useState<Array<{id: number, name: string}>>([]);

  // 版本演进 State
  const [upgrades, setUpgrades] = useState<any[]>([]);
  const [upgradeTotal, setUpgradeTotal] = useState(0);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeFilters, setUpgradeFilters] = useState({
    search: '',
    module_type: '',
    version_type: '',
    customer: ''
  });
  const [customers, setCustomers] = useState<any[]>([]);
  const [printAllIssues, setPrintAllIssues] = useState<Issue[] | null>(null);

  useEffect(() => {
    if (activeTab === 'issues') {
      console.log('useEffect触发，当前筛选条件:', filters);
      fetchIssues();
    }
  }, [filters, activeTab]);

  // 版本演进数据
  useEffect(() => {
    if (activeTab === 'upgrades') {
      fetchUpgrades();
      if (customers.length === 0) fetchCustomers();
    }
  }, [activeTab, upgradeFilters]);

  // 添加一个useEffect来监听筛选条件变化
  useEffect(() => {
    console.log('筛选条件已更新:', filters);
  }, [filters]);

  // 获取模块类型和产品线列表
  useEffect(() => {
    fetchModuleTypes();
    fetchProductLines();
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const result = await customerApi.getCustomers();
      if (result.success) {
        setCustomers(result.data);
      }
    } catch (error) {
      console.error('获取客户列表失败:', error);
    }
  };

  const fetchUpgrades = async () => {
    try {
      setUpgradeLoading(true);
      const params = new URLSearchParams({ page: '1', limit: '200' });
      if (upgradeFilters.version_type) params.append('version_type', upgradeFilters.version_type);

      const result = await moduleVersionApi.getModuleVersions(Object.fromEntries(params.entries()));
      if (result.success) {
        let allData = result.data;
        // 按模块分组，计算每条update记录的旧版本号
        const byModule: Record<string, any[]> = {};
        allData.forEach((v: any) => {
          const key = v.module_id;
          if (!byModule[key]) byModule[key] = [];
          byModule[key].push(v);
        });
        Object.values(byModule).forEach(arr =>
          arr.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        );
        allData = allData.map((v: any) => {
          if (v.version_type === 'update') {
            const moduleVersions = byModule[v.module_id] || [];
            const idx = moduleVersions.findIndex((mv: any) => mv.id === v.id);
            const oldVersion = idx > 0 ? moduleVersions[idx - 1].version_number : null;
            return { ...v, old_version: oldVersion };
          }
          return v;
        });
        let filteredData = allData;
        if (upgradeFilters.search) {
          const s = upgradeFilters.search.toLowerCase();
          filteredData = filteredData.filter((item: any) =>
            [item.device_name, item.device_id, item.product_name, item.customer_name,
             item.module_type, item.version_number, item.old_version,
             item.description, item.updated_by]
              .some(v => v && String(v).toLowerCase().includes(s))
          );
        }
        if (upgradeFilters.module_type) {
          filteredData = filteredData.filter((item: any) => item.module_type === upgradeFilters.module_type);
        }
        if (upgradeFilters.customer) {
          filteredData = filteredData.filter((item: any) => item.customer_name === upgradeFilters.customer);
        }
        setUpgrades(filteredData);
        setUpgradeTotal(filteredData.length);
      }
    } catch (error) {
      console.error('获取版本升级历史失败:', error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const fetchModuleTypes = async () => {
    try {
      const result = await moduleTypeApi.getActiveModuleTypes();
      if (result.success) {
        setModuleTypes(result.data);
      }
    } catch (error) {
      console.error('获取模块类型列表失败:', error);
    }
  };

  const fetchProductLines = async () => {
    try {
      const result = await productLineApi.getProductLines({ is_active: true });
      if (result.success) {
        setProductLines(result.data);
      }
    } catch (error) {
      console.error('获取产品线列表失败:', error);
    }
  };

  const fetchIssues = async () => {
    try {
      setLoading(true);
      console.log('发送筛选参数:', filters);
      const response = await issueApi.getIssues(filters);
      if (response.success) {
        console.log('获取到的问题数据:', response.data.length, '个问题');
        
        // 详细的问题信息
        const issues = response.data;
        console.log('问题详情:');
        issues.forEach((issue, index) => {
          console.log(`  [${index + 1}] ID: ${issue.id}, 描述: ${issue.description}, 严重性: ${issue.severity}, 状态: ${issue.status}`);
        });
        
        // 统计信息
        const statusStats = issues.reduce((acc: Record<string, number>, issue) => {
          acc[issue.status] = (acc[issue.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const severityStats = issues.reduce((acc: Record<string, number>, issue) => {
          acc[issue.severity] = (acc[issue.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log('问题状态分布:', statusStats);
        console.log('问题严重性分布:', severityStats);
        
        setIssues(issues);
        setPagination({
          current: response.pagination.page,
          pageSize: response.pagination.limit,
          total: response.pagination.total,
          pages: response.pagination.pages
        });
      }
    } catch (error) {
      console.error('获取问题列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    console.log(`筛选器变化: ${key} = ${value}`);
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value, page: 1 };
      console.log('新的筛选条件:', newFilters);
      return newFilters;
    });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters(prev => ({ ...prev, page, limit: pageSize }));
  };

  const handleSort = (field: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortField === field && sortOrder === 'asc') {
      newOrder = 'desc';
    }
    setSortField(field);
    setSortOrder(newOrder);
    
    // 对当前数据进行排序
    const sortedIssues = [...issues].sort((a, b) => {
      const aValue = a[field as keyof Issue];
      const bValue = b[field as keyof Issue];
      
      if (aValue === bValue) return 0;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return newOrder === 'asc' 
          ? aValue.localeCompare(bValue, 'zh-CN')
          : bValue.localeCompare(aValue, 'zh-CN');
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return newOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
    
    setIssues(sortedIssues);
  };

  const handleDelete = async (id: number, event?: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发行点击事件
    if (event) {
      event.stopPropagation();
    }
    
    if (window.confirm('确定要删除这个问题吗？')) {
      try {
        const response = await issueApi.deleteIssue(id.toString());
        if (response.success) {
          // 删除成功后，检查当前路径
          const currentPath = window.location.pathname;
          
          // 如果当前在问题详情页，跳转到问题列表页
          if (currentPath.includes(`/issues/${id}`)) {
            navigate('/issues');
          } else if (currentPath === '/issues') {
            // 如果当前就在问题管理页面，只需要刷新列表
            await fetchIssues();
          } else {
            // 其他情况，也跳转到问题管理页面
            navigate('/issues');
          }
        }
      } catch (error) {
        console.error('删除问题失败:', error);
        alert('删除问题失败');
      }
    }
  };

  const handleAdd = () => {
    setShowIssueForm(true);
  };

  const handlePrint = async () => {
    if (activeTab === 'issues') {
      try {
        const resp = await issueApi.getIssues({ ...filters, page: 1, limit: 9999 });
        if (resp.success) {
          setPrintAllIssues(resp.data);
          return;
        }
      } catch (e) {}
    }
    window.print();
  };

  const ISSUE_EXPORT_COLUMNS = [
    { key: 'id', label: '问题ID' },
    { key: 'device_name', label: '订单号' },
    { key: 'customer_name', label: '客户' },
    { key: 'module_category', label: '模块' },
    { key: 'description', label: '问题描述' },
    { key: 'severity_label', label: '严重性' },
    { key: 'status_label', label: '状态' },
    { key: 'assignee', label: '责任人' },
    { key: 'created_at', label: '创建时间' },
  ];

  const UPGRADE_EXPORT_COLUMNS = [
    { key: 'device_name', label: '订单号' },
    { key: 'device_id', label: '设备序列号' },
    { key: 'product_name', label: '产品名称' },
    { key: 'customer_name', label: '客户' },
    { key: 'product_version_display', label: '迭代版本' },
    { key: 'module_type', label: '模块类型' },
    { key: 'old_version', label: '旧版本号' },
    { key: 'version_number', label: '新版本号' },
    { key: 'version_label', label: '版本类型' },
    { key: 'description', label: '变更说明' },
    { key: 'updated_by', label: '操作人' },
    { key: 'release_date', label: '发布日期' },
  ];

  const handleExportIssues = async () => {
    try {
      const resp = await issueApi.getIssues({ ...filters, page: 1, limit: 9999 });
      if (!resp.success) return;
      const severityMap: Record<string, string> = { low: '低', medium: '中', high: '高' };
      const statusMap: Record<string, string> = { open: '待处理', in_progress: '处理中', closed: '已解决' };
      const rows = resp.data.map((issue: any) => ({
        ...issue,
        severity_label: severityMap[issue.severity] || issue.severity,
        status_label: statusMap[issue.status] || issue.status,
        created_at: issue.created_at ? new Date(issue.created_at).toLocaleDateString('zh-CN') : '',
      }));
      const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
      exportToExcel(rows, ISSUE_EXPORT_COLUMNS, `故障管理_${timestamp}`);
    } catch (e) {
      console.error('导出失败:', e);
    }
  };

  const handleExportUpgrades = () => {
    const versionTypeMap: Record<string, string> = { factory: '出厂', update: '更新' };
    const rows = upgrades.map((v: any) => ({
      ...v,
      version_label: versionTypeMap[v.version_type] || v.version_type,
      release_date: v.release_date ? new Date(v.release_date).toLocaleDateString('zh-CN') : '',
      product_name: v.product_name || '-',
      customer_name: v.customer_name || '-',
      product_version_display: v.product_version_number ? `${v.product_version_number}${v.product_version_name ? ' - ' + v.product_version_name : ''}` : '-',
    }));
    const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
    exportToExcel(rows, UPGRADE_EXPORT_COLUMNS, `版本演进_${timestamp}`);
  };

  // 打印数据加载后触发打印
  useEffect(() => {
    if (printAllIssues !== null) {
      setTimeout(() => { window.print(); setPrintAllIssues(null); }, 100);
    }
  }, [printAllIssues]);

  const handleIssueSubmit = async (data: IssueFormData) => {
    try {
      await issueApi.createIssue(data);
      await fetchIssues();
      setShowIssueForm(false);
    } catch (error) {
      console.error('保存问题失败:', error);
      throw error;
    }
  };

  const handleRowClick = (issue: Issue) => {
    navigate(`/issues/${issue.id}`);
  };

  const handleBatchStatusUpdate = async (status: string) => {
    if (selectedIssues.length === 0) {
      alert('请选择要更新的问题');
      return;
    }

    try {
      const response = await issueApi.batchUpdateStatus(selectedIssues, status);
      if (response.success) {
        setSelectedIssues([]);
        fetchIssues();
        alert('批量更新成功');
      }
    } catch (error) {
      console.error('批量更新失败:', error);
      alert('批量更新失败');
    }
  };

  const handleSelectIssue = (id: number) => {
    setSelectedIssues(prev => 
      prev.includes(id) 
        ? prev.filter(issueId => issueId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIssues.length === issues.length) {
      setSelectedIssues([]);
    } else {
      setSelectedIssues(issues.map(issue => issue.id));
    }
  };

  const SortableHeader = ({ field, title }: { field: string; title: string }) => {
    const isActive = sortField === field;
    return (
      <div 
        className="flex items-center space-x-1 cursor-pointer hover:text-blue-600 select-none"
        onClick={() => handleSort(field)}
      >
        <span>{title}</span>
        <div className="flex flex-col">
          <ChevronUpIcon 
            className={`h-3 w-3 ${isActive && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
          />
          <ChevronDownIcon 
            className={`h-3 w-3 -mt-1 ${isActive && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
          />
        </div>
      </div>
    );
  };

  const columns = [
    {
      key: 'select' as keyof Issue,
      title: (
        <input
          type="checkbox"
          checked={selectedIssues.length === issues.length && issues.length > 0}
          onChange={handleSelectAll}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      render: (value: any, record: Issue) => (
        <input
          type="checkbox"
          checked={selectedIssues.includes(record.id)}
          onChange={() => handleSelectIssue(record.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      width: '50px'
    },
    {
      key: 'id' as keyof Issue,
      title: <SortableHeader field="id" title="问题ID" />,
      render: (value: number, record: Issue) => (
        <Link 
          to={`/issues/${value}`} 
          className="text-blue-600 hover:text-blue-800 font-medium text-xs font-mono"
        >
          #{value}
        </Link>
      ),
      width: '140px'
    },
    {
      key: 'device_name' as keyof Issue,
      title: <SortableHeader field="device_name" title="订单号" />,
      render: (value: string, record: Issue) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{record.device_type || '-'}</div>
        </div>
      ),
      width: '140px'
    },
    {
      key: 'customer_name' as keyof Issue,
      title: <SortableHeader field="customer_name" title="客户" />,
      render: (value: string) => (
        <div className="text-gray-900">{value || '-'}</div>
      ),
      width: '100px'
    },
    {
      key: 'module_category' as keyof Issue,
      title: <SortableHeader field="module_category" title="模块" />,
      render: (value: string) => (
        <div className="text-gray-900">{value || '-'}</div>
      ),
      width: '80px'
    },
    {
      key: 'description' as keyof Issue,
      title: <SortableHeader field="description" title="问题描述" />,
      render: (value: string) => (
        <div className="max-w-xs truncate text-gray-900" title={value}>
          {value}
        </div>
      )
    },
    {
      key: 'severity' as keyof Issue,
      title: <SortableHeader field="severity" title="严重性" />,
      width: '80px',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(value)}`}>
          {value === 'low' ? '低' : value === 'medium' ? '中' : '高'}
        </span>
      )
    },
    {
      key: 'status' as keyof Issue,
      title: <SortableHeader field="status" title="状态" />,
      width: '80px',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value === 'open' ? '待处理' : value === 'in_progress' ? '处理中' : '已解决'}
        </span>
      )
    },
    {
      key: 'created_at' as keyof Issue,
      title: <SortableHeader field="created_at" title="创建时间" />,
      width: '110px',
      render: (value: string) => (
        <div className="text-gray-500">{formatDate(value, 'yyyy-MM-dd')}</div>
      )
    },
    {
      key: 'actions' as keyof Issue,
      title: '操作',
      width: '70px',
      render: (value: any, record: Issue) => (
        <div className="flex items-center space-x-2">
          <Link
            to={`/issues/${record.id}`}
            className="text-blue-600 hover:text-blue-800"
            title="查看详情"
            onClick={(e) => e.stopPropagation()}
          >
            <EyeIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={(e) => handleDelete(record.id, e)}
            className="text-red-600 hover:text-red-800"
            title="删除"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const renderUpgrades = () => {
    const upgradeColumns = [
      {
        key: 'device_name',
        title: '订单号',
        render: (_: any, item: any) => (
          <div>
            <div className="font-medium text-gray-900">{item.device_name}</div>
            <div className="text-xs text-gray-500">{item.device_id}</div>
          </div>
        )
      },
      {
        key: 'product_name',
        title: '产品名称',
        render: (_: any, item: any) => (
          <div className="text-sm text-gray-900">{item.product_name || '-'}</div>
        )
      },
      {
        key: 'customer_name',
        title: '客户',
        render: (_: any, item: any) => (
          <div className="text-sm text-gray-900">{item.customer_name || '-'}</div>
        )
      },
      {
        key: 'product_version',
        title: '迭代版本',
        render: (_: any, item: any) => (
          <div className="text-sm text-gray-900">
            {item.product_version_number
              ? `${item.product_version_number}${item.product_version_name ? ' - ' + item.product_version_name : ''}`
              : '-'}
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
            {item.version_type === 'update' && item.old_version && (
              <>
                <span className="font-mono text-gray-400">{item.old_version}</span>
                <span className="text-gray-400">→</span>
              </>
            )}
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
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索订单号、产品名称、客户、版本号、变更说明..."
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
            <ExportButton
              onExport={handleExportUpgrades}
            />
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              打印
            </button>
            <p className="text-sm text-gray-500 whitespace-nowrap">共 {upgradeTotal} 条</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable
            columns={upgradeColumns as any}
            data={upgrades}
            loading={upgradeLoading}
            rowKey="id"
          />
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-4 3xl:space-y-6">
        {/* 打印专用页眉 */}
        <div className="hidden print:block print-header">
          <div className="print-flex-row" style={{justifyContent:'space-between'}}>
            <div>
              <h1 style={{fontSize:'13pt',fontWeight:'800',margin:0}}>故障与升级 — {activeTab === 'issues' ? '故障管理' : '版本演进'}</h1>
              <p style={{fontSize:'8pt',color:'#6b7280',marginTop:'2pt'}}>打印时间：{new Date().toLocaleString('zh-CN')}</p>
            </div>
            <div style={{fontSize:'8pt',color:'#6b7280',textAlign:'right'}}>
              {activeTab === 'issues' && <span>共 {printAllIssues ? printAllIssues.length : pagination.total} 条故障记录</span>}
              {activeTab === 'upgrades' && <span>共 {upgradeTotal} 条版本演进记录</span>}
            </div>
          </div>
        </div>

        {/* 顶部标题与Tab切换 */}
        <div className="bg-white p-4 3xl:p-6 rounded-2xl shadow-sm border border-gray-100 no-print">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl 3xl:text-2xl font-black text-gray-900 tracking-tight">故障与升级</h1>
              <p className="text-gray-500 text-sm mt-1 font-medium">统一管理全生命周期的故障报修与升级演进</p>
            </div>
            <div className="flex items-center gap-3">
            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
              {[
                { id: 'issues' as const, label: '故障管理', icon: ChatBubbleLeftRightIcon },
                { id: 'upgrades' as const, label: '版本演进', icon: ArrowPathIcon }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === tab.id
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
        </div>

        {/* 版本演进内容 */}
        {activeTab === 'upgrades' && <div className="no-print">{renderUpgrades()}</div>}

        {/* 故障管理内容 */}
        {activeTab === 'issues' && (<>

        {/* 批量操作按钮 */}
        <div className="flex justify-end gap-2 no-print">
          <ExportButton
            onExport={handleExportIssues}
          />
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <PrinterIcon className="h-4 w-4 mr-2" />
            打印
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            新增问题
          </button>
        </div>

        {/* 批量操作 */}
        {selectedIssues.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 no-print">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                已选择 {selectedIssues.length} 个问题
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBatchStatusUpdate('in_progress')}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-orange-700 bg-orange-100 hover:bg-orange-200"
                >
                  标记为处理中
                </button>
                <button
                  onClick={() => handleBatchStatusUpdate('closed')}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200"
                >
                  <CheckIcon className="h-3 w-3 mr-1" />
                  标记为已解决
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 筛选器 */}
        <div className="bg-white rounded-lg shadow p-4 3xl:p-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索
              </label>
              <input
                type="text"
                placeholder="搜索问题描述或订单号"
                value={filters.search || ''}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                客户
              </label>
              <select
                value={filters.customer || ''}
                onChange={(e) => handleFilterChange('customer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部客户</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                产品线
              </label>
              <select
                value={filters.device_type || ''}
                onChange={(e) => handleFilterChange('device_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部产品线</option>
                {productLines.map((productLine) => (
                  <option key={productLine.id} value={productLine.name}>
                    {productLine.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                模块类型
              </label>
              <select
                value={filters.module || ''}
                onChange={(e) => handleFilterChange('module', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部模块</option>
                {moduleTypes.map((moduleType) => (
                  <option key={moduleType.id} value={moduleType.name}>
                    {moduleType.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                严重性
              </label>
              <select
                value={filters.severity || ''}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部严重性</option>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                状态
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => {
                  console.log('状态筛选器变化:', e.target.value);
                  handleFilterChange('status', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部状态</option>
                <option value="open">待处理</option>
                <option value="in_progress">处理中</option>
                <option value="closed">已解决</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ page: 1, limit: 10, search: '', status: '', severity: '', module: '', device_type: '', customer: '' })}
                className="w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        {/* 数据表格 */}
        <div className="print:hidden">
          <DataTable
            data={issues}
            columns={columns}
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: handlePageChange
            }}
            rowKey="id"
            onRowClick={handleRowClick}
          />
        </div>

        {/* 打印专用故障表格 */}
        <div className="hidden print:block">
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'8pt'}}>
            <thead>
              <tr style={{borderBottom:'1pt solid #374151',backgroundColor:'#f9fafb'}}>
                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>问题ID</th>
                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>订单号</th>
                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>客户</th>
                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>模块</th>
                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>问题描述</th>
                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>严重性</th>
                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>状态</th>
                <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {(printAllIssues ?? issues).map((issue, i) => (
                <tr key={issue.id} style={{borderBottom:'0.5pt solid #e5e7eb',backgroundColor:i%2===0?'white':'#f9fafb'}}>
                  <td style={{padding:'3pt 6pt',fontFamily:'monospace'}}>#{issue.id}</td>
                  <td style={{padding:'3pt 6pt'}}>{issue.device_name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{issue.customer_name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{issue.module_category || '-'}</td>
                  <td style={{padding:'3pt 6pt',maxWidth:'180pt',wordBreak:'break-word'}}>{issue.description}</td>
                  <td style={{padding:'3pt 6pt'}}>{issue.severity === 'low' ? '低' : issue.severity === 'medium' ? '中' : '高'}</td>
                  <td style={{padding:'3pt 6pt'}}>{issue.status === 'open' ? '待处理' : issue.status === 'in_progress' ? '处理中' : '已解决'}</td>
                  <td style={{padding:'3pt 6pt'}}>{new Date(issue.created_at).toLocaleDateString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        </>)}

        {/* 打印专用版本演进表格 */}
        {activeTab === 'upgrades' && (
          <div className="hidden print:block">
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'8pt'}}>
              <thead>
                <tr style={{borderBottom:'1pt solid #374151',backgroundColor:'#f9fafb'}}>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>订单号</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>产品线</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>产品型号</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>迭代版本</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>模块类型</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>版本号</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>版本类型</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>变更说明</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>操作人</th>
                  <th style={{padding:'4pt 6pt',textAlign:'left',fontWeight:'600'}}>发布日期</th>
                </tr>
              </thead>
              <tbody>
                {upgrades.map((v, i) => (
                  <tr key={v.id} style={{borderBottom:'0.5pt solid #e5e7eb',backgroundColor:i%2===0?'white':'#f9fafb'}}>
                    <td style={{padding:'3pt 6pt'}}>{v.device_name || '-'}</td>
                    <td style={{padding:'3pt 6pt'}}>{v.device_type || '-'}</td>
                    <td style={{padding:'3pt 6pt'}}>{v.product_model || '-'}</td>
                    <td style={{padding:'3pt 6pt'}}>{v.product_version_number ? `${v.product_version_number}${v.product_version_name ? ' - ' + v.product_version_name : ''}` : '-'}</td>
                    <td style={{padding:'3pt 6pt'}}>{v.module_type || '-'}</td>
                    <td style={{padding:'3pt 6pt',fontFamily:'monospace'}}>{v.old_version ? `${v.old_version} → ` : ''}{v.version_number}</td>
                    <td style={{padding:'3pt 6pt'}}>{v.version_type === 'factory' ? '出厂' : '更新'}</td>
                    <td style={{padding:'3pt 6pt',maxWidth:'160pt',wordBreak:'break-word'}}>{v.description || '-'}</td>
                    <td style={{padding:'3pt 6pt'}}>{v.updated_by || '-'}</td>
                    <td style={{padding:'3pt 6pt'}}>{v.release_date ? new Date(v.release_date).toLocaleDateString('zh-CN') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 新增问题表单弹窗 */}
        {showIssueForm && (
          <IssueForm
            onClose={() => setShowIssueForm(false)}
            onSubmit={handleIssueSubmit}
          />
        )}
      </div>
    </Layout>
  );
}
