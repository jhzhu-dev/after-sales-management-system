import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { DeviceBundle, Device, Customer, NewBundleDevice } from '../types';
import { customerApi, deviceApi, bundleApi, productLineApi, productApi, productModuleApi, productVersionApi } from '../services/api';

interface BundleFormProps {
  bundle?: DeviceBundle | null;
  onClose: () => void;
  onSubmit: () => void;
}

interface NewDeviceRow {
  key: number;
  id: string;
  device_code: string;
  product_line_id: number | '';
  product_id: number | '';
  product_version_id: number | '';
  status: string;
  module_type_ids: number[];
  products: Array<{ id: number; name: string; model?: string }>;
  versions: Array<{ id: number; version_number: string; version_name?: string }>;
  moduleTypes: Array<{ id: number; name: string; code: string; is_required: boolean }>;
}

let rowKeyCounter = 0;

function emptyDeviceRow(): NewDeviceRow {
  return {
    key: ++rowKeyCounter,
    id: '',
    device_code: '',
    product_line_id: '',
    product_id: '',
    product_version_id: '',
    status: '正常',
    module_type_ids: [],
    products: [],
    versions: [],
    moduleTypes: [],
  };
}

export default function BundleForm({ bundle, onClose, onSubmit }: BundleFormProps) {
  const isEdit = !!bundle;

  const [bundleCode, setBundleCode] = useState(bundle?.bundle_code || '');
  const [name, setName] = useState(bundle?.name || '');
  const [customerId, setCustomerId] = useState<number | ''>(bundle?.customer_id || '');
  const [remoteCode, setRemoteCode] = useState(bundle?.remote_code || '');
  const [password, setPassword] = useState(bundle?.password || '');
  const [description, setDescription] = useState(bundle?.description || '');

  const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);
  const [bundleDevices, setBundleDevices] = useState<Device[]>([]);

  const [newDeviceRows, setNewDeviceRows] = useState<NewDeviceRow[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productLines, setProductLines] = useState<Array<{ id: number; name: string }>>([]);

  // Search for existing devices
  const [deviceSearch, setDeviceSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Device[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedDeviceIds = selectedDevices.map(d => d.id);
  const totalCount = selectedDeviceIds.length + newDeviceRows.length;

  useEffect(() => {
    loadCustomers();
    loadProductLines();
    if (isEdit && bundle) {
      loadBundleDevices();
    }
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await customerApi.getCustomers();
      if (res.success) setCustomers(res.data);
    } catch (e) { console.error(e); }
  };

  const loadProductLines = async () => {
    try {
      const res = await productLineApi.getProductLines({ is_active: true });
      if (res.success) setProductLines(res.data);
    } catch (e) { console.error(e); }
  };

  const loadBundleDevices = async () => {
    if (!bundle) return;
    try {
      const res = await bundleApi.getBundle(bundle.id);
      if (res.success && res.data.devices) {
        setBundleDevices(res.data.devices);
        setSelectedDevices(res.data.devices);
      }
    } catch (e) { console.error(e); }
  };

  // Debounced search for existing devices
  const searchDevices = useCallback(async (query: string) => {
    if (!customerId || !query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await deviceApi.getDevices({
        page: 1, limit: 20, search: query.trim(), customer_id: String(customerId),
      });
      if (res.success) {
        setSearchResults(res.data.filter((d: Device) =>
          (!d.bundle_id || (isEdit && d.bundle_id === bundle?.id)) &&
          !selectedDevices.some(s => s.id === d.id)
        ));
      }
    } catch (e) { console.error(e); }
    finally { setSearchLoading(false); }
  }, [customerId, selectedDevices, isEdit, bundle]);

  const handleSearchChange = (value: string) => {
    setDeviceSearch(value);
    setShowSearchDropdown(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(() => searchDevices(value), 300);
  };

  const addExistingDevice = (device: Device) => {
    if (totalCount >= 5) { setError('最多5台设备'); return; }
    if (selectedDeviceIds.includes(device.id)) return;
    setSelectedDevices(prev => [...prev, device]);
    setDeviceSearch('');
    setSearchResults([]);
    setShowSearchDropdown(false);
    setError('');
  };

  const removeExistingDevice = (deviceId: string) => {
    setSelectedDevices(prev => prev.filter(d => d.id !== deviceId));
    setError('');
  };

  const addNewDeviceRow = () => {
    if (totalCount >= 5) {
      setError('最多5台设备');
      return;
    }
    setError('');
    setNewDeviceRows(prev => [...prev, emptyDeviceRow()]);
  };

  const removeNewDeviceRow = (key: number) => {
    setNewDeviceRows(prev => prev.filter(r => r.key !== key));
    setError('');
  };

  const updateNewDeviceRow = (key: number, field: string, value: any) => {
    setNewDeviceRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const handleProductLineChange = async (key: number, plId: number | '') => {
    if (!plId) {
      setNewDeviceRows(prev => prev.map(r => r.key === key ? { ...r, product_line_id: '', product_id: '', product_version_id: '', products: [], versions: [], moduleTypes: [], module_type_ids: [] } : r));
      return;
    }
    try {
      const res = await productApi.getProducts({ product_line_id: Number(plId), is_active: true });
      if (res.success) {
        setNewDeviceRows(prev => prev.map(r => r.key === key ? { ...r, product_line_id: plId, product_id: '', product_version_id: '', products: res.data, versions: [], moduleTypes: [], module_type_ids: [] } : r));
      }
    } catch (e) { console.error(e); }
  };

  const handleProductChange = async (key: number, productId: number | '') => {
    if (!productId) {
      setNewDeviceRows(prev => prev.map(r => r.key === key ? { ...r, product_id: '', product_version_id: '', versions: [], moduleTypes: [], module_type_ids: [] } : r));
      return;
    }
    try {
      const [versRes, modRes] = await Promise.all([
        productVersionApi.getVersions({ product_id: productId }),
        productModuleApi.getProductModules(productId)
      ]);
      const versions = versRes.success ? versRes.data.map((v: any) => ({ id: v.id, version_number: v.version_number, version_name: v.version_name })) : [];
      let moduleTypes: any[] = [];
      let autoSelectedIds: number[] = [];
      if (modRes.success) {
        moduleTypes = modRes.data.map((m: any) => ({
          id: m.module_type_id,
          name: m.module_type_name,
          code: m.module_type_code,
          is_required: !!m.is_required
        }));
        autoSelectedIds = moduleTypes.filter((m: any) => m.is_required).map((m: any) => m.id);
      }
      setNewDeviceRows(prev => prev.map(r => r.key === key ? { ...r, product_id: productId, product_version_id: '', versions, moduleTypes, module_type_ids: autoSelectedIds } : r));
    } catch (e) { console.error(e); }
  };

  const toggleModuleType = (key: number, typeId: number, isRequired: boolean) => {
    if (isRequired) return;
    setNewDeviceRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      const has = r.module_type_ids.includes(typeId);
      return { ...r, module_type_ids: has ? r.module_type_ids.filter(id => id !== typeId) : [...r.module_type_ids, typeId] };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerId) { setError('请选择客户'); return; }

    if (isEdit) {
      if (selectedDeviceIds.length < 2) { setError('请至少保留2台设备'); return; }
      setSubmitting(true);
      try {
        await bundleApi.updateBundle(bundle!.id, {
          bundle_code: bundleCode || undefined,
          name: name || undefined,
          description: description || undefined,
          remote_code: remoteCode,
          password: password
        });
        const currentIds = bundleDevices.map(d => d.id);
        const toAdd = selectedDeviceIds.filter(id => !currentIds.includes(id));
        const toRemove = currentIds.filter(id => !selectedDeviceIds.includes(id));
        for (const deviceId of toRemove) await bundleApi.removeDevice(bundle!.id, deviceId);
        for (const deviceId of toAdd) await bundleApi.addDevice(bundle!.id, deviceId);
        onSubmit();
      } catch (err: any) {
        setError(err?.response?.data?.error || '保存失败');
      } finally { setSubmitting(false); }
      return;
    }

    const total = selectedDeviceIds.length + newDeviceRows.length;
    if (total < 2) { setError('多合一设备至少需要2台设备'); return; }
    if (total > 5) { setError('多合一设备最多5台设备'); return; }

    for (const row of newDeviceRows) {
      if (!row.id.trim()) { setError('新增设备的生产序列号不能为空'); return; }
      if (!row.product_line_id) { setError(`设备 ${row.id} 未选择产品线`); return; }
    }
    const allIds = [...selectedDeviceIds, ...newDeviceRows.map(r => r.id.trim())];
    const idSet = new Set(allIds);
    if (idSet.size !== allIds.length) { setError('存在重复的设备序列号'); return; }

    setSubmitting(true);
    try {
      const newDevices: NewBundleDevice[] = newDeviceRows.map(r => ({
        id: r.id.trim(),
        device_code: r.device_code.trim() || undefined,
        product_line_id: r.product_line_id as number,
        product_id: r.product_id ? r.product_id as number : undefined,
        product_version_id: r.product_version_id ? r.product_version_id as number : undefined,
        status: r.status,
        module_type_ids: r.module_type_ids.length > 0 ? r.module_type_ids : undefined,
      }));

      await bundleApi.createBundle({
        bundle_code: bundleCode.trim() || undefined,
        name: name.trim() || undefined,
        customer_id: customerId as number,
        description: description.trim() || undefined,
        remote_code: remoteCode.trim() || undefined,
        password: password.trim() || undefined,
        device_ids: selectedDeviceIds.length > 0 ? selectedDeviceIds : undefined,
        new_devices: newDevices.length > 0 ? newDevices : undefined,
      });
      onSubmit();
    } catch (err: any) {
      setError(err?.response?.data?.error || '创建失败');
    } finally { setSubmitting(false); }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';
  const selectCls = `${inputCls} appearance-none`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
            <h3 className="text-lg font-medium text-gray-900">
              {isEdit ? '编辑多合一设备' : '新建多合一设备'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-800 border-b pb-1">共享信息（所有成员设备继承）</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">多合一设备订单号</label>
                  <input type="text" value={bundleCode} onChange={e => setBundleCode(e.target.value)} placeholder="留空自动生成 T- 编号" className={inputCls} />
                  <p className="text-xs text-gray-400 mt-0.5">未填写将自动生成 T- 编号</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客户 <span className="text-red-500">*</span></label>
                  <select
                    value={customerId}
                    onChange={e => { const v = e.target.value ? parseInt(e.target.value) : ''; setCustomerId(v); setSelectedDevices([]); setNewDeviceRows([]); setDeviceSearch(''); setSearchResults([]); }}
                    disabled={isEdit}
                    className={`${selectCls} disabled:bg-gray-100`}
                  >
                    <option value="">请选择客户</option>
                    {customers.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.short_name})</option>))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">远程码 <span className="text-gray-400 font-normal">(共享)</span></label>
                  <input type="text" value={remoteCode} onChange={e => setRemoteCode(e.target.value)} placeholder="所有设备共用远程码" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">密码 <span className="text-gray-400 font-normal">(共享)</span></label>
                  <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="所有设备共用密码" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">多合一名称 <span className="text-gray-400 font-normal">(可选)</span></label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="多合一设备备注名称" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注 <span className="text-gray-400 font-normal">(可选)</span></label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="多合一设备说明..." className={inputCls} />
                </div>
              </div>
            </div>

            {!isEdit && customerId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="text-sm font-semibold text-gray-800">
                    新增设备
                    <span className="text-gray-400 font-normal ml-2">{newDeviceRows.length} 台</span>
                  </h4>
                  <button type="button" onClick={addNewDeviceRow} disabled={totalCount >= 5} className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed">
                    <PlusIcon className="h-4 w-4 mr-0.5" /> 添加设备
                  </button>
                </div>

                {newDeviceRows.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-3 border rounded-md border-dashed">
                    点击「添加设备」创建新设备并加入多合一设备
                  </div>
                )}

                {newDeviceRows.map((row, idx) => (
                  <div key={row.key} className="border rounded-lg p-3 space-y-3 bg-gray-50 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">新设备 #{idx + 1}</span>
                      <button type="button" onClick={() => removeNewDeviceRow(row.key)} className="text-red-500 hover:text-red-700">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">生产序列号 <span className="text-red-500">*</span></label>
                        <input type="text" value={row.id} onChange={e => updateNewDeviceRow(row.key, 'id', e.target.value)} placeholder="手动输入序列号" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">设备编码</label>
                        <input type="text" value={row.device_code} onChange={e => updateNewDeviceRow(row.key, 'device_code', e.target.value)} placeholder="可选" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">产品线 <span className="text-red-500">*</span></label>
                        <select value={row.product_line_id} onChange={e => handleProductLineChange(row.key, e.target.value ? parseInt(e.target.value) : '')} className={selectCls}>
                          <option value="">选择产品线</option>
                          {productLines.map(pl => (<option key={pl.id} value={pl.id}>{pl.name}</option>))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">产品型号</label>
                        <select value={row.product_id} onChange={e => handleProductChange(row.key, e.target.value ? parseInt(e.target.value) : '')} disabled={!row.product_line_id} className={`${selectCls} disabled:bg-gray-100`}>
                          <option value="">选择产品</option>
                          {row.products.map(p => (<option key={p.id} value={p.id}>{p.name}{p.model ? ` (${p.model})` : ''}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">迭代版本</label>
                        <select value={row.product_version_id} onChange={e => updateNewDeviceRow(row.key, 'product_version_id', e.target.value ? parseInt(e.target.value) : '')} disabled={!row.product_id} className={`${selectCls} disabled:bg-gray-100`}>
                          <option value="">选择版本</option>
                          {row.versions.map(v => (<option key={v.id} value={v.id}>{v.version_number}{v.version_name ? ` - ${v.version_name}` : ''}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">状态</label>
                        <select value={row.status} onChange={e => updateNewDeviceRow(row.key, 'status', e.target.value)} className={selectCls}>
                          <option value="正常">正常</option>
                          <option value="异常">异常</option>
                          <option value="维护中">维护中</option>
                        </select>
                      </div>
                    </div>

                    {row.moduleTypes.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">选配模块</label>
                        <div className="flex flex-wrap gap-2">
                          {row.moduleTypes.map(mt => {
                            const checked = row.module_type_ids.includes(mt.id);
                            return (
                              <label key={mt.id} className={`inline-flex items-center px-2 py-1 rounded text-xs cursor-pointer border ${checked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600'} ${mt.is_required ? 'opacity-75 cursor-not-allowed' : 'hover:border-blue-400'}`}>
                                <input type="checkbox" checked={checked} onChange={() => toggleModuleType(row.key, mt.id, mt.is_required)} disabled={mt.is_required} className="h-3 w-3 mr-1" />
                                {mt.name}
                                {mt.is_required && <span className="text-red-500 ml-0.5">*</span>}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Section: Existing device search (secondary) */}
            {customerId && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-500 border-b pb-1">
                  关联已有设备 <span className="text-gray-400 font-normal">(可选，通过序列号/昵称搜索添加)</span>
                </h4>

                {selectedDevices.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDevices.map(d => (
                      <span key={d.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                        <span className="font-medium">{d.id}</span>
                        {d.nickname && <span className="text-blue-500">({d.nickname})</span>}
                        <button type="button" onClick={() => removeExistingDevice(d.id)} className="text-blue-400 hover:text-red-500 ml-0.5">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div ref={searchRef} className="relative">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={deviceSearch}
                      onChange={e => handleSearchChange(e.target.value)}
                      onFocus={() => { if (deviceSearch.trim()) setShowSearchDropdown(true); }}
                      placeholder="输入序列号或昵称搜索已有设备..."
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      disabled={totalCount >= 5}
                    />
                    {searchLoading && <span className="absolute right-2.5 top-2.5 text-xs text-gray-400">搜索中...</span>}
                  </div>

                  {showSearchDropdown && deviceSearch.trim() && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.length === 0 && !searchLoading && (
                        <div className="px-3 py-2 text-xs text-gray-400 text-center">未找到匹配的设备</div>
                      )}
                      {searchResults.map(d => (
                        <div key={d.id} onClick={() => addExistingDevice(d)} className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-blue-50 border-b last:border-b-0">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {d.id}
                              {d.nickname && <span className="text-xs text-blue-600 ml-1.5">{d.nickname}</span>}
                            </div>
                            <div className="text-xs text-gray-400">
                              {d.product_line_name && <span>{d.product_line_name}</span>}
                              {d.product_name && <span> · {d.product_name}</span>}
                            </div>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${d.status === '正常' ? 'bg-green-100 text-green-700' : d.status === '异常' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-gray-500">
                {!isEdit && customerId && (
                  <>
                    新增 {newDeviceRows.length} 台 + 已有 {selectedDeviceIds.length} 台
                    = <span className={`font-semibold ${totalCount >= 2 && totalCount <= 5 ? 'text-blue-600' : 'text-red-600'}`}>{totalCount}</span> 台
                    <span className="text-gray-400 ml-1">（需 2-5 台）</span>
                  </>
                )}
                {isEdit && (<span>已选 {selectedDeviceIds.length} 台设备</span>)}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">取消</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? '保存中...' : (isEdit ? '保存修改' : '创建多合一设备')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}