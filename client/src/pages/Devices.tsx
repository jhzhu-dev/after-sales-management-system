import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PencilIcon, TrashIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon, PrinterIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { deviceApi, moduleApi, productLineApi, bundleApi, customerApi } from '../services/api';
import { Device, DeviceBundle, FilterOptions, DeviceFormData, Customer } from '../types';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import DeviceForm from '../components/DeviceForm';
import BundleForm from '../components/BundleForm';
import ExportButton from '../components/ExportButton';
import SearchableSelect from '../components/SearchableSelect';
import { exportToExcel } from '../utils/exportUtils';
import { formatDate, getStatusColor } from '../utils';

type ViewMode = 'devices' | 'bundles';

function sortByField<T extends Record<string, any>>(items: T[], field: string, order: 'asc' | 'desc'): T[] {
  if (!field) return items;
  return [...items].sort((a, b) => {
    const aValue = a[field];
    const bValue = b[field];
    if (aValue === bValue) return 0;
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return order === 'asc'
        ? aValue.localeCompare(bValue, 'zh-CN')
        : bValue.localeCompare(aValue, 'zh-CN');
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    }
    return 0;
  });
}

function isFactoryDocsComplete(value: boolean | number | undefined | null): boolean {
  return value === true || value === 1;
}

function factoryDocsLabel(value: boolean | number | undefined | null): string {
  return isFactoryDocsComplete(value) ? '已完善' : '未完善';
}

