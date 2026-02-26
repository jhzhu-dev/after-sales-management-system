import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Device, DeviceFormData, Product, ProductModule, Customer } from '../types';

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
    location: '',
    status: '正常',
    remote_code: '',
    password: ''
  });

  const [productLines, setProductLines] = useState<Array<{ id: number, name: string }>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productModules, setProductModules] = useState<ProductModule[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerShortName, setNewCustomerShortName] = useState('');
  const [showModulePreview, setShowModulePreview] = useState(false);
  const [selectedOptionalModules, setSelectedOptionalModules] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProductLines();
    fetchCustomers();
    if (device) {
      setFormData({
        id: device.id,
        name: device.name,
        device_code: (device as any).device_code || '',
        product_line_id: device.product_line_id || '',
        product_id: (device as any).product_id,
        customer_id: device.customer_id || undefined,
        location: device.location || '',
        status: device.status as '正常' | '异常' | '维护中',
        remote_code: device.remote_code || '',
        password: device.password || ''
      });
      if (device.customer_id) {
        const displayName = device.customer_name || '';
        setCustomerSearch(displayName);
      }
      if (device.product_line_id) {
        fetchProducts(device.product_line_id);
      }
    }
  }, [device]);

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

  const fetchProducts = async (productLineId: string | number) => {
    try {
      console.log('正在获取产品列表，产品线ID:', productLineId, '类型:', typeof productLineId);
      const url = `/api/products?product_line_id=${productLineId}&is_active=1`;
      console.log('请求URL:', url);
      const response = await fetch(url);
      const result = await response.json();
      console.log('产品列表返回结果:', result);
      if (result.success) {
        setProducts(result.data);
        console.log('已设置产品列表，数量:', result.data.length);
        if (result.data.length > 0) {
          console.log('产品详情:', result.data);
        }
      } else {
        console.error('API返回失败:', result);
      }
    } catch (error) {
      console.error('获取产品列表失败:', error);
    }
  };

  const fetchProductModules = async (productId: number) => {
    try {
      const response = await fetch(`/api/product-modules/${productId}/modules`);
      const result = await response.json();
      if (result.success) {
        setProductModules(result.data);
        // 默认选中所有可选模块
        const optionalIds = new Set<number>(result.data.filter((m: ProductModule) => !m.is_required).map((m: ProductModule) => m.module_type_id));
        setSelectedOptionalModules(optionalIds);
      }
    } catch (error) {
      console.error('获取产品模块配置失败:', error);
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
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // 当设备名称改变时，自动匹配产品线
    if (field === 'name' && typeof value === 'string') {
      const matchedProductLineId = matchProductLineByName(value);
      if (matchedProductLineId && !device) { // 只在新建时自动匹配，编辑时不改变
        setFormData(prev => ({ ...prev, product_line_id: matchedProductLineId, product_id: undefined }));
        fetchProducts(matchedProductLineId);
      }
    }

    // 当产品线改变时，重新加载产品列表
    if (field === 'product_line_id') {
      setFormData(prev => ({ ...prev, product_id: undefined }));
      setProducts([]);
      setProductModules([]);
      if (value) {
        fetchProducts(value);
      }
    }

    // 当产品改变时，加载模块配置
    if (field === 'product_id' && value) {
      fetchProductModules(value as number);
    } else if (field === 'product_id' && !value) {
      setProductModules([]);
      setSelectedOptionalModules(new Set());
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '设备名称不能为空';
    }
    if (!formData.product_line_id || formData.product_line_id === '' || formData.product_line_id === 0) {
      newErrors.product_line_id = '请选择产品线';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const processedData: DeviceFormData = {
      ...formData,
      id: formData.id?.trim() || undefined,
      device_code: formData.device_code?.trim() || null,
      customer_id: formData.customer_id || null,
      location: formData.location?.trim() || null,
      remote_code: formData.remote_code?.trim() || null,
      password: formData.password?.trim() || null
    };

    // 新建时传递选中的模块类型ID
    if (!device && productModules.length > 0) {
      const requiredIds = productModules.filter(m => m.is_required).map(m => m.module_type_id);
      const optionalIds = Array.from(selectedOptionalModules);
      processedData.selectedModuleTypeIds = [...requiredIds, ...optionalIds];
    }

    // 如果是编辑模式且没有修改ID，不提交ID
    if (device && processedData.id === device.id) {
      delete processedData.id;
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

          {device && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                生产序列号
              </label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => handleChange('id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入生产序列号"
              />
              <p className="text-xs text-gray-500 mt-1">修改序列号将更新设备的唯一标识</p>
            </div>
          )}

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
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
            {errors.product_line_id && <p className="text-red-500 text-sm mt-1">{errors.product_line_id}</p>}
          </div>

          {/* 产品选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              产品（可选）
            </label>
            <select
              value={formData.product_id || ''}
              onChange={(e) => handleChange('product_id', e.target.value ? parseInt(e.target.value) : undefined)}
              disabled={!formData.product_line_id || products.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">{device ? '未选择产品' : '不选择产品（手动添加模块）'}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} {product.model ? `(${product.model})` : ''}
                </option>
              ))}
            </select>
            <p className="text-gray-500 text-xs mt-1">
              {!formData.product_line_id ? '请先选择产品线' : products.length === 0 ? '该产品线暂无可用产品' : device ? '切换产品不会自动修改已有模块' : '选择产品后将自动创建该产品的模块配置'}
            </p>
          </div>

          {/* 模块配置预览 */}
          {!device && productModules.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <button
                type="button"
                onClick={() => setShowModulePreview(!showModulePreview)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm font-medium text-blue-900">
                  将自动创建 {productModules.filter(m => m.is_required || selectedOptionalModules.has(m.module_type_id)).length} 个模块
                </span>
                {showModulePreview ? (
                  <ChevronUpIcon className="h-4 w-4 text-blue-600" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-blue-600" />
                )}
              </button>
              {showModulePreview && (
                <div className="mt-3 space-y-2">
                  {productModules.map((module, index) => (
                    <div key={index} className="flex items-center justify-between text-sm bg-white rounded px-3 py-2">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={module.is_required || selectedOptionalModules.has(module.module_type_id)}
                          disabled={module.is_required}
                          onChange={() => {
                            if (!module.is_required) {
                              setSelectedOptionalModules(prev => {
                                const next = new Set(prev);
                                if (next.has(module.module_type_id)) next.delete(module.module_type_id);
                                else next.add(module.module_type_id);
                                return next;
                              });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-gray-700">{module.module_type_name}</span>
                      </label>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${module.is_required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {module.is_required ? '必需' : '可选'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 客户选择 */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              客户
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="搜索客户名称或简称"
              />
              {formData.customer_id && (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {showCustomerDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className={`w-full text-left px-3 py-2 hover:bg-blue-50 text-sm ${formData.customer_id === c.id ? 'bg-blue-50 text-blue-700' : ''}`}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-gray-400 ml-2">({c.short_name})</span>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">无匹配客户</div>
                )}
                <button
                  type="button"
                  onClick={() => { setShowNewCustomerForm(true); setShowCustomerDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-green-600 border-t border-gray-100 flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  新建客户
                </button>
              </div>
            )}
            {/* 点击外部关闭 */}
            {showCustomerDropdown && (
              <div className="fixed inset-0 z-0" onClick={() => setShowCustomerDropdown(false)} />
            )}
          </div>

          {/* 新建客户内联表单 */}
          {showNewCustomerForm && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-green-800">新建客户</p>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="客户名称"
              />
              <input
                type="text"
                value={newCustomerShortName}
                onChange={(e) => setNewCustomerShortName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="英文简称（唯一）"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowNewCustomerForm(false)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">取消</button>
                <button type="button" onClick={handleCreateCustomer} className="px-3 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded">创建</button>
              </div>
            </div>
          )}

          {/* 生产序列号 - 新建时可选填，编辑时只读 */}
          {!device && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                生产序列号
              </label>
              <input
                type="text"
                value={formData.id || ''}
                onChange={(e) => handleChange('id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入生产序列号"
              />
              <p className="text-gray-500 text-xs mt-1">手动输入生产序列号</p>
            </div>
          )}

          {/* 设备编码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              设备编码
            </label>
            <input
              type="text"
              value={formData.device_code || ''}
              onChange={(e) => handleChange('device_code', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入设备编码"
            />
            <p className="text-gray-500 text-xs mt-1">手动输入设备编码，用于软件绑定</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态
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

          {/* 仅在编辑模式显示远程码和密码 */}
          {device && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  远程码
                </label>
                <input
                  type="text"
                  value={formData.remote_code || ''}
                  onChange={(e) => handleChange('remote_code', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入远程码"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码
                </label>
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
