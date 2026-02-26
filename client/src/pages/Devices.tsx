import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PencilIcon, TrashIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { deviceApi, moduleApi, productModuleApi } from '../services/api';
import { Device, FilterOptions, DeviceFormData } from '../types';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import DeviceForm from '../components/DeviceForm';
import { formatDate, getStatusColor, getDeviceTypeColor } from '../utils';

export default function Devices() {
  const navigate = useNavigate();
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [productLines, setProductLines] = useState<Array<{ id: string, name: string }>>([]);
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
      const response = await deviceApi.getDevices({ page: 1, limit: 1000 });
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
        device.id.toLowerCase().includes(searchLower) ||
        (device.customer_name && device.customer_name.toLowerCase().includes(searchLower)) ||
        (device.customer_short_name && device.customer_short_name.toLowerCase().includes(searchLower))
      );
    }

    // 产品线过滤
    if (filters.type) {
      filtered = filtered.filter(device => device.product_line_name === filters.type);
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
      fetchProductLines();
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

  const fetchProductLines = async () => {
    try {
      console.log('开始获取产品线列表...');
      const response = await fetch('/api/product-lines?is_active=1');
      const result = await response.json();
      console.log('产品线API响应:', result);
      if (result.success) {
        console.log('设置产品线数据:', result.data);
        setProductLines(result.data);
      } else {
        console.error('产品线API返回失败:', result);
      }
    } catch (error) {
      console.error('获取产品线列表失败:', error);
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

  const handleAddDevice = () => {
    setEditingDevice(null);
    setShowDeviceForm(true);
  };

  const handleDeviceSubmit = async (data: DeviceFormData) => {
    try {
      let newDeviceId: string;
      
      if (editingDevice) {
        await deviceApi.updateDevice(editingDevice.id, data);
        newDeviceId = editingDevice.id;
      } else {
        const response = await deviceApi.createDevice(data);
        newDeviceId = response.data.id;
        
        // 如果选择了产品，自动创建模块配置
        if (data.product_id) {
          try {
            const modulesResponse = await productModuleApi.getProductModules(data.product_id);
            if (modulesResponse.success && modulesResponse.data.length > 0) {
              // 根据选中的模块类型ID过滤
              const selectedIds = data.selectedModuleTypeIds;
              const modulesToCreate = selectedIds
                ? modulesResponse.data.filter(m => selectedIds.includes(m.module_type_id))
                : modulesResponse.data;
              const moduleCreationPromises = modulesToCreate.map(async (productModule) => {
                try {
                  await moduleApi.createModule({
                    device_id: newDeviceId,
                    type_id: productModule.module_type_id.toString(),
                    status: '正常'
                  });
                } catch (err) {
                  console.error(`创建模块 ${productModule.module_type_name} 失败:`, err);
                }
              });
              
              await Promise.allSettled(moduleCreationPromises);
              console.log(`已为设备 ${newDeviceId} 自动创建 ${modulesResponse.data.length} 个模块`);
            }
          } catch (error) {
            console.error('自动创建模块配置失败:', error);
            // 不抛出错误，允许设备创建成功
          }
        }
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
      title: <SortableHeader field="id" title="生产序列号" />,
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
      title: <SortableHeader field="name" title="名称" />,
      render: (value: string) => (
        <div className="font-medium text-gray-900">{value}</div>
      )
    },
    {
      key: 'product_name' as keyof Device,
      title: <SortableHeader field="product_name" title="产品" />,
      render: (value: string, record: Device) => {
        // 如果有产品信息，显示产品名称，否则显示产品线名称
        const displayText = value ? 
          (record.product_model ? `${value} (${record.product_model})` : value) : 
          (record.product_line_name || '-');
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDeviceTypeColor(record.product_line_name || '')}`}>
            {displayText}
          </span>
        );
      }
    },
    {
      key: 'customer_name' as keyof Device,
      title: <SortableHeader field="customer_name" title="客户" />,
      render: (value: string, record: Device) => (
        <div>
          <div className="font-medium text-gray-900">{value || '-'}</div>
          {record.customer_short_name && (
            <div className="text-xs text-gray-400">{record.customer_short_name}</div>
          )}
        </div>
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
          <button
            onClick={() => handleAddDevice()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            新增设备
          </button>
        </div>

        {/* 筛选器 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                产品线
              </label>
              <select
                value={filters.type || ''}
                onChange={(e) => handleFilterChange('type', e.target.value)}
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
        {
          showDeviceForm && (
            <DeviceForm
              device={editingDevice}
              onClose={handleCloseDeviceForm}
              onSubmit={handleDeviceSubmit}
            />
          )
        }
      </div>
    </Layout>
  );
}