export default function Devices() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [filters, setFilters] = useState<FilterOptions>(() => ({
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '10'),
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || '',
    status: searchParams.get('status') || ''
  }));
  const [deviceCustomerFilter, setDeviceCustomerFilter] = useState<string>('');
  const [deviceIssueFilter, setDeviceIssueFilter] = useState<string>('');
  const [bundleFilters, setBundleFilters] = useState({
    page: 1,
    limit: 10,
    customerId: '',
    status: '',
    issueStatus: ''
  });
  const [sortField, setSortField] = useState<string>(searchParams.get('sortField') || 'name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc');
  const [bundleSortField, setBundleSortField] = useState<string>('bundle_code');
  const [bundleSortOrder, setBundleSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [editingBundle, setEditingBundle] = useState<DeviceBundle | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(() => Math.max(20, parseInt(searchParams.get('visible') || '20')));
  const [visibleBundleCount, setVisibleBundleCount] = useState(20);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedBundles, setSelectedBundles] = useState<number[]>([]);
  const [printDevices, setPrintDevices] = useState<Device[] | null>(null);
  const [printBundles, setPrintBundles] = useState<DeviceBundle[] | null>(null);
  const [globalSearch, setGlobalSearch] = useState<string>(() => searchParams.get('q') || '');
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

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
    if (bundleFilters.customerId) {
      filtered = filtered.filter(b => String((b as any).customer_id || '') === bundleFilters.customerId);
    }
    if (bundleFilters.status) {
      filtered = filtered.filter(b => String((b as any).bundle_status || '') === bundleFilters.status);
    }
    if (bundleFilters.issueStatus === 'has') {
      filtered = filtered.filter(b => Number((b as any).open_issues || 0) > 0);
    }
    if (bundleFilters.issueStatus === 'none') {
      filtered = filtered.filter(b => Number((b as any).open_issues || 0) === 0);
    }
    if (bundleSortField) {
      filtered = sortByField(filtered, bundleSortField, bundleSortOrder);
    }
    setFilteredBundles(filtered);
    setBundlePagination({ current: 1, pageSize: filtered.length, total: filtered.length, pages: 1 });
  }, [allBundles, bundleFilters, bundleSortField, bundleSortOrder]);

  const applyFilters = useCallback(() => {
    let filtered = [...allDevices];

    // 单台设备列表：排除已绑定多合一的设备
    filtered = filtered.filter(d => !d.bundle_id);

    // 产品线过滤
    if (filters.type) {
      filtered = filtered.filter(device => device.product_line_name === filters.type);
    }

    // 客户过滤
    if (deviceCustomerFilter) {
      filtered = filtered.filter(device => String(device.customer_id || '') === deviceCustomerFilter);
    }

    // 待解决问题过滤
    if (deviceIssueFilter === 'has') {
      filtered = filtered.filter(device => Number(device.open_issues || 0) > 0);
    }
    if (deviceIssueFilter === 'none') {
      filtered = filtered.filter(device => Number(device.open_issues || 0) === 0);
    }

    // 状态过滤
    if (filters.status) {
      filtered = filtered.filter(device => device.status === filters.status);
    }

    // 排序
    if (sortField) {
      filtered = sortByField(filtered, sortField, sortOrder);
    }

    setFilteredDevices(filtered);
    setPagination({
      current: 1,
      pageSize: filtered.length,
      total: filtered.length,
      pages: 1
    });
  }, [allDevices, filters, deviceCustomerFilter, deviceIssueFilter, sortField, sortOrder]);

  // 初始数据获取
  useEffect(() => {
    if (!isInitialized) {
      console.log('首次初始化，获取数据');
      fetchAllDevices();
      fetchAllBundles();
      fetchProductLines();
      fetchCustomers();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // 实时过滤效果（数据重载时不重置 visibleCount，保留返回时的滚动位置）
  useEffect(() => {
    if (isInitialized) {
      console.log('执行实时过滤，filters:', filters);
      applyFilters();
    }
  }, [filters, allDevices, isInitialized, applyFilters]);

  // 返回列表时定位到之前点击的设备行
  useEffect(() => {
    if (!isInitialized || filteredDevices.length === 0) return;
    const savedId = sessionStorage.getItem('devices_highlight');
    if (!savedId) return;

    const tryScroll = (attemptsLeft: number) => {
      const link = document.querySelector<HTMLElement>(`a[href="/devices/${savedId}"]`);
      if (link) {
        sessionStorage.removeItem('devices_highlight');
        const row = link.closest('tr');
        if (row) {
          row.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
        }
      } else if (attemptsLeft > 0) {
        // 元素还未渲染，稍后重试
        setTimeout(() => tryScroll(attemptsLeft - 1), 50);
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(() => tryScroll(20)));
  }, [isInitialized, filteredDevices]);

  // 多合一设备过滤效果
  useEffect(() => {
    if (isInitialized) {
      applyBundleFilters();
      setVisibleBundleCount(20);
    }
  }, [bundleFilters, allBundles, isInitialized, applyBundleFilters]);

  // 多合一设备返回定位
  useEffect(() => {
    if (!isInitialized || filteredBundles.length === 0) return;
    const savedId = sessionStorage.getItem('bundles_highlight');
    if (!savedId) return;
    const tryScroll = (attemptsLeft: number) => {
      const link = document.querySelector<HTMLElement>(`a[href="/bundles/${savedId}"]`);
      if (link) {
        sessionStorage.removeItem('bundles_highlight');
        const row = link.closest('tr');
        if (row) row.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
      } else if (attemptsLeft > 0) {
        setTimeout(() => tryScroll(attemptsLeft - 1), 50);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(() => tryScroll(20)));
  }, [isInitialized, filteredBundles]);

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

  const fetchCustomers = async () => {
    try {
      const result = await customerApi.getCustomers();
      if (result.success) {
        setAllCustomers(result.data);
      }
    } catch (error) {
      console.error('获取客户列表失败:', error);
    }
  };

  const handleGlobalSearch = (q: string) => {
    setGlobalSearch(q);
    setVisibleCount(20);
    setSearchParams(p => { if (q) p.set('q', q); else p.delete('q'); return p; }, { replace: true });
  };

  // 全局搜索结果：包含所有设备（含多合一成员）
  const globalSearchResults = (() => {
    if (!globalSearch.trim()) return [];
    const s = globalSearch.trim().toLowerCase();
    let result = allDevices.filter(d =>
      (d.id && d.id.toLowerCase().includes(s)) ||
      (d.name && d.name.toLowerCase().includes(s)) ||
      ((d as any).nickname && (d as any).nickname.toLowerCase().includes(s)) ||
      (d.product_name && d.product_name.toLowerCase().includes(s)) ||
      (d.customer_name && d.customer_name.toLowerCase().includes(s)) ||
      (d.customer_short_name && d.customer_short_name.toLowerCase().includes(s)) ||
      (d.remote_code && d.remote_code.toLowerCase().includes(s)) ||
      ((d as any).bundle_code && (d as any).bundle_code.toLowerCase().includes(s)) ||
      ((d as any).bundle_name && (d as any).bundle_name.toLowerCase().includes(s))
    );
    if (filters.type) result = result.filter(d => d.product_line_name === filters.type);
    if (deviceCustomerFilter) result = result.filter(d => String(d.customer_id || '') === deviceCustomerFilter);
    if (deviceIssueFilter === 'has') result = result.filter(d => Number(d.open_issues || 0) > 0);
    if (deviceIssueFilter === 'none') result = result.filter(d => Number(d.open_issues || 0) === 0);
    if (filters.status) result = result.filter(d => d.status === filters.status);
    return result;
  })();

  const customerFilterOptions = useMemo(() => [
    { id: '', name: '全部客户' },
    ...allCustomers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      .map(c => ({ id: String(c.id), name: c.name, short_name: c.short_name }))
  ], [allCustomers]);

  const handleFilterChange = (key: string, value: string) => {
    setVisibleCount(20);
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
    setVisibleCount(20);
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

  const handlePrint = () => {
    if (viewMode === 'devices' && selectedDevices.length > 0) {
      setPrintDevices(filteredDevices.filter(d => selectedDevices.includes(d.id)));
      setTimeout(() => { window.print(); setPrintDevices(null); }, 100);
      return;
    }
    if (viewMode === 'bundles' && selectedBundles.length > 0) {
      setPrintBundles(filteredBundles.filter(b => selectedBundles.includes(b.id)));
      setTimeout(() => { window.print(); setPrintBundles(null); }, 100);
      return;
    }
    window.print();
  };

  const handleSelectDevice = (id: string) => {
    setSelectedDevices(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAllDevices = () => {
    if (selectedDevices.length === filteredDevices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(filteredDevices.map(d => d.id));
    }
  };

  const handleSelectBundle = (id: number) => {
    setSelectedBundles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAllBundles = () => {
    if (selectedBundles.length === filteredBundles.length) {
      setSelectedBundles([]);
    } else {
      setSelectedBundles(filteredBundles.map(b => b.id));
    }
  };

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
    if (filters.type) filtered = filtered.filter(d => d.product_line_name === filters.type);
    if (deviceCustomerFilter) filtered = filtered.filter(d => String(d.customer_id || '') === deviceCustomerFilter);
    if (deviceIssueFilter === 'has') filtered = filtered.filter(d => Number(d.open_issues || 0) > 0);
    if (deviceIssueFilter === 'none') filtered = filtered.filter(d => Number(d.open_issues || 0) === 0);
    if (filters.status) filtered = filtered.filter(d => d.status === filters.status);
    return sortByField(filtered, sortField, sortOrder);
  })();

  const DEVICE_EXPORT_COLUMNS = [
    { key: 'id', label: '生产序列号' },
    { key: 'device_code', label: '设备编码' },
    { key: 'name', label: '订单号' },
    { key: 'product_name', label: '产品名称' },
    { key: 'customer_name', label: '客户' },
    { key: 'customer_short_name', label: '客户简称' },
    { key: 'remote_code', label: '远程码' },
    { key: 'mechanical_version', label: '机械版本' },
    { key: 'factory_docs_complete', label: '出厂资料' },
    { key: 'status', label: '状态' },
    { key: 'open_issues', label: '待解决问题' },
    { key: 'created_at', label: '创建时间' },
  ];

  const handleExport = () => {
    const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
    const filename = `设备管理_${timestamp}`;
    const data = (selectedDevices.length > 0
      ? allFilteredDevices.filter(d => selectedDevices.includes(d.id))
      : allFilteredDevices
    ).map(d => ({
      ...d,
      factory_docs_complete: factoryDocsLabel(d.factory_docs_complete),
    }));
    exportToExcel(data as any[], DEVICE_EXPORT_COLUMNS, filename);
  };

  // 多合一设备导出
  const BUNDLE_EXPORT_COLUMNS = [
    { key: 'bundle_code', label: '多合一设备订单号' },
    { key: 'name', label: '多合一名称' },
    { key: 'customer_name', label: '客户' },
    { key: 'customer_short_name', label: '客户简称' },
    { key: 'device_count', label: '设备数量' },
    { key: 'factory_docs_complete', label: '出厂资料' },
    { key: 'document_count', label: '资料数量' },
    { key: 'created_at', label: '创建时间' },
  ];

  const allFilteredBundles = (() => {
    let filtered = [...allBundles];
    if (bundleFilters.customerId) filtered = filtered.filter(b => String((b as any).customer_id || '') === bundleFilters.customerId);
    if (bundleFilters.status) filtered = filtered.filter(b => String((b as any).bundle_status || '') === bundleFilters.status);
    if (bundleFilters.issueStatus === 'has') filtered = filtered.filter(b => Number((b as any).open_issues || 0) > 0);
    if (bundleFilters.issueStatus === 'none') filtered = filtered.filter(b => Number((b as any).open_issues || 0) === 0);
    return sortByField(filtered, bundleSortField, bundleSortOrder);
  })();

  const handleBundleExport = () => {
    const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
    const filename = `多合一设备_${timestamp}`;
    const data = (selectedBundles.length > 0
      ? allFilteredBundles.filter(b => selectedBundles.includes(b.id))
      : allFilteredBundles
    ).map(b => ({
      ...b,
      factory_docs_complete: factoryDocsLabel(b.factory_docs_complete),
    }));
    exportToExcel(data as any[], BUNDLE_EXPORT_COLUMNS, filename);
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
    // 保存点击的设备 ID，返回后定位到该行
    sessionStorage.setItem('devices_highlight', device.id);
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (sortField) params.set('sortField', sortField);
    if (sortOrder !== 'asc') params.set('sortOrder', sortOrder);
    if (visibleCount > 20) params.set('visible', String(visibleCount));
    const qs = params.toString();
    navigate(`/devices${qs ? '?' + qs : ''}`, { replace: true });
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
      key: 'select' as keyof Device,
      title: (
        <div onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedDevices.length === filteredDevices.length && filteredDevices.length > 0}
            onChange={handleSelectAllDevices}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      ),
      render: (value: any, record: Device) => (
        <div onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedDevices.includes(record.id)}
            onChange={() => handleSelectDevice(record.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      ),
      width: '50px'
    },
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
      ),
      width: '180px'
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
      ),
      width: '240px'
    },
    {
      key: 'product_name' as keyof Device,
      title: <SortableHeader field="product_name" title="产品名称" />,
      render: (_value: string, record: Device) => (
        <span className="text-sm text-gray-900">
          {record.product_name || '-'}
        </span>
      ),
      width: '280px'
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
      ),
      width: '150px'
    },
    {
      key: 'remote_code' as keyof Device,
      title: <SortableHeader field="remote_code" title="远程码" />,
      render: (value: string) => {
        if (!value) return <span className="text-gray-300">—</span>;
        const display = value.includes(' ') ? value : value.replace(/(\d{3})(?=\d)/g, '$1 ');
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-white text-blue-600 border border-blue-200">{display}</span>;
      },
      width: '130px'
    },
    {
      key: 'mechanical_version' as keyof Device,
      title: '机械版本',
      render: (value: string) => value
        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">{value}</span>
        : <span className="text-gray-300">—</span>,
      width: '90px'
    },
    {
      key: 'factory_docs_complete' as keyof Device,
      title: '出厂资料',
      render: (_: any, record: Device) => {
        const complete = isFactoryDocsComplete(record.factory_docs_complete);
        if (complete) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <CheckCircleIcon className="h-3.5 w-3.5" />已完善
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />未完善
          </span>
        );
      },
      width: '90px'
    },
    {
      key: 'module_versioned' as keyof Device,
      title: <span title="各模块版本号填写完整度">版本完整度</span>,
      render: (_: any, record: Device) => {
        const total = record.module_total ?? 0;
        const done = record.module_versioned ?? 0;
        if (total === 0) return <span className="text-gray-300">—</span>;
        const missing = total - done;
        if (missing === 0) return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <CheckCircleIcon className="h-3.5 w-3.5" />{done}/{total}
          </span>
        );
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 cursor-default"
            title={`还有 ${missing} 个模块未填写版本号`}
          >
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />{done}/{total}
          </span>
        );
      },
      width: '95px'
    },
    {
      key: 'status' as keyof Device,
      title: <SortableHeader field="status" title="状态" />,
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value}
        </span>
      ),
      width: '120px'
    },
    {
      key: 'open_issues' as keyof Device,
      title: <SortableHeader field="open_issues" title="待解决问题" />,
      render: (value: number) => (
        <div className={`text-sm font-medium ${value > 0 ? 'text-red-600' : 'text-gray-500'}`}>
          {value || 0}
        </div>
      ),
      width: '90px'
    },
    {
      key: 'created_at' as keyof Device,
      title: <SortableHeader field="created_at" title="创建时间" />,
      render: (value: string) => (
        <div className="text-gray-500">{formatDate(value, 'yyyy-MM-dd')}</div>
      ),
      width: '110px'
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
      ),
      width: '80px'
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

  const getBundleDeviceTypeTooltip = (bundle: DeviceBundle): string => {
    const raw = (bundle as any).device_product_names as string | undefined;
    if (!raw) {
      return `共 ${bundle.device_count || 0} 台\n暂无设备类型信息`;
    }
    const counter = new Map<string, number>();
    raw
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
      .forEach((name) => {
        counter.set(name, (counter.get(name) || 0) + 1);
      });

    const lines = Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} x ${count}`);

    return `共 ${bundle.device_count || 0} 台\n${lines.join('\n')}`;
  };

  const bundleColumns = [
    {
      key: 'select' as keyof DeviceBundle,
      title: (
        <div onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedBundles.length === filteredBundles.length && filteredBundles.length > 0}
            onChange={handleSelectAllBundles}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      ),
      render: (value: any, record: DeviceBundle) => (
        <div onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedBundles.includes(record.id)}
            onChange={() => handleSelectBundle(record.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      ),
      width: '50px'
    },
    {
      key: 'bundle_code' as keyof DeviceBundle,
      title: <BundleSortableHeader field="bundle_code" title="多合一设备订单号" />,
      render: (value: string, record: DeviceBundle) => (
        <Link to={`/bundles/${record.id}`} className="text-blue-600 hover:text-blue-800 font-medium font-mono">
          {value}
        </Link>
      ),
      width: '230px'
    },
    {
      key: 'name' as keyof DeviceBundle,
      title: <BundleSortableHeader field="name" title="多合一名称" />,
      render: (value: string) => <span className="text-gray-900">{value || '-'}</span>,
      width: '200px'
    },
    {
      key: 'customer_name' as keyof DeviceBundle,
      title: <BundleSortableHeader field="customer_name" title="客户" />,
      render: (value: string, record: DeviceBundle) => (
        <div>
          <div className="font-medium text-gray-900">{value || '-'}</div>
          {record.customer_short_name && <div className="text-xs text-gray-400">{record.customer_short_name}</div>}
        </div>
      ),
      width: '150px'
    },
    {
      key: 'device_count' as keyof DeviceBundle,
      title: <BundleSortableHeader field="device_count" title="设备数量" />,
      render: (value: number, record: DeviceBundle) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 cursor-help"
          title={getBundleDeviceTypeTooltip(record)}
        >
          {value || 0} 台
        </span>
      ),
      width: '80px'
    },
    {
      key: 'remote_code' as keyof DeviceBundle,
      title: <BundleSortableHeader field="remote_code" title="远程码" />,
      render: (value: string) => {
        if (!value) return <span className="text-gray-300">—</span>;
        const display = value.includes(' ') ? value : value.replace(/(\d{3})(?=\d)/g, '$1 ');
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-white text-blue-600 border border-blue-200">{display}</span>;
      },
      width: '130px'
    },
    {
      key: 'factory_docs_complete' as keyof DeviceBundle,
      title: '出厂资料',
      render: (_: any, record: DeviceBundle) => {
        const complete = isFactoryDocsComplete(record.factory_docs_complete);
        if (complete) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <CheckCircleIcon className="h-3.5 w-3.5" />已完善
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />未完善
          </span>
        );
      },
      width: '90px'
    },
    {
      key: 'document_count' as keyof DeviceBundle,
      title: <BundleSortableHeader field="document_count" title="资料数量" />,
      render: (value: number) => <span className="text-sm text-gray-600">{value || 0}</span>,
      width: '80px'
    },
    {
      key: 'open_issues' as keyof DeviceBundle,
      title: <BundleSortableHeader field="open_issues" title="待解决问题" />,
      render: (value: number) => value ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{value}</span>
      ) : <span className="text-sm text-gray-400">0</span>,
      width: '90px'
    },
    {
      key: 'created_at' as keyof DeviceBundle,
      title: <BundleSortableHeader field="created_at" title="创建时间" />,
      render: (value: string) => <div className="text-gray-500">{formatDate(value, 'yyyy-MM-dd')}</div>,
      width: '110px'
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
      ),
      width: '80px'
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
            {globalSearch && <span style={{fontSize: '8pt', color: '#6b7280'}}>搜索：{globalSearch}</span>}
            {filters.type && <span style={{fontSize: '8pt', color: '#6b7280'}}>产品线：{filters.type}</span>}
            {filters.status && <span style={{fontSize: '8pt', color: '#6b7280'}}>状态：{filters.status}</span>}
            {deviceCustomerFilter && <span style={{fontSize: '8pt', color: '#6b7280'}}>客户筛选已启用</span>}
            <span style={{fontSize: '8pt', color: '#6b7280'}}>共 {allFilteredDevices.length} 条记录</span>
          </div>
        </div>

        {/* 页面标题和操作 */}
        <div className="flex justify-between items-center no-print">
          <div className="flex items-center gap-4">
            <h1 className="text-xl 3xl:text-2xl font-bold text-gray-900">设备管理</h1>
            {/* Tab 切换（无全局搜索词时显示） */}
            {!globalSearch && (
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                onClick={() => { setViewMode('devices'); setSearchParams(p => { p.set('view', 'devices'); return p; }, { replace: true }); }}
                className={`px-3 py-1.5 text-sm font-medium ${viewMode === 'devices' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                单台设备列表
              </button>
              <button
                onClick={() => { setViewMode('bundles'); setSearchParams(p => { p.set('view', 'bundles'); return p; }, { replace: true }); }}
                className={`px-3 py-1.5 text-sm font-medium ${viewMode === 'bundles' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                多合一设备列表
              </button>
            </div>
            )}
            {!globalSearch && (viewMode === 'devices' ? (
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
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute -top-2 left-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-blue-700 bg-blue-100 rounded border border-blue-200">
                全局搜索
              </span>
              <input
                type="text"
                placeholder="全局搜索设备..."
                value={globalSearch}
                onChange={e => handleGlobalSearch(e.target.value)}
                className="w-72 pl-4 pr-8 py-2.5 text-sm font-medium text-blue-900 placeholder:text-blue-400 bg-blue-50 border-2 border-blue-200 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              />
              {globalSearch && (
                <button
                  onClick={() => handleGlobalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-700 text-lg leading-none"
                  title="清除搜索"
                >×</button>
              )}
            </div>
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

        {/* === 全局搜索结果 === */}
        {globalSearch && (
        <>
          {/* 产品线 + 状态筛选器（全局搜索时也可用） */}
          <div className="bg-white rounded-lg shadow p-4 no-print">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">产品线</label>
                <select
                  value={filters.type || ''}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部产品线</option>
                  {productLines.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部状态</option>
                  <option value="生产中">生产中</option>
                  <option value="使用中(正常)">使用中(正常)</option>
                  <option value="使用中(异常)">使用中(异常)</option>
                  <option value="已停用">已停用</option>
                </select>
              </div>
              <button
                onClick={() => { handleFilterChange('type', ''); handleFilterChange('status', ''); }}
                className="px-4 py-2 border border-gray-300 text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >重置筛选</button>
              <span className="text-sm text-gray-500 ml-auto">共找到 {globalSearchResults.length} 台设备</span>
            </div>
          </div>

          {/* 全局搜索结果表 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">生产序列号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号 / 简称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">产品名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">远程码</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">所属多合一</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {globalSearchResults.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">没有找到匹配的设备</td></tr>
                  ) : globalSearchResults.slice(0, visibleCount).map(d => (
                    <tr
                      key={d.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => { sessionStorage.setItem('devices_highlight', d.id); navigate(`/devices/${d.id}`); }}
                    >
                      <td className="px-4 py-3 font-mono text-blue-600 font-medium whitespace-nowrap">{d.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{d.name || '-'}</div>
                        {(d as any).nickname && <div className="text-xs text-gray-400">{(d as any).nickname}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{d.product_name || '-'}</td>
                      <td className="px-4 py-3">
                        <div>{d.customer_name || '-'}</div>
                        {d.customer_short_name && <div className="text-xs text-gray-400">{d.customer_short_name}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                        {d.remote_code ? d.remote_code.replace(/(\d{3})(?=\d)/g, '$1 ') : '-'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {(d as any).bundle_code ? (
                          <Link
                            to={`/bundles/${(d as any).bundle_id_val || d.bundle_id}`}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200"
                          >
                            {(d as any).bundle_code}
                          </Link>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(d.status)}`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {globalSearchResults.length > visibleCount && (
              <div className="text-center py-3 border-t border-gray-100">
                <button
                  onClick={() => setVisibleCount(prev => prev + 20)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >加载更多（已显示 {visibleCount} / {globalSearchResults.length}）</button>
              </div>
            )}
          </div>
        </>
        )}

        {/* --- 单台设备列表 --- */}
        {!globalSearch && viewMode === 'devices' && (
        <>
        {/* 筛选器 */}
        <div className="bg-white rounded-lg shadow p-4 3xl:p-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">客户</label>
              <SearchableSelect
                value={deviceCustomerFilter}
                onChange={(v) => { setVisibleCount(20); setDeviceCustomerFilter(v); }}
                options={customerFilterOptions}
                placeholder="全部客户"
                searchPlaceholder="搜索客户名称或简称"
              />
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
                <option value="生产中">生产中</option>
                <option value="使用中(正常)">使用中(正常)</option>
                <option value="使用中(异常)">使用中(异常)</option>
                <option value="已停用">已停用</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">待解决问题</label>
              <select
                value={deviceIssueFilter}
                onChange={(e) => { setVisibleCount(20); setDeviceIssueFilter(e.target.value); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部</option>
                <option value="has">有待解决问题</option>
                <option value="none">无待解决问题</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters(prev => ({ ...prev, page: 1, limit: 20, search: '', type: '', status: '' }));
                  setDeviceCustomerFilter('');
                  setDeviceIssueFilter('');
                  setVisibleCount(20);
                }}
                className="w-full h-10 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        {/* 数据表格 */}
        <DataTable
          data={filteredDevices.slice(0, visibleCount)}
          columns={columns}
          loading={loading}
          rowKey="id"
          onRowClick={handleRowClick}
          onLoadMore={visibleCount < filteredDevices.length ? () => setVisibleCount(prev => prev + 20) : undefined}
          scrollable
          fixedLayout
          className="print:hidden"
        />
        {!loading && filteredDevices.length > 0 && (
          <div className="text-center text-sm text-gray-400 pb-4 print:hidden">
            {visibleCount >= filteredDevices.length
              ? `已显示全部 ${filteredDevices.length} 条记录`
              : `已显示 ${Math.min(visibleCount, filteredDevices.length)} / ${filteredDevices.length} 条，向下滚动加载更多`
            }
          </div>
        )}

        {/* 打印专用表格 - 显示全部筛选结果 */}
        <div className="hidden print:block">
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt'}}>
            <thead>
              <tr style={{borderBottom:'1pt solid #374151', backgroundColor:'#f9fafb'}}>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>生产序列号</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>设备编码</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>订单号</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>产品名称</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>客户</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>机械版本</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>出厂资料</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>状态</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {(printDevices ?? allFilteredDevices).map((d, i) => (
                <tr key={d.id} style={{borderBottom:'0.5pt solid #e5e7eb', backgroundColor: i%2===0?'white':'#f9fafb'}}>
                  <td style={{padding:'3pt 6pt', fontFamily:'monospace'}}>{d.id}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.device_code || '-'}</td>
                  <td style={{padding:'3pt 6pt', fontWeight:'500'}}>{d.name}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.product_name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.customer_name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{d.mechanical_version || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{factoryDocsLabel(d.factory_docs_complete)}</td>
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
        {!globalSearch && viewMode === 'bundles' && (
        <>
        {/* 多合一设备筛选器 */}
        <div className="bg-white rounded-lg shadow p-4 3xl:p-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客户</label>
              <SearchableSelect
                value={bundleFilters.customerId}
                onChange={(v) => setBundleFilters(prev => ({ ...prev, customerId: v, page: 1 }))}
                options={customerFilterOptions}
                placeholder="全部客户"
                searchPlaceholder="搜索客户名称或简称"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select
                value={bundleFilters.status}
                onChange={(e) => setBundleFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部</option>
                <option value="生产中">生产中</option>
                <option value="使用中(正常)">使用中(正常)</option>
                <option value="使用中(异常)">使用中(异常)</option>
                <option value="已停用">已停用</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">待解决问题</label>
              <select
                value={bundleFilters.issueStatus}
                onChange={(e) => setBundleFilters(prev => ({ ...prev, issueStatus: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部</option>
                <option value="has">有待解决问题</option>
                <option value="none">无待解决问题</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setBundleFilters({ page: 1, limit: 10, customerId: '', status: '', issueStatus: '' });
                  setVisibleBundleCount(20);
                }}
                className="w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        {/* 多合一设备数据表格 */}
        <DataTable
          data={filteredBundles.slice(0, visibleBundleCount)}
          columns={bundleColumns}
          loading={loading}
          rowKey="id"
          onRowClick={(b: DeviceBundle) => {
            sessionStorage.setItem('bundles_highlight', String(b.id));
            navigate(`/bundles/${b.id}`);
          }}
          onLoadMore={visibleBundleCount < filteredBundles.length ? () => setVisibleBundleCount(prev => prev + 20) : undefined}
          scrollable
          fixedLayout
          className="print:hidden"
        />
        {!loading && filteredBundles.length > 0 && (
          <div className="text-center text-sm text-gray-400 pb-4 print:hidden">
            {visibleBundleCount >= filteredBundles.length
              ? `已显示全部 ${filteredBundles.length} 条记录`
              : `已显示 ${Math.min(visibleBundleCount, filteredBundles.length)} / ${filteredBundles.length} 条，向下滚动加载更多`
            }
          </div>
        )}

        {/* 多合一设备打印表格 */}
        <div className="hidden print:block">
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt'}}>
            <thead>
              <tr style={{borderBottom:'1pt solid #374151', backgroundColor:'#f9fafb'}}>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>多合一设备订单号</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>多合一名称</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>客户</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>设备数量</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>出厂资料</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>资料数量</th>
                <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {(printBundles ?? allFilteredBundles).map((b, i) => (
                <tr key={b.id} style={{borderBottom:'0.5pt solid #e5e7eb', backgroundColor: i%2===0?'white':'#f9fafb'}}>
                  <td style={{padding:'3pt 6pt', fontFamily:'monospace'}}>{b.bundle_code}</td>
                  <td style={{padding:'3pt 6pt'}}>{b.name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{b.customer_name || '-'}</td>
                  <td style={{padding:'3pt 6pt'}}>{b.device_count || 0}</td>
                  <td style={{padding:'3pt 6pt'}}>{factoryDocsLabel(b.factory_docs_complete)}</td>
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
