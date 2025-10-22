import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { issueApi } from '../services/api';
import { Issue, FilterOptions, IssueFormData } from '../types';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import IssueForm from '../components/IssueForm';
import { formatDate, getStatusColor, getSeverityColor } from '../utils';

export default function Issues() {
  const navigate = useNavigate();
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
    device_type: ''
  });
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [moduleTypes, setModuleTypes] = useState<Array<{id: string, name: string}>>([]);
  const [deviceTypes, setDeviceTypes] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    console.log('useEffect触发，当前筛选条件:', filters);
    fetchIssues();
  }, [filters]);

  // 添加一个useEffect来监听筛选条件变化
  useEffect(() => {
    console.log('筛选条件已更新:', filters);
  }, [filters]);

  // 获取模块类型和设备类型列表
  useEffect(() => {
    fetchModuleTypes();
    fetchDeviceTypes();
  }, []);

  const fetchModuleTypes = async () => {
    try {
      const response = await fetch('/api/module-types/active');
      const result = await response.json();
      if (result.success) {
        setModuleTypes(result.data);
      }
    } catch (error) {
      console.error('获取模块类型列表失败:', error);
    }
  };

  const fetchDeviceTypes = async () => {
    try {
      const response = await fetch('/api/device-types');
      const result = await response.json();
      if (result.success) {
        setDeviceTypes(result.data);
      }
    } catch (error) {
      console.error('获取设备类型列表失败:', error);
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

  const handleDelete = async (id: string, event?: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发行点击事件
    if (event) {
      event.stopPropagation();
    }
    
    if (window.confirm('确定要删除这个问题吗？')) {
      try {
        const response = await issueApi.deleteIssue(id);
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
    setEditingIssue(null);
    setShowIssueForm(true);
  };

  const handleEdit = (issue: Issue, event?: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发行点击事件
    if (event) {
      event.stopPropagation();
    }
    setEditingIssue(issue);
    setShowIssueForm(true);
  };

  const handleRowClick = (issue: Issue) => {
    navigate(`/issues/${issue.id}`);
  };

  const handleCloseIssueForm = () => {
    setShowIssueForm(false);
    setEditingIssue(null);
  };

  const handleIssueSubmit = async (data: IssueFormData) => {
    try {
      if (editingIssue) {
        await issueApi.updateIssue(editingIssue.id, data);
      } else {
        await issueApi.createIssue(data);
      }
      await fetchIssues();
      setShowIssueForm(false);
      setEditingIssue(null);
    } catch (error) {
      console.error('保存问题失败:', error);
      throw error;
    }
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

  const handleSelectIssue = (id: string) => {
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
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          #{value}
        </Link>
      )
    },
    {
      key: 'device_name' as keyof Issue,
      title: <SortableHeader field="device_name" title="设备" />,
      render: (value: string, record: Issue) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{record.device_type}</div>
        </div>
      )
    },
    {
      key: 'module_category' as keyof Issue,
      title: <SortableHeader field="module_category" title="模块" />,
      render: (value: string) => (
        <div className="text-gray-900">{value || '-'}</div>
      )
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
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(value)}`}>
          {value === 'low' ? '低' : value === 'medium' ? '中' : '高'}
        </span>
      )
    },
    {
      key: 'status' as keyof Issue,
      title: <SortableHeader field="status" title="状态" />,
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value === 'open' ? '待处理' : value === 'in_progress' ? '处理中' : '已解决'}
        </span>
      )
    },
    {
      key: 'assignee' as keyof Issue,
      title: <SortableHeader field="assignee" title="责任人" />,
      render: (value: string) => (
        <div className="text-gray-900">{value || '-'}</div>
      )
    },
    {
      key: 'created_at' as keyof Issue,
      title: <SortableHeader field="created_at" title="创建时间" />,
      render: (value: string) => (
        <div className="text-gray-500">{formatDate(value, 'yyyy-MM-dd')}</div>
      )
    },
    {
      key: 'actions' as keyof Issue,
      title: '操作',
      render: (value: any, record: Issue) => (
        <div className="flex items-center space-x-2">
          <Link
            to={`/issues/${record.id}`}
            className="text-blue-600 hover:text-blue-800"
            title="查看详情"
          >
            <EyeIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={(e) => handleEdit(record, e)}
            className="text-yellow-600 hover:text-yellow-800"
            title="编辑"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* 页面标题和操作 */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">售后问题管理</h1>
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索
              </label>
              <input
                type="text"
                placeholder="搜索问题描述或设备"
                value={filters.search || ''}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                设备类型
              </label>
              <select
                value={filters.device_type || ''}
                onChange={(e) => handleFilterChange('device_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部设备类型</option>
                {deviceTypes.map((deviceType) => (
                  <option key={deviceType.id} value={deviceType.name}>
                    {deviceType.name}
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
                onClick={() => setFilters({ page: 1, limit: 10, search: '', status: '', severity: '', module: '', device_type: '' })}
                className="w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        {/* 数据表格 */}
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

        {/* 问题表单弹窗 */}
        {showIssueForm && (
          <IssueForm
            issue={editingIssue}
            onClose={handleCloseIssueForm}
            onSubmit={handleIssueSubmit}
          />
        )}
      </div>
    </Layout>
  );
}
