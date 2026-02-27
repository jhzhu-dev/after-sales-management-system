import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Device, DeviceFormData, Customer } from '../types';

interface DeviceFormProps {
  device?: Device | null;
  onClose: () => void;
  onSubmit: (data: DeviceFormData) => Promise<void>;
}

const DeviceForm: React.FC<DeviceFormProps> = ({ device, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<DeviceFormData>({
    id: '',
    name: '',
    device_code: '',
    product_line_id: '',
    product_id: undefined,
    customer_id: undefined,
    status: '正常',
    remote_code: '',
    password: ''
  });

  const [productLines, setProductLines] = useState<Array<{ id: number, name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: number, name: string, model?: string }>>([]);
  const [moduleTypes, setModuleTypes] = useState<Array<{ id: number, name: string, code: string }>>([]);
  const [selectedModuleTypeIds, setSelectedModuleTypeIds] = useState<number[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerShortName, setNewCustomerShortName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
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
        status: device.status as '正常' | '异常' | '维护中',
        remote_code: device.remote_code || '',
        password: device.password || ''
      });
      if (device.product_line_id) {
        fetchProducts(device.product_line_id);
      }
      if (device.product_id) {
        fetchModuleTypesByProduct(device.product_id);
      }
      if (device.customer_id) {
        const displayName = device.customer_name || '';
        setCustomerSearch(displayName);
      }
    }
  }, [device]);

  const fetchProducts = async (productLineId: string | number) => {
    if (!productLineId) {
      setProducts([]);
      return;
    }
    try {
      const response = await fetch(`/api/products?product_line_id=${productLineId}&is_active=1`);
      const result = await response.json();
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
      const response = await fetch(`/api/product-modules/${productId}/modules`);
      const result = await response.json();
      if (result.success) {
        setModuleTypes(result.data.map((m: any) => ({
          id: m.module_type_id,
          name: m.module_type_name,
          code: m.module_type_code
        })));
        setSelectedModuleTypeIds([]);
      }
    } catch (error) {
      console.error('获取产品模块类型失败:', error);
    }
  };

  const fetchProductLines = async () => {
    try {
      const response = await fetch('/api/product-lines?is_active=1');
      const result = await response.json();
      if (result.success) {
        setProductLines(result.data);
      }
    } catch (error) {
      console.error('获取产品线失败:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const result = await response.json();
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
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName.trim(), short_name: newCustomerShortName.trim() })
      });
      const result = await response.json();
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
    } catch (error) {
      console.error('创建客户失败:', error);
      alert('创建客户失败');
    }
  };

  const handleChange = (field: keyof DeviceFormData, value: string | number | undefined) => {
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

    // 当产品型号改变时，获取该产品的模块列表
    if (field === 'product_id') {
      fetchModuleTypesByProduct(value as number | null | undefined);
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!device) {
      // 新增模式：所有字段必填
      if (!formData.name.trim()) newErrors.name = '设备名称不能为空';
      if (!formData.device_code?.trim()) newErrors.device_code = '设备编码不能为空';
      if (!formData.id?.trim()) newErrors.id = '生产序列号不能为空';
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

    if (!validateForm()) {
      return;
    }

    let processedData: DeviceFormData;

    if (device) {
      // 编辑模式：只提交可编辑字段
      processedData = {
        status: formData.status,
        remote_code: formData.remote_code?.trim() || null,
        password: formData.password?.trim() || null,
        name: device.name,
        product_line_id: device.product_line_id || '',
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
        selectedModuleTypeIds: selectedModuleTypeIds
      };
    }

    setLoading(true);
    try {
      await onSubmit(processedData);
      onClose();
    } catch (error) {
      console.error('保存设备失败:', error);
      alert('保存设备失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {device ? '编辑设备' : '新增设备'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 编辑模式：显示只读信息 */}
          {device && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">名称</span>
                <span className="font-medium text-gray-900">{device.name}</span>
              </div>
              {device.device_code && (
                <div className="flex justify-between">
                  <span className="text-gray-500">设备编码</span>
                  <span className="font-medium text-gray-900">{device.device_code}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">生产序列号</span>
                <span className="font-medium text-gray-900">{device.id}</span>
              </div>
              {device.customer_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">客户</span>
                  <span className="font-medium text-gray-900">{device.customer_name}</span>
                </div>
              )}
              {device.product_line_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">产品线</span>
                  <span className="font-medium text-gray-900">{device.product_line_name}</span>
                </div>
              )}
              {device.product_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">产品型号</span>
                  <span className="font-medium text-gray-900">{device.product_name}{device.product_model ? ` (${device.product_model})` : ''}</span>
                </div>
              )}
            </div>
          )}

          {/* 新增模式：1. 名称 */}
          {!device && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="请输入名称"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>
          )}

          {/* 新增模式：以下字段全部必填 */}
          {!device && (
            <>
              {/* 2. 设备编码 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  设备编码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.device_code || ''}
                  onChange={(e) => handleChange('device_code', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.device_code ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入设备编码"
                />
                {errors.device_code && <p className="text-red-500 text-sm mt-1">{errors.device_code}</p>}
              </div>

              {/* 3. 生产序列号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  生产序列号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.id || ''}
                  onChange={(e) => handleChange('id', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.id ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入生产序列号"
                />
                {errors.id && <p className="text-red-500 text-sm mt-1">{errors.id}</p>}
              </div>

              {/* 4. 客户 */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) {
                        setFormData(prev => ({ ...prev, customer_id: undefined }));
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customer_id ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="搜索客户名称或简称"
                  />
                  {formData.customer_id && (
                    <button type="button" onClick={handleClearCustomer} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {errors.customer_id && <p className="text-red-500 text-sm mt-1">{errors.customer_id}</p>}
                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button key={c.id} type="button" onClick={() => handleSelectCustomer(c)}
                        className={`w-full text-left px-3 py-2 hover:bg-blue-50 text-sm ${formData.customer_id === c.id ? 'bg-blue-50 text-blue-700' : ''}`}>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-gray-400 ml-2">({c.short_name})</span>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">无匹配客户</div>}
                    <button type="button" onClick={() => { setShowNewCustomerForm(true); setShowCustomerDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-green-600 border-t border-gray-100 flex items-center gap-1">
                      <PlusIcon className="h-4 w-4" />新建客户
                    </button>
                  </div>
                )}
                {showCustomerDropdown && <div className="fixed inset-0 z-0" onClick={() => setShowCustomerDropdown(false)} />}
              </div>

              {/* 新建客户内联表单 */}
              {showNewCustomerForm && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-green-800">新建客户</p>
                  <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" placeholder="客户名称" />
                  <input type="text" value={newCustomerShortName} onChange={(e) => setNewCustomerShortName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" placeholder="英文简称（唯一）" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowNewCustomerForm(false)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">取消</button>
                    <button type="button" onClick={handleCreateCustomer} className="px-3 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded">创建</button>
                  </div>
                </div>
              )}

              {/* 5. 产品线 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  产品线 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.product_line_id}
                  onChange={(e) => handleChange('product_line_id', e.target.value ? parseInt(e.target.value) : '')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.product_line_id ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">请选择产品线</option>
                  {productLines.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                  ))}
                </select>
                {errors.product_line_id && <p className="text-red-500 text-sm mt-1">{errors.product_line_id}</p>}
              </div>

              {/* 6. 产品型号 - 选择产品线后显示 */}
              {products.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    产品型号 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.product_id || ''}
                    onChange={(e) => handleChange('product_id', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择产品型号</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.model ? ` (${p.model})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 7. 选配模块 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选配模块</label>
                {!formData.product_id ? (
                  <p className="text-xs text-gray-400 border border-gray-200 rounded-md p-3">请先选择产品型号以加载可选模块</p>
                ) : moduleTypes.length === 0 ? (
                  <p className="text-xs text-gray-400 border border-gray-200 rounded-md p-3">该产品暂无配置模块</p>
                ) : (
                  <div className="border border-gray-200 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {moduleTypes.map((mt) => (
                      <label key={mt.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1">
                        <input type="checkbox" checked={selectedModuleTypeIds.includes(mt.id)}
                          onChange={() => handleModuleTypeToggle(mt.id)} className="rounded border-gray-300 text-blue-600" />
                        <span className="text-sm text-gray-700">{mt.name}</span>
                        <span className="text-xs text-gray-400">({mt.code})</span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedModuleTypeIds.length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">已选 {selectedModuleTypeIds.length} 个模块，创建设备时自动添加</p>
                )}
              </div>
            </>
          )}

          {/* 状态（新增和编辑都显示） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="正常">正常</option>
              <option value="异常">异常</option>
              <option value="维护中">维护中</option>
            </select>
          </div>

          {/* 远程码和密码仅编辑模式显示 */}
          {device && (
            <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">远程码</label>
            <input
              type="text"
              value={formData.remote_code || ''}
              onChange={(e) => handleChange('remote_code', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入远程码"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={formData.password || ''}
              onChange={(e) => handleChange('password', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入密码"
            />
          </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '保存中...' : (device ? '更新' : '新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceForm;
