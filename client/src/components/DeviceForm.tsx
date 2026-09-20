import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { XMarkIcon, PlusIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { Device, DeviceFormData, Customer, FeishuUser } from '../types';
import { productLineApi, customerApi, productApi, productModuleApi, feishuApi } from '../services/api';
import { getModuleTypeOrder } from '../utils/moduleOrder';
import FeishuMultiUserPicker from './FeishuMultiUserPicker';
import Select from './Select';
import OrderImportPanel from './OrderImportPanel';

interface DeviceFormProps {
  device?: Device | null;
  onClose: () => void;
  onSubmit: (data: DeviceFormData) => Promise<void>;
  onImported?: (bundleId?: number) => void;
}

const DeviceForm: React.FC<DeviceFormProps> = ({ device, onClose, onSubmit, onImported }) => {
  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [formData, setFormData] = useState<DeviceFormData>({
    id: '',
    name: '',
    device_code: '',
    product_line_id: '',
    product_id: undefined,
    customer_id: undefined,
    status: '使用中(正常)',
    remote_code: '',
    password: '',
    merchant_id: '',
    merchant_password: '',
    notes: ''
  });

  const [productLines, setProductLines] = useState<Array<{ id: number, name: string }>>([])
  const [products, setProducts] = useState<Array<{ id: number, name: string, model?: string }>>([]);
  const [moduleTypes, setModuleTypes] = useState<Array<{ id: number, name: string, code: string, is_required: boolean, feishu_user_open_id?: string | null }>>([]);
  const [selectedModuleTypeIds, setSelectedModuleTypeIds] = useState<number[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerShortName, setNewCustomerShortName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  // 飞书通知
  const [feishuUsers, setFeishuUsers] = useState<FeishuUser[]>([]);
  const [feishuEnabled, setFeishuEnabled] = useState(false);
  const [notifyOpenIds, setNotifyOpenIds] = useState<string[]>([]);
  const [pinnedOpenIds, setPinnedOpenIds] = useState<string[]>([]);
  // 记录用户手动取消勾选的 id，避免模块改变时重新强制勾选
  const manuallyRemovedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    feishuApi.getUsers().then(res => {
      if (res.success && res.data && res.data.length > 0) {
        setFeishuUsers(res.data as FeishuUser[]);
        setFeishuEnabled(true);
      }
    }).catch(() => {});
    fetchProductLines();
    fetchCustomers();
    if (device) {
      setFormData({
        id: device.id,
        name: device.name,
        device_code: device.device_code || '',
        product_line_id: device.product_line_id || '',
        product_id: device.product_id || undefined,
        customer_id: device.customer_id || undefined,
        status: device.status as '生产中' | '已发货' | '使用中(正常)' | '使用中(异常)' | '已停用',
        remote_code: device.remote_code || '',
        password: device.password || '',
        merchant_id: (device as any).merchant_id || '',
        merchant_password: (device as any).merchant_password || '',
        notes: device.notes || ''
      });
      if (device.product_line_id) {
        fetchProducts(device.product_line_id);
      }
      if (device.product_id) {
        fetchModuleTypesByProduct(device.product_id);
      }
    }
  }, [device]);

  const fetchProducts = async (productLineId: string | number) => {
    if (!productLineId) {
      setProducts([]);
      return;
    }
    try {
      const result = await productApi.getProducts({ product_line_id: Number(productLineId), is_active: true });
      if (result.success) {
        setProducts(result.data);
      }
    } catch (error) {
      console.error('获取产品列表失败:', error);
    }
  };

  const fetchModuleTypesByProduct = async (productId: number | null | undefined) => {
    if (!productId) {
      setModuleTypes([]);
      setSelectedModuleTypeIds([]);
      return;
    }
    try {
      const result = await productModuleApi.getProductModules(productId);
      if (result.success) {
        const modules = result.data.map((m: any) => ({
          id: m.module_type_id,
          name: m.module_type_name,
          code: m.module_type_code,
          is_required: !!m.is_required,
          feishu_user_open_id: m.feishu_user_open_id || null
        }));
        // 排序：按模块类型固定顺序（机械/电气/上位机/视觉/服务器/车牌相机），同序内必选在后
        const sorted = [...modules].sort((a: any, b: any) => {
          const oa = getModuleTypeOrder(a.name);
          const ob = getModuleTypeOrder(b.name);
          if (oa !== ob) return oa - ob;
          return a.is_required === b.is_required ? 0 : a.is_required ? 1 : -1;
        });
        setModuleTypes(sorted);
        // 自动勾选必选模块
        const requiredIds = sorted.filter((m: any) => m.is_required).map((m: any) => m.id);
        setSelectedModuleTypeIds(requiredIds);
      }
    } catch (error) {
      console.error('获取产品模块类型失败:', error);
    }
  };

  const fetchProductLines = async () => {
    try {
      const result = await productLineApi.getProductLines({ is_active: true });
      if (result.success) {
        setProductLines(result.data);
      }
    } catch (error) {
      console.error('获取产品线失败:', error);
    }
  };

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

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.short_name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const handleSelectCustomer = (customer: Customer) => {
    setFormData(prev => ({ ...prev, customer_id: customer.id }));
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    setErrors(prev => ({ ...prev, customer_id: '' }));
    setSubmitError('');
  };

  const handleClearCustomer = () => {
    setFormData(prev => ({ ...prev, customer_id: undefined }));
    setCustomerSearch('');
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerShortName.trim()) {
      alert('客户名称和简称为必填项');
      return;
    }
    try {
      const result = await customerApi.createCustomer({ name: newCustomerName.trim(), short_name: newCustomerShortName.trim() });
      if (result.success) {
        await fetchCustomers();
        setFormData(prev => ({ ...prev, customer_id: result.data.id }));
        setCustomerSearch(newCustomerName.trim());
        setShowNewCustomerForm(false);
        setNewCustomerName('');
        setNewCustomerShortName('');
      } else {
        alert(result.error || '创建客户失败');
      }
    } catch (error: any) {
      console.error('创建客户失败:', error);
      alert(error?.response?.data?.error || '创建客户失败');
    }
  };

  const handleChange = (field: keyof DeviceFormData, value: string | number | undefined) => {
    setSubmitError('');
    if (field === 'product_line_id') {
      // 合并成一次 setState，避免覆盖
      setFormData(prev => ({ ...prev, product_line_id: value as string | number, product_id: undefined }));
      fetchProducts(value as string | number);
      fetchModuleTypesByProduct(null);
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // 当三个设备标识字段之一有变动时，清除多合一设备错误提示
    if (['device_code', 'id', 'remote_code'].includes(field as string) && errors.identity) {
      setErrors(prev => ({ ...prev, identity: '' }));
    }

    // 当产品型号改变时，获取该产品的模块列表
    if (field === 'product_id') {
      fetchModuleTypesByProduct(value as number | null | undefined);
      setFormData(prev => ({ ...prev, product_id: value as number | undefined }));
    }

    // 当设备名称改变时，自动匹配产品线
    if (field === 'name' && typeof value === 'string') {
      const matchedProductLineId = matchProductLineByName(value);
      if (matchedProductLineId && !device) {
        setFormData(prev => ({ ...prev, product_line_id: matchedProductLineId as string | number, product_id: undefined }));
        fetchProducts(matchedProductLineId);
        fetchModuleTypesByProduct(null);
      }
    }
  };

  // 根据设备名称匹配产品线
  const matchProductLineByName = (name: string): string | number => {
    const nameLower = name.toLowerCase();
    
    // 匹配规则：根据设备名称中的关键词确定产品线
    // 优先级：龙门 > 底盘 > 胎纹 > 侧扫 > 大盒子
    if (nameLower.includes('龙门') || nameLower.includes('longmen')) {
      const longmen = productLines.find(pl => pl.name.includes('龙门'));
      return longmen?.id ?? '';
    }
    if (nameLower.includes('底盘') || nameLower.includes('dipan')) {
      const dipan = productLines.find(pl => pl.name.includes('底盘'));
      return dipan?.id ?? '';
    }
    if (nameLower.includes('胎纹') || nameLower.includes('taiwen')) {
      const taiwen = productLines.find(pl => pl.name.includes('胎纹'));
      return taiwen?.id ?? '';
    }
    if (nameLower.includes('侧扫') || nameLower.includes('cesao')) {
      const cesao = productLines.find(pl => pl.name.includes('侧扫'));
      return cesao?.id ?? '';
    }
    if (nameLower.includes('大盒子') || nameLower.includes('dahezi') || nameLower.includes('盒子')) {
      const dahezi = productLines.find(pl => pl.name.includes('大盒子'));
      return dahezi?.id ?? '';
    }
    
    return '';
  };

  const handleModuleTypeToggle = (typeId: number) => {
    setSelectedModuleTypeIds(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  // 当选中模块变化时，重新计算置顶用户并自动勾选
  useEffect(() => {
    if (!feishuEnabled || feishuUsers.length === 0) return;

    // 从当前选中的模块类型中收集关联的飞书用户（去重）
    const newPinned: string[] = [];
    selectedModuleTypeIds.forEach(typeId => {
      const mt = moduleTypes.find(m => m.id === typeId);
      if (mt?.feishu_user_open_id && !newPinned.includes(mt.feishu_user_open_id)) {
        newPinned.push(mt.feishu_user_open_id);
      }
    });

    // 找出新增的置顶用户（上一次没有）
    const prevPinned = pinnedOpenIds;
    const added = newPinned.filter(id => !prevPinned.includes(id));
    // 找出移除的置顶用户（上一次有，现在没有）
    const removed = prevPinned.filter(id => !newPinned.includes(id));

    setPinnedOpenIds(newPinned);

    setNotifyOpenIds(prev => {
      let next = [...prev];
      // 新增置顶用户且未被手动移除过：自动勾选
      added.forEach(id => {
        if (!next.includes(id) && !manuallyRemovedRef.current.has(id)) {
          next.push(id);
        }
      });
      // 移除置顶用户：从选中列表中移除（除非用户手动添加过）
      removed.forEach(id => {
        if (!manuallyRemovedRef.current.has(id)) {
          next = next.filter(i => i !== id);
        }
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModuleTypeIds, moduleTypes, feishuEnabled, feishuUsers]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!device) {
      // 新增模式：设备编码、生产序列号、远程码三选一必填
      if (!formData.device_code?.trim() && !formData.id?.trim() && !formData.remote_code?.trim()) {
        newErrors.identity = '设备编码、生产序列号、远程码，至少填写其中一项';
      }
      if (!formData.customer_id) newErrors.customer_id = '请选择客户';
      if (!formData.product_line_id || formData.product_line_id === '' || formData.product_line_id === 0) {
        newErrors.product_line_id = '请选择产品线';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitError('');
    if (!validateForm()) {
      return;
    }

    let processedData: DeviceFormData;

    if (device) {
      // 编辑模式：提交所有可编辑字段（产品线/产品型号现在允许修改，用于修正选错的型号）
      processedData = {
        name: formData.name?.trim() || null,
        device_code: formData.device_code?.trim() || null,
        ...(!(device as any).bundle_id ? { customer_id: formData.customer_id || null } : {}),
        status: formData.status,
        remote_code: formData.remote_code?.trim() || null,
        password: formData.password?.trim() || null,
        merchant_id: formData.merchant_id?.trim() || null,
        merchant_password: formData.merchant_password?.trim() || null,
        notes: formData.notes?.trim() || null,
        // 产品线：提交当前选择（确保是数字，避免空字符串写入 INT 列）；未选时保持原值
        product_line_id: (formData.product_line_id ? Number(formData.product_line_id) : device.product_line_id) as number,
        // 产品型号：仅在已选择时提交，服务端会在型号变更时自动同步设备模块列表
        ...(formData.product_id ? { product_id: formData.product_id } : {}),
        // 传递 id 供父组件判断是否修改了生产序列号
        id: formData.id?.trim() || device.id,
      };
    } else {
      // 新增模式：提交所有字段
      processedData = {
        ...formData,
        id: formData.id?.trim() || undefined,
        device_code: formData.device_code?.trim() || null,
        product_id: formData.product_id || null,
        customer_id: formData.customer_id || null,
        remote_code: formData.remote_code?.trim() || null,
        password: formData.password?.trim() || null,
        notes: formData.notes?.trim() || null,
        selectedModuleTypeIds: selectedModuleTypeIds,
        notify_open_ids: notifyOpenIds.filter(Boolean),
        send_notify: feishuEnabled && notifyOpenIds.length > 0,
      };
    }

    setLoading(true);
    try {
      await onSubmit(processedData);
      onClose();
    } catch (error) {
      console.error('保存设备失败:', error);
      const e = error as Error & { field?: string };
      if (e.field) {
        // 字段级冲突（如序列号/设备编码重复）：在对应输入框下方红字提示
        setErrors(prev => ({ ...prev, [e.field!]: e.message }));
      } else {
        // 其他错误：表单顶部统一提示
        setSubmitError(e.message || '保存设备失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-50">
      <div className={`bg-popover rounded-2xl border border-border shadow-soft-lg ${mode === 'import' && !device ? 'max-w-5xl' : 'max-w-3xl'} w-full mx-4 max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0 gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {device ? '编辑设备' : '新增设备'}
          </h2>
          {!device && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${mode === 'manual' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                手动登记
              </button>
              <button
                type="button"
                onClick={() => setMode('import')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${mode === 'import' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                导入订单表
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {mode === 'import' && !device ? (
          <div className="px-5 py-3 overflow-y-auto flex-1">
            <OrderImportPanel
              onClose={onClose}
              onDone={(bundleId) => { onImported?.(bundleId); onClose(); }}
            />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="px-5 py-3 overflow-y-auto flex-1 space-y-3">
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              <ExclamationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          {/* 编辑模式：可编辑字段 */}
          {device && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {/* 订单号 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">订单号</label>
                  <input
                    type="text"
                    value={formData.name ?? ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm"
                    placeholder="请输入订单号"
                  />
                </div>

                {/* 设备编码 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">设备编码</label>
                  <input
                    type="text"
                    value={formData.device_code || ''}
                    onChange={(e) => handleChange('device_code', e.target.value)}
                    className={`w-full px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.device_code ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="请输入设备编码"
                  />
                  {errors.device_code && <p className="text-red-500 text-xs mt-1">{errors.device_code}</p>}
                </div>

                {/* 生产序列号 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">生产序列号</label>
                  <input
                    type="text"
                    value={formData.id || ''}
                    onChange={(e) => handleChange('id', e.target.value)}
                    className={`w-full px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.id ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="请输入生产序列号"
                  />
                  {errors.id && <p className="text-red-500 text-xs mt-1">{errors.id}</p>}
                </div>

                {/* 客户 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">客户</label>
                  {(device as any).bundle_id ? (
                    <>
                      <Select
                        value={formData.customer_id || ''}
                        disabled
                        placeholder="请选择客户"
                        options={customers.map(c => ({ value: c.id, label: `${c.name} (${c.short_name})` }))}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 disabled:opacity-60"
                      />
                      <p className="text-xs text-gray-400 mt-1">该设备属于多合一设备，请在多合一设备编辑中修改客户</p>
                    </>
                  ) : (
                    <Select
                      value={formData.customer_id || ''}
                      onChange={(v) => {
                        const val = v ? parseInt(v) : undefined;
                        setFormData(prev => ({ ...prev, customer_id: val }));
                        setErrors(prev => ({ ...prev, customer_id: '' }));
                        setSubmitError('');
                      }}
                      placeholder="请选择客户"
                      options={customers.map(c => ({ value: c.id, label: `${c.name} (${c.short_name})` }))}
                      className={`w-full px-3 py-1.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.customer_id ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  )}
                  {errors.customer_id && <p className="text-red-500 text-xs mt-1">{errors.customer_id}</p>}
                </div>

                {/* 产品线 | 产品型号（编辑模式可选择，用于修正选错的型号） */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">产品线</label>
                  <Select
                    value={formData.product_line_id}
                    onChange={(v) => handleChange('product_line_id', v ? parseInt(v) : '')}
                    placeholder="请选择产品线"
                    options={[{ value: '', label: '请选择产品线' }, ...productLines.map((pl) => ({ value: pl.id, label: pl.name }))]}
                    className={`w-full px-3 py-1.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.product_line_id ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.product_line_id && <p className="text-red-500 text-xs mt-1">{errors.product_line_id}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">产品型号</label>
                  <Select
                    value={formData.product_id || ''}
                    onChange={(v) => handleChange('product_id', v ? parseInt(v) : undefined)}
                    placeholder={products.length === 0 ? '请先选产品线' : '请选择产品型号'}
                    options={[{ value: '', label: products.length === 0 ? '请先选产品线' : '请选择产品型号' }, ...products.map((p) => ({ value: p.id, label: `${p.name}${p.model ? ` (${p.model})` : ''}` }))]}
                    className={`w-full px-3 py-1.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.product_id ? 'border-red-500' : 'border-gray-300'}`}
                    disabled={products.length === 0}
                  />
                  {errors.product_id && <p className="text-red-500 text-xs mt-1">{errors.product_id}</p>}
                  {!!formData.product_id && !!device.product_id && formData.product_id !== device.product_id && (
                    <p className="text-xs text-amber-600 mt-1">保存后将按新产品型号自动同步设备模块列表</p>
                  )}
                </div>

                {/* 状态 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">状态 <span className="text-red-500">*</span></label>
                  <Select
                    value={formData.status}
                    onChange={(v) => handleChange('status', v)}
                    options={[{ value: '生产中', label: '生产中' }, { value: '已发货', label: '已发货' }, { value: '使用中(正常)', label: '使用中(正常)' }, { value: '使用中(异常)', label: '使用中(异常)' }, { value: '已停用', label: '已停用' }]}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm"
                  />
                </div>

                {/* 远程码 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">远程码</label>
                  <input
                    type="text"
                    value={formData.remote_code || ''}
                    onChange={(e) => handleChange('remote_code', e.target.value)}
                    className={`w-full px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.remote_code ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="请输入远程码"
                  />
                  {errors.remote_code && <p className="text-red-500 text-xs mt-1">{errors.remote_code}</p>}
                </div>

                {/* 远程密码 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">远程密码</label>
                  <input
                    type="text"
                    value={formData.password || ''}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm"
                    placeholder="请输入密码"
                  />
                </div>

                {/* 商户号 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">商户号</label>
                  <input type="text" value={formData.merchant_id || ''} onChange={(e) => handleChange('merchant_id', e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm" placeholder="请输入商户号" />
                </div>

                {/* 商户密码 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">商户密码</label>
                  <input type="text" value={formData.merchant_password || ''} onChange={(e) => handleChange('merchant_password', e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm" placeholder="请输入商户密码" />
                </div>

                {/* 备注 */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm"
                    placeholder="请输入备注"
                    rows={2}
                  />
                </div>
              </div>
            </>
          )}

          {/* 新增模式：3列网格布局 */}
          {!device && (
            <div className="grid grid-cols-3 gap-x-3 gap-y-2">
              {/* Row 1: 订单号 | 设备编码 | 生产序列号 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">订单号</label>
                <input
                  type="text"
                  value={formData.name ?? ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm"
                  placeholder="请输入订单号"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">设备编码</label>
                <input
                  type="text"
                  value={formData.device_code || ''}
                  onChange={(e) => handleChange('device_code', e.target.value)}
                  className={`w-full px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${(errors.identity || errors.device_code) ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入设备编码"
                />
                {errors.device_code && <p className="text-red-500 text-xs mt-1">{errors.device_code}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">生产序列号</label>
                <input
                  type="text"
                  value={formData.id || ''}
                  onChange={(e) => handleChange('id', e.target.value)}
                  className={`w-full px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${(errors.identity || errors.id) ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入生产序列号"
                />
                {errors.id && <p className="text-red-500 text-xs mt-1">{errors.id}</p>}
              </div>

              {/* Row 2: 远程码 | 商户号 | 商户密码 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">远程码</label>
                <input
                  type="text"
                  value={formData.remote_code || ''}
                  onChange={(e) => handleChange('remote_code', e.target.value)}
                  className={`w-full px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${(errors.identity || errors.remote_code) ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入远程码"
                />
                {errors.identity && <p className="text-red-500 text-xs mt-1">{errors.identity}</p>}
                {errors.remote_code && <p className="text-red-500 text-xs mt-1">{errors.remote_code}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">商户号</label>
                <input type="text" value={formData.merchant_id || ''} onChange={(e) => handleChange('merchant_id', e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm" placeholder="请输入商户号" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">商户密码</label>
                <input type="text" value={formData.merchant_password || ''} onChange={(e) => handleChange('merchant_password', e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm" placeholder="请输入商户密码" />
              </div>

              {/* Row 3: 客户(col-span-2) | 状态 */}
              <div className="col-span-2 relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">客户 <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) setFormData(prev => ({ ...prev, customer_id: undefined }));
                      setErrors(prev => ({ ...prev, customer_id: '' }));
                      setSubmitError('');
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className={`w-full px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.customer_id ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="搜索客户名称或简称"
                  />
                  {formData.customer_id && (
                    <button type="button" onClick={handleClearCustomer} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {errors.customer_id && <p className="text-red-500 text-xs mt-1">{errors.customer_id}</p>}
                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button key={c.id} type="button" onClick={() => handleSelectCustomer(c)}
                        className={`w-full text-left px-3 py-2 hover:bg-muted text-sm text-foreground ${formData.customer_id === c.id ? 'bg-primary-50 text-primary-700' : ''}`}>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground ml-2">({c.short_name})</span>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">无匹配客户</div>}
                    <button type="button" onClick={() => { setShowNewCustomerForm(true); setShowCustomerDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-green-600 border-t border-border flex items-center gap-1">
                      <PlusIcon className="h-4 w-4" />新建客户
                    </button>
                  </div>
                )}
                {showCustomerDropdown && <div className="fixed inset-0 z-0" onClick={() => setShowCustomerDropdown(false)} />}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">状态 <span className="text-red-500">*</span></label>
                <Select
                  value={formData.status}
                  onChange={(v) => handleChange('status', v)}
                  options={[{ value: '生产中', label: '生产中' }, { value: '已发货', label: '已发货' }, { value: '使用中(正常)', label: '使用中(正常)' }, { value: '使用中(异常)', label: '使用中(异常)' }, { value: '已停用', label: '已停用' }]}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm"
                />
              </div>

              {/* 新建客户内联表单 */}
              {showNewCustomerForm && (
                <div className="col-span-3 bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-green-800">新建客户</p>
                  <div className="flex gap-2">
                    <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" placeholder="客户名称" />
                    <input type="text" value={newCustomerShortName} onChange={(e) => setNewCustomerShortName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" placeholder="英文简称（唯一）" />
                    <button type="button" onClick={() => setShowNewCustomerForm(false)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">取消</button>
                    <button type="button" onClick={handleCreateCustomer} className="px-3 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded">创建</button>
                  </div>
                </div>
              )}

              {/* Row 4: 产品线 | 产品型号 | 备注 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">产品线 <span className="text-red-500">*</span></label>
                <Select
                  value={formData.product_line_id}
                  onChange={(v) => handleChange('product_line_id', v ? parseInt(v) : '')}
                  placeholder="请选择产品线"
                  options={[{ value: '', label: '请选择产品线' }, ...productLines.map((pl) => ({ value: pl.id, label: pl.name }))]}
                  className={`w-full px-3 py-1.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.product_line_id ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.product_line_id && <p className="text-red-500 text-xs mt-1">{errors.product_line_id}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">产品型号</label>
                <Select
                  value={formData.product_id || ''}
                  onChange={(v) => handleChange('product_id', v ? parseInt(v) : undefined)}
                  placeholder={products.length === 0 ? '请先选产品线' : '请选择产品型号'}
                  options={[{ value: '', label: products.length === 0 ? '请先选产品线' : '请选择产品型号' }, ...products.map((p) => ({ value: p.id, label: `${p.name}${p.model ? ` (${p.model})` : ''}` }))]}
                  className={`w-full px-3 py-1.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm ${errors.product_id ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={products.length === 0}
                />
                {errors.product_id && <p className="text-red-500 text-xs mt-1">{errors.product_id}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm"
                  placeholder="请输入备注"
                />
              </div>

              {/* 选配模块 */}
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">选配模块</label>
                {!formData.product_id ? (
                  <p className="text-xs text-gray-400 border border-gray-200 rounded-md p-3">请先选择产品型号以加载可选模块</p>
                ) : moduleTypes.length === 0 ? (
                  <p className="text-xs text-gray-400 border border-gray-200 rounded-md p-3">该产品暂无配置模块</p>
                ) : (
                  <div className="border border-gray-200 rounded-md p-2 max-h-32 overflow-y-auto grid grid-cols-3 gap-1">
                    {moduleTypes.map((mt) => (
                      <label key={mt.id} className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                        mt.is_required ? 'bg-blue-50 cursor-default' : 'cursor-pointer hover:bg-gray-50'
                      }`}>
                        <input type="checkbox" checked={selectedModuleTypeIds.includes(mt.id)}
                          onChange={() => !mt.is_required && handleModuleTypeToggle(mt.id)}
                          disabled={mt.is_required}
                          className={`rounded border-gray-300 ${mt.is_required ? 'text-primary-600 opacity-70' : 'text-primary-600'}`} />
                        <span className={`text-xs ${mt.is_required ? 'text-primary-700 font-medium' : 'text-gray-700'}`}>{mt.name}</span>
                        {mt.is_required ? (
                          <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-1 rounded">必</span>
                        ) : (
                          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1 rounded">选</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {moduleTypes.length > 0 && selectedModuleTypeIds.length > 0 && (
                  <p className="text-xs text-primary-600 mt-0.5">已选 {selectedModuleTypeIds.length} 个模块</p>
                )}
              </div>

              {/* 飞书通知 */}
              {feishuEnabled && (
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    通知同事填写版本号（飞书）
                    {pinnedOpenIds.length > 0 && (
                      <span className="ml-2 text-xs text-primary-600 font-normal">
                        {pinnedOpenIds.length} 位模块关联负责人已置顶
                      </span>
                    )}
                  </label>
                  <FeishuMultiUserPicker
                    users={feishuUsers}
                    pinnedOpenIds={pinnedOpenIds}
                    value={notifyOpenIds}
                    onChange={(ids) => {
                      pinnedOpenIds.forEach(id => {
                        if (notifyOpenIds.includes(id) && !ids.includes(id)) {
                          manuallyRemovedRef.current.add(id);
                        }
                        if (!notifyOpenIds.includes(id) && ids.includes(id)) {
                          manuallyRemovedRef.current.delete(id);
                        }
                      });
                      setNotifyOpenIds(ids);
                    }}
                  />
                </div>
              )}
            </div>
          )}


          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={loading}>{loading ? '保存中...' : (device ? '更新' : '新增')}</Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default DeviceForm;
