import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PencilIcon, TrashIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { deviceApi, moduleApi, productLineApi, bundleApi } from '../services/api';
import { Device, DeviceBundle, FilterOptions, DeviceFormData } from '../types';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import DeviceForm from '../components/DeviceForm';
import BundleForm from '../components/BundleForm';
import ExportButton from '../components/ExportButton';
import { exportToExcel } from '../utils/exportUtils';
import { formatDate, getStatusColor } from '../utils';

type ViewMode = 'devices' | 'bundles';

export default function Devices() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = searchParams.get('view');
    return v === 'bundles' ? 'bundles' : 'devices';
  });
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [allBundles, setAllBundles] = useState<DeviceBundle[]>([]);
  const [filteredBundles, setFilteredBundles] = useState<DeviceBundle[]>([]);
  const [productLines, setProductLines] = useState<Array<{ id: number, name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    pages: 0
  });
  const [bundlePagination, setBundlePagination] = useState({
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
  const [bundleFilters, setBundleFilters] = useState({ page: 1, limit: 10, search: '' });
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [bundleSortField, setBundleSortField] = useState<string>('');
  const [bundleSortOrder, setBundleSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [editingBundle, setEditingBundle] = useState<DeviceBundle | null>(null);
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

  const fetchAllBundles = async () => {
    try {
      const response = await bundleApi.getBundles({ page: 1, limit: 1000 });
      if (response.success) {
        setAllBundles(response.data);
      }
    } catch (error) {
      console.error('获取多合一设备列表失败:', error);
    }
  };

  const applyBundleFilters = useCallback(() => {
    let filtered = [...allBundles];
    if (bundleFilters.search) {
      const s = bundleFilters.search.toLowerCase();
      filtered = filtered.filter(b =>
        (b.bundle_code && b.bundle_code.toLowerCase().includes(s)) ||
        (b.name && b.name.toLowerCase().includes(s)) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(s)) ||
        (b.customer_short_name && b.customer_short_name.toLowerCase().includes(s))
      );
    }
    if (bundleSortField) {
      filtered.sort((a, b) => {
        const aVal = (a as any)[bundleSortField];
        const bVal = (b as any)[bundleSortField];
        if (aVal === bVal) return 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return bundleSortOrder === 'asc' ? aVal.localeCompare(bVal, 'zh-CN') : bVal.localeCompare(aVal, 'zh-CN');
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return bundleSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    }
    const page = bundleFilters.page || 1;
    const limit = bundleFilters.limit || 10;
    const start = (page - 1) * limit;
    setFilteredBundles(filtered.slice(start, start + limit));
    setBundlePagination({ current: page, pageSize: limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) });
  }, [allBundles, bundleFilters, bundleSortField, bundleSortOrder]);

  const applyFilters = useCallback(() => {
    let filtered = [...allDevices];

    // 单台设备列表：排除已绑定多合一的设备
    filtered = filtered.filter(d => !d.bundle_id);

    // 搜索过滤
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(device =>
        (device.name && device.name.toLowerCase().includes(searchLower)) ||
        (device.id && device.id.toLowerCase().includes(searchLower)) ||
        (device.product_name && device.product_name.toLowerCase().includes(searchLower)) ||
        (device.customer_name && device.customer_name.toLowerCase().includes(searchLower)) ||
        (device.customer_short_name && device.customer_short_name.toLowerCase().includes(searchLower)) ||
        (device.remote_code && device.remote_code.toLowerCase().includes(searchLower)) ||
        (device.product_version_number && device.product_version_number.toLowerCase().includes(searchLower)) ||
        (device.product_version_name && device.product_version_name.toLowerCase().includes(searchLower))
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
      fetchAllBundles();
      fetchProductLines();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // 实时过滤效果
  useEffect(() => {
    if (isInitialized) {
      console.log('执行实时过滤，filters:', filters);
      applyFilters();
    }
  }, [filters, allDevices, isInitialized, applyFilters]);

  // 多合一设备过滤效果
  useEffect(() => {
    if (isInitialized) {
      applyBundleFilters();
    }
  }, [bundleFilters, allBundles, isInitialized, applyBundleFilters]);

  // 页面可见性变化时重新获取数据
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized) {
        console.log('页面重新可见，刷新数据');
        fetchAllDevices();
        fetchAllBundles();
      }
    };

    const handleFocus = () => {
      if (isInitialized) {
        console.log('窗口重新获得焦点，刷新数据');
        fetchAllDevices();
        fetchAllBundles();
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
      const result = await productLineApi.getProductLines({ is_active: true });
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

  const handlePrint = () => window.print();

  const handleBundleSort = (field: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (bundleSortField === field && bundleSortOrder === 'asc') newOrder = 'desc';
    setBundleSortField(field);
    setBundleSortOrder(newOrder);
  };

  const handleDeleteBundle = async (id: number, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    if (window.confirm('确定要删除这个多合一设备吗？内部设备不会被删除。')) {
      try {
        await bundleApi.deleteBundle(id);
        await fetchAllBundles();
        await fetchAllDevices();
      } catch (error) {
        console.error('删除多合一设备失败:', error);
        alert('删除多合一设备失败');
      }
    }
  };

  const handleEditBundle = (bundle: DeviceBundle, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setEditingBundle(bundle);
    setShowBundleForm(true);
  };

  const handleAddBundle = () => {
    setEditingBundle(null);
    setShowBundleForm(true);
  };

  const handleBundleSubmit = async () => {
    await fetchAllBundles();
    await fetchAllDevices();
    setShowBundleForm(false);
    setEditingBundle(null);
  };

  // 打印用：全量过滤结果（不切分页）
  const allFilteredDevices = (() => {
    let filtered = [...allDevices].filter(d => !d.bundle_id);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(d =>
        (d.name && d.name.toLowerCase().includes(s)) ||
        (d.id && d.id.toLowerCase().includes(s)) ||
        (d.customer_name && d.customer_name.toLowerCase().includes(s)) ||
        (d.customer_short_name && d.customer_short_name.toLowerCase().includes(s)) ||
        (d.remote_code && d.remote_code.toLowerCase().includes(s)) ||
        (d.product_version_number && d.product_version_number.toLowerCase().includes(s)) ||
        (d.product_version_name && d.product_version_name.toLowerCase().includes(s))
      );
    }
    if (filters.type) filtered = filtered.filter(d => d.product_line_name === filters.type);
    if ((filters as any).version) filtered = filtered.filter(d => d.product_version_number === (filters as any).version);
    if (filters.status) filtered = filtered.filter(d => d.status === filters.status);
    return filtered;
  })();

  const DEVICE_EXPORT_COLUMNS = [
    { key: 'id', label: '生产序列号' },
    { key: 'device_code', label: '设备编码' },
    { key: 'name', label: '订单号' },
    { key: 'product_name', label: '产品名称' },
    { key: 'product_version_number', label: '迭代版本' },
    { key: 'product_version_name', label: '版本名称' },
    { key: 'customer_name', label: '客户' },
    { key: 'customer_short_name', label: '客户简称' },
    { key: 'remote_code', label: '远程码' },
    { key: 'status', label: '状态' },
    { key: 'open_issues', label: '待解决问题' },
    { key: 'created_at', label: '创建时间' },
  ];

  const handleExport = () => {
    const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
    const filename = `设备管理_${timestamp}`;
    exportToExcel(allFilteredDevices as any[], DEVICE_EXPORT_COLUMNS, filename);
  };

  // 多合一设备导出
  const BUNDLE_EXPORT_COLUMNS = [
    { key: 'bundle_code', label: '多合一设备订单号' },
    { key: 'name', label: '多合一名称' },
    { key: 'customer_name', label: '客户' },
    { key: 'customer_short_name', label: '客户简称' },
    { key: 'device_count', label: '设备数量' },
    { key: 'document_count', label: '资料数量' },
    { key: 'created_at', label: '创建时间' },
  ];

  const allFilteredBundles = (() => {
    let filtered = [...allBundles];
    if (bundleFilters.search) {
      const s = bundleFilters.search.toLowerCase();
      filtered = filtered.filter(b =>
        (b.bundle_code && b.bundle_code.toLowerCase().includes(s)) ||
        (b.name && b.name.toLowerCase().includes(s)) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(s)) ||
        (b.customer_short_name && b.customer_short_name.toLowerCase().includes(s))
      );
    }
    return filtered;
  })();

  const handleBundleExport = () => {
    const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
    const filename = `多合一设备_${timestamp}`;
    exportToExcel(allFilteredBundles as any[], BUNDLE_EXPORT_COLUMNS, filename);
  };

  const handleDeviceSubmit = async (data: DeviceFormData) => {
    try {
      let newDeviceId: string;
      const { selectedModuleTypeIds, ...deviceData } = data;

      if (editingDevice) {
        const submitData: any = { ...deviceData };
        if (submitData.id && submitData.id !== editingDevice.id) {
          submitData.new_id = submitData.id;
        }
        delete submitData.id;
        await deviceApi.updateDevice(editingDevice.id, submitData);
        newDeviceId = editingDevice.id;
      } else {
        const response = await deviceApi.createDevice(deviceData);
        newDeviceId = response.data.id;
      }

      // 新建设备时自动创建选配模块
      if (!editingDevice && selectedModuleTypeIds && selectedModuleTypeIds.length > 0) {
        for (const typeId of selectedModuleTypeIds) {
          try {
            await moduleApi.createModule({ device_id: newDeviceId, type_id: typeId.toString(), status: '正常' });
          } catch (err) {
            console.warn(`创建模块 type_id=${typeId} 失败:`, err);
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
      title: <SortableHeader field="name" title="订单号" />,
      render: (value: string, record: Device) => (
        <div>
          <div className="font-medium text-gray-900">
            {value}{record.id ? <span className="text-gray-400 font-normal"> · {record.id.slice(-4)}</span> : ''}
          </div>
          {record.nickname && (
            <div className="text-xs text-blue-600 font-medium">{record.nickname}</div>
          )}
        </div>
      )
    },
    {
      key: 'product_name' as keyof Device,
      title: <SortableHeader field="product_name" title="产品名称" />,
      render: (_value: string, record: Device) => (
        <span className="text-sm text-gray-900">
          {record.product_name || '-'}
        </span>
      )
    },
    {
      key: 'product_version_number' as keyof Device,
      title: <SortableHeader field="product_version_number" title="迭代版本" />,
      render: (value: string, record: Device) => (
        value ? (
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {value}
            </span>
            {record.product_version_name && (
              <div className="text-xs text-gray-500 mt-0.5">{record.product_version_name}</div>
            )}
          </div>
        ) : <span className="text-gray-300">—</span>
      )
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
      key: 'remote_code' as keyof Device,
      title: <SortableHeader field="remote_code" title="远程码" />,
      render: (value: string) => {
        if (!value) return <span className="text-gray-300">—</span>;
        const display = value.includes(' ') ? value : value.replace(/(\d{3})(?=\d)/g, '$1 ');
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-white text-blue-600 border border-blue-200">{display}</span>;
      }
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

  const BundleSortableHeader = ({ field, title }: { field: string; title: string }) => {
    const isActive = bundleSortField === field;
    return (
      <div
        className="flex items-center space-x-1 cursor-pointer hover:text-blue-600 select-none"
        onClick={() => handleBundleSort(field)}
      >
        <span>{title}</span>
        <div className="flex flex-col">
          <ChevronUpIcon className={`h-3 w-3 ${isActive && bundleSortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
          <ChevronDownIcon className={`h-3 w-3 -mt-1 ${isActive && bundleSortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
        </div>
      </div>
    );
  };

  const bundleColumns = [
    {
      key: 'bundle_code' as keyof DeviceBundle,
      title: <BundleSortableHeader field="bundle_code" title="多合一设备订单号" />,
      render: (value: string, record: DeviceBundle) => (
        <Link to={`/bundles/${record.id}`} className="text-blue-600 hover:text-blue-800 font-medium font-mono">
          {value}
        </Link>
      )
    },
    {
      key: 'name' as keyof DeviceBundle,
      title: <BundleSortableHeader field="name" title="多合一名称" />,
      render: (value: string) => <span className="text-gray-900">{value || '-'}</span>
    },
    {
      key: 'customer_name' as keyof DeviceBundle,
      title: <BundleSortableHeader field="customer_name" title="客户" />,
      render: (value: string, record: DeviceBundle) => (
        <div>
          <div className="font-medium text-gray-900">{value || '-'}</div>
          {record.customer_short_name && <div className="text-xs text-gray-400">{record.customer_short_name}</div>}
        </div>
      )
    },
    {
      key: 'device_count' as keyof DeviceBundle,
      title: <BundleSortableHeader field="device_count" title="设备数量" />,
      render: (value: number) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          {value || 0} 台
        </span>
      )
    },
    {
      key: 'remote_code' as keyof DeviceBundle,
      title: <BundleSortableHeader field="remote_code" title="远程码" />,
      render: (value: string) => {
        if (!value) return <span className="text-gray-300">—</span>;
        const display = value.includes(' ') ? value : value.replace(/(\d{3})(?=\d)/g, '$1 ');
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-white text-blue-600 border border-blue-200">{display}</span>;
      }
    },
    {
      key: 'document_count' as keyof DeviceBundle,
      title: <BundleSortableHeader field="document_count" title="资料数量" />,
      render: (value: number) => <span className="text-sm text-gray-600">{value || 0}</span>
    },
    {
      key: 'open_issues' as keyof DeviceBundle,
      title: <BundleSortableHeader field="open_issues" title="待解决问题" />,
      render: (value: number) => value ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{value}</span>
      ) : <span className="text-sm text-gray-400">0</span>
    },
    {
      key: 'created_at' as keyof DeviceBundle,
      title: <BundleSortableHeader field="created_at" title="创建时间" />,
      render: (value: string) => <div className="text-gray-500">{formatDate(value, 'yyyy-MM-dd')}</div>
    },
    {
      key: 'actions' as keyof DeviceBundle,
      title: '操作',
      render: (_value: any, record: DeviceBundle) => (
        <div className="flex items-center space-x-2">
          <Link to={`/bundles/${record.id}`} className="text-blue-600 hover:text-blue-800" title="查看详情">
            <EyeIcon className="h-4 w-4" />
          </Link>
          <button onClick={(e) => handleEditBundle(record, e)} className="text-yellow-600 hover:text-yellow-800" title="编辑">
            <PencilIcon className="h-4 w-4" />
          </button>
          <button onClick={(e) => handleDeleteBundle(record.id, e)} className="text-red-600 hover:text-red-800" title="删除">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <Layout>
      <div className="space-y-4 3xl:space-y-6">
        {/* 仅打印可见的页眉 */}
        <div className="hidden print:block print-header">
          <div className="flex items-center justify-between" style={{marginBottom: '3pt'}}>
            <span style={{fontSize: '8pt', color: '#6b7280'}}>售后登记系统</span>
            <span style={{fontSize: '8pt', color: '#6b7280'}}>打印时间：{new Date().toLocaleString('zh-CN')}</span>
          </div>
          <h1 style={{fontSize: '13pt', fontWeight: 'bold', margin: '0 0 3pt 0', color: '#111827'}}>设备管理</h1>
          <div className="print-flex-row" style={{marginTop: '2pt'}}>
            {filters.search && <span style={{fontSize: '8pt', color: '#6b7280'}}>搜索：{filters.search}</span>}
            {filters.type && <span style={{fontSize: '8pt', color: '#6b7280'}}>产品线：{filters.type}</span>}
            {filters.status && <span style={{fontSize: '8pt', color: '#6b7280'}}>状态：{filters.status}</span>}
            <span style={{fontSize: '8pt', color: '#6b7280'}}>共 {allFilteredDevices.length} 条记录</span>
          </div>
        </div>

        {/* 页面标题和操作 */}
        <div className="flex justify-between items-center no-print">
          <div className="flex items-center gap-4">
            <h1 className="text-xl 3xl:text-2xl font-bold text-gray-900">设备管理</h1>
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode('devices')}
                className={`px-3 py-1.5 text-sm font-medium ${viewMode === 'devices' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                单台设备列表
              </button>
              <button
                onClick={() => setViewMode('bundles')}
                className={`px-3 py-1.5 text-sm font-medium ${viewMode === 'bundles' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                多合一设备列表
              </button>
            </div>
            {viewMode === 'devices' ? (
              <button
                onClick={() => handleAddDevice()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                新增设备
              </button>
            ) : (
              <button
                onClick={handleAddBundle}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                新建多合一设备
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              onExport={viewMode === 'devices' ? handleExport : handleBundleExport}
            />
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              打印
            </button>
          </div>
        </div>

        {/* --- 单台设备列表 --- */}
        {viewMode === 'devices' && (
        <>
        {/* 筛选器 */}
        <div className="bg-white rounded-lg shadow p-4 3xl:p-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索
              </label>
              <input
                type="text"
                placeholder="搜索订单号、序列号、产品名称、远程码或简称"
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
                onClick={() => setFilters({ page: 1, limit: 10, search: '', type: '', status: '' } as any)}
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
          className="print:hidden"
        />

        {/* 打印专用表格 - 显示全部筛选结果 */}
        <div className="hidden print:block">
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt'}}>
            <thead>
              <tr style={{borderBottom:'1pt solid #374151', backgroundColor:'#f9fafb'}}>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>生产序列号</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>设备编码</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>订单号</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>产品名称</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>迭代版本</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>客户</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>状态</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {allFilteredDevices.map((d, i) => (
                <tr key={d.id} style={{borderBottom:'0.5pt solid #e5e7eb', backgroundColor: i%2===0?'white':'#f9fafb'}}>
                  <td style={{padding:'3pt 6pt', fontFamily:'monospace'}}>{d.id}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.device_code || '-'}</td>
                  <td style={{padding:'3pt 6pt', fontWeight:'500'}}>{d.name}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.product_name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.product_version_number ? `${d.product_version_number}${d.product_version_name ? ` ${d.product_version_name}` : ''}` : '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.customer_name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.status}</td>
                  <td style={{padding:'3pt 6pt'}}>{new Date(d.created_at).toLocaleDateString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        )}

        {/* --- 多合一设备列表 --- */}
        {viewMode === 'bundles' && (
        <>
        {/* 多合一设备筛选器 */}
        <div className="bg-white rounded-lg shadow p-4 3xl:p-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
              <input
                type="text"
                placeholder="搜索多合一设备订单号、名称或客户"
                value={bundleFilters.search}
                onChange={(e) => setBundleFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setBundleFilters({ page: 1, limit: 10, search: '' })}
                className="w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        {/* 多合一设备数据表格 */}
        <DataTable
          data={filteredBundles}
          columns={bundleColumns}
          loading={loading}
          pagination={{
            current: bundlePagination.current,
            pageSize: bundlePagination.pageSize,
            total: bundlePagination.total,
            onChange: (page: number, pageSize: number) => setBundleFilters(prev => ({ ...prev, page, limit: pageSize }))
          }}
          rowKey="id"
          onRowClick={(b: DeviceBundle) => navigate(`/bundles/${b.id}`)}
          className="print:hidden"
        />

        {/* 多合一设备打印表格 */}
        <div className="hidden print:block">
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt'}}>
            <thead>
              <tr style={{borderBottom:'1pt solid #374151', backgroundColor:'#f9fafb'}}>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>多合一设备订单号</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>多合一名称</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>客户</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>设备数量</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>资料数量</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {allFilteredBundles.map((b, i) => (
                <tr key={b.id} style={{borderBottom:'0.5pt solid #e5e7eb', backgroundColor: i%2===0?'white':'#f9fafb'}}>
                  <td style={{padding:'3pt 6pt', fontFamily:'monospace'}}>{b.bundle_code}</td>
                  <td style={{padding:'3pt 6pt'}}>{b.name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{b.customer_name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{b.device_count || 0}</td>
                  <td style={{padding:'3pt 6pt'}}>{b.document_count || 0}</td>
                  <td style={{padding:'3pt 6pt'}}>{new Date(b.created_at).toLocaleDateString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        )}

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

        {/* 多合一设备表单弹窗 */}
        {showBundleForm && (
          <BundleForm
            bundle={editingBundle}
            onClose={() => { setShowBundleForm(false); setEditingBundle(null); }}
            onSubmit={handleBundleSubmit}
          />
        )}
      </div>
    </Layout>
  );
}