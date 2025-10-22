import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { deviceApi } from '../services/api';
import { Device, FilterOptions, DeviceFormData } from '../types';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import DeviceForm from '../components/DeviceForm';
import { formatDate, getStatusColor, getDeviceTypeColor } from '../utils';

export default function Devices() {
  const navigate = useNavigate();
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<Array<{id: string, name: string}>>([]);
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
    type: '',
    status: ''
  });
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchAllDevices = async () => {
    try {
      console.log('开始获取所有设备数据');
      setLoading(true);
      const response = await deviceApi.getDevices({ page: 1, limit: 1000, search: '', type: '', status: '' });
      console.log('设备列表API响应:', response);
      if (response.success) {
        console.log('设置所有设备数据:', response.data);
        setAllDevices(response.data);
      } else {
        console.error('API返回失败:', response);
      }
    } catch (error) {
      console.error('获取设备列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...allDevices];

    // 搜索过滤
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(device => 
        device.name.toLowerCase().includes(searchLower) ||
        device.id.toLowerCase().includes(searchLower)
      );
    }

    // 设备类型过滤
    if (filters.type) {
      filtered = filtered.filter(device => device.device_type === filters.type);
    }

    // 状态过滤
    if (filters.status) {
      filtered = filtered.filter(device => device.status === filters.status);
    }

    // 排序
    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField as keyof Device];
        const bValue = b[sortField as keyof Device];
        
        if (aValue === bValue) return 0;
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue, 'zh-CN')
            : bValue.localeCompare(aValue, 'zh-CN');
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        return 0;
      });
    }

    // 分页
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedDevices = filtered.slice(startIndex, endIndex);

    setFilteredDevices(paginatedDevices);
    setPagination({
      current: page,
      pageSize: limit,
      total: filtered.length,
      pages: Math.ceil(filtered.length / limit)
    });
  }, [allDevices, filters, sortField, sortOrder]);

  // 初始数据获取
  useEffect(() => {
    if (!isInitialized) {
      console.log('首次初始化，获取数据');
      fetchAllDevices();
      fetchDeviceTypes();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // 实时过滤效果
  useEffect(() => {
    if (isInitialized && allDevices.length > 0) {
      console.log('执行实时过滤，filters:', filters);
      applyFilters();
    }
  }, [filters, allDevices, isInitialized, applyFilters]);

  // 页面可见性变化时重新获取数据
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized) {
        console.log('页面重新可见，刷新数据');
        fetchAllDevices();
      }
    };

    const handleFocus = () => {
      if (isInitialized) {
        console.log('窗口重新获得焦点，刷新数据');
        fetchAllDevices();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isInitialized]);

  const fetchDeviceTypes = async () => {
    try {
      const response = await fetch('/api/device-types/active');
      const result = await response.json();
      if (result.success) {
        setDeviceTypes(result.data);
      }
    } catch (error) {
      console.error('获取设备类型列表失败:', error);
    }
  };

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
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
    // 排序逻辑现在在applyFilters中处理
  };

  const handleDelete = async (id: string, event?: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发行点击事件
    if (event) {
      event.stopPropagation();
    }
    
    if (window.confirm('确定要删除这个设备吗？')) {
      try {
        const response = await deviceApi.deleteDevice(id);
        if (response.success) {
          // 删除成功后，检查当前路径
          const currentPath = window.location.pathname;
          
          // 如果当前在设备详情页，跳转到设备列表页
          if (currentPath.includes(`/devices/${id}`)) {
            navigate('/devices');
          } else if (currentPath === '/devices') {
            // 如果当前就在设备管理页面，只需要刷新列表
            await fetchAllDevices();
          } else {
            // 其他情况，也跳转到设备管理页面
            navigate('/devices');
          }
        }
      } catch (error) {
        console.error('删除设备失败:', error);
        alert('删除设备失败');
      }
    }
  };

  const handleEdit = (device: Device, event?: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发行点击事件
    if (event) {
      event.stopPropagation();
    }
    setEditingDevice(device);
    setShowDeviceForm(true);
  };

  const handleAdd = () => {
    setEditingDevice(null);
    setShowDeviceForm(true);
  };

  const handleDeviceSubmit = async (data: DeviceFormData) => {
    try {
      if (editingDevice) {
        await deviceApi.updateDevice(editingDevice.id, data);
      } else {
        await deviceApi.createDevice(data);
      }
      await fetchAllDevices();
      setShowDeviceForm(false);
      setEditingDevice(null);
    } catch (error) {
      console.error('保存设备失败:', error);
      throw error;
    }
  };

  const handleCloseDeviceForm = () => {
    setShowDeviceForm(false);
    setEditingDevice(null);
  };

  const handleRowClick = (device: Device) => {
    navigate(`/devices/${device.id}`);
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
      key: 'id' as keyof Device,
      title: <SortableHeader field="id" title="设备编号" />,
      render: (value: string, record: Device) => (
        <Link 
          to={`/devices/${value}`} 
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {value}
        </Link>
      )
    },
    {
      key: 'name' as keyof Device,
      title: <SortableHeader field="name" title="设备名称" />,
      render: (value: string) => (
        <div className="font-medium text-gray-900">{value}</div>
      )
    },
    {
      key: 'device_type' as keyof Device,
      title: <SortableHeader field="device_type" title="设备类型" />,
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDeviceTypeColor(value)}`}>
          {value}
        </span>
      )
    },
    {
      key: 'location' as keyof Device,
      title: <SortableHeader field="location" title="位置" />,
      render: (value: string) => (
        <div className="text-gray-900">{value || '-'}</div>
      )
    },
    {
      key: 'status' as keyof Device,
      title: <SortableHeader field="status" title="状态" />,
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value}
        </span>
      )
    },
    {
      key: 'open_issues' as keyof Device,
      title: <SortableHeader field="open_issues" title="待解决问题" />,
      render: (value: number) => (
        <div className={`text-sm font-medium ${value > 0 ? 'text-red-600' : 'text-gray-500'}`}>
          {value || 0}
        </div>
      )
    },
    {
      key: 'created_at' as keyof Device,
      title: <SortableHeader field="created_at" title="创建时间" />,
      render: (value: string) => (
        <div className="text-gray-500">{formatDate(value, 'yyyy-MM-dd')}</div>
      )
    },
    {
      key: 'actions' as keyof Device,
      title: '操作',
      render: (value: any, record: Device) => (
        <div className="flex items-center space-x-2">
          <Link
            to={`/devices/${record.id}`}
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
          <h1 className="text-2xl font-bold text-gray-900">设备管理</h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleAdd}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              新增设备
            </button>
          </div>
        </div>

        {/* 筛选器 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索
              </label>
              <input
                type="text"
                placeholder="搜索设备名称或编号"
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
                value={filters.type || ''}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部类型</option>
                {deviceTypes.map((deviceType) => (
                  <option key={deviceType.id} value={deviceType.name}>
                    {deviceType.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                状态
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部状态</option>
                <option value="正常">正常</option>
                <option value="异常">异常</option>
                <option value="维护中">维护中</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ page: 1, limit: 10, search: '', type: '', status: '' })}
                className="w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        {/* 数据表格 */}
        <DataTable
          data={filteredDevices}
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

        {/* 设备表单弹窗 */}
        {showDeviceForm && (
          <DeviceForm
            device={editingDevice}
            onClose={handleCloseDeviceForm}
            onSubmit={handleDeviceSubmit}
          />
        )}
      </div>
    </Layout>
  );
}