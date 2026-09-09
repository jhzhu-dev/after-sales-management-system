import React, { useState, useEffect, useMemo, useRef } from 'react';
import { XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import Select from './Select';
import ButtonGroup from './ButtonGroup';
import { testTaskApi, productApi, feishuApi, customerApi, deviceApi, moduleTypeApi } from '../services/api';
import { Button } from '../components/ui/button';
import { TestTask, TestTaskFormData, Product, FeishuUser, Customer, Device } from '../types';
import { getUrgencyColor } from '../utils';

interface TestTaskFormProps {
  testTask?: TestTask | null;
  onClose: () => void;
  onSubmit: (data: TestTaskFormData) => Promise<void>;
}

const PRIORITIES = ['高', '中', '低'];

const TestTaskForm: React.FC<TestTaskFormProps> = ({ testTask, onClose, onSubmit }) => {
  const isEdit = !!testTask?.id;

  const [form, setForm] = useState<TestTaskFormData>({
    product_id: 0,
    target_type: 'product',
    product_ids: [],
    model_name: '',
    model_version: '',
    upgrade_content: '',
    model_features: '',
    test_focus: '',
    test_requirements: '',
    vehicle_requirements: '',
    test_scenarios: '',
    planned_completion_date: '',
    priority: '中',
    shenzhen_requester: '',
    shenzhen_requester_name: '',
    shanghai_tester: '',
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [feishuUsers, setFeishuUsers] = useState<FeishuUser[]>([]);
  const [moduleTypes, setModuleTypes] = useState<{ id: number; name: string }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [serverError, setServerError] = useState('');
  const [requesterOpen, setRequesterOpen] = useState(false);
  const requesterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (requesterRef.current && !requesterRef.current.contains(e.target as Node)) {
        setRequesterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    productApi.getProducts().then(res => setProducts(res.data || [])).catch(e => console.error('加载产品失败:', e));
    feishuApi.getUsers().then(res => setFeishuUsers(res.data || [])).catch(() => {});
    moduleTypeApi.getActiveModuleTypes().then(res => setModuleTypes(res.data || [])).catch(() => {});
    customerApi.getCustomers().then(res => setCustomers(res.data || [])).catch(() => {});
    setLoadingDevices(true);
    deviceApi.getDevices({ page: 1, limit: 1000 })
      .then(res => setDevices(res.data || []))
      .catch(e => console.error('加载设备失败:', e))
      .finally(() => setLoadingDevices(false));
  }, []);

  // 当前所选客户名下的产品ID集合（未选客户时为 null，表示全部产品）
  const ownedProductIds = useMemo<number[] | null>(() => {
    if (!selectedCustomerId) return null;
    return Array.from(new Set(
      devices
        .filter((d: any) => String(d.customer_id || '') === String(selectedCustomerId) && d.product_id)
        .map((d: any) => Number(d.product_id))
    ));
  }, [devices, selectedCustomerId]);

  // 产品型号候选：选了客户时仅展示该客户拥有的产品
  const visibleProducts = useMemo(() => {
    if (!ownedProductIds) return products;
    return products.filter(p => ownedProductIds.includes(p.id));
  }, [products, ownedProductIds]);

  // 具体产品候选：未选客户显示全部设备，选了客户仅显示该客户名下的设备
  const visibleDevices = useMemo(() => {
    const base = devices.filter((d: any) => d.product_id);
    if (!selectedCustomerId) return base;
    return base.filter((d: any) => String(d.customer_id || '') === String(selectedCustomerId));
  }, [devices, selectedCustomerId]);

  useEffect(() => {
    if (!isEdit || !testTask) return;
    setForm({
      product_id: testTask.product_id,
      target_type: testTask.target_type || 'product',
      product_ids: testTask.product_ids || [],
      model_name: testTask.model_name || '',
      model_version: testTask.model_version || '',
      upgrade_content: testTask.upgrade_content || '',
      model_features: testTask.model_features || '',
      test_focus: testTask.test_focus || '',
      test_requirements: testTask.test_requirements || '',
      vehicle_requirements: testTask.vehicle_requirements || '',
      test_scenarios: testTask.test_scenarios || '',
      planned_completion_date: testTask.planned_completion_date ? String(testTask.planned_completion_date).slice(0, 10) : '',
      priority: testTask.priority,
      shenzhen_requester: testTask.shenzhen_requester || '',
      shenzhen_requester_name: testTask.shenzhen_requester_name || '',
      shanghai_tester: testTask.shanghai_tester || '',
    });
  }, [isEdit, testTask]);

  const modelOptions: SearchableSelectOption[] = useMemo(() => {
    const seen = new Set<string>();
    const arr: SearchableSelectOption[] = [];
    visibleProducts.forEach(p => {
      if (p.model && !seen.has(p.model)) {
        seen.add(p.model);
        // 型号作为主显示，中文产品名作为辅助名称
        arr.push({ id: p.model, name: p.model, short_name: p.name });
      }
    });
    return arr;
  }, [visibleProducts]);

  const toggleProduct = (id: number) => {
    setForm(f => {
      const ids = f.product_ids || [];
      return { ...f, product_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] };
    });
  };

  const set = (key: keyof TestTaskFormData, value: any) => setForm(f => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const ne: { [key: string]: string } = {};
    if (form.target_type === 'model') {
      if (!form.model_name?.trim()) ne.product_id = '请选择对应产品型号';
    } else if (!form.product_ids || form.product_ids.length === 0) {
      ne.product_id = '请选择对应产品';
    }
    if (!form.shenzhen_requester_name.trim()) ne.shenzhen_requester_name = '请填写深圳需求人';
    if (!form.priority) ne.priority = '请选择优先级别';
    setErrors(ne);
    return Object.keys(ne).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError('');
    try {
      await onSubmit({
        ...form,
        product_id: form.target_type === 'product' ? (form.product_ids?.[0] || 0) : 0,
        product_ids: form.target_type === 'product' ? (form.product_ids || []) : [],
      });
      onClose();
    } catch (err: any) {
      setServerError(err?.response?.data?.error || '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-soft-lg w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">{isEdit ? '编辑测试任务单' : '新建测试任务单'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><XMarkIcon className="h-6 w-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{serverError}</div>}

          {/* 客户筛选：选择后仅展示该客户拥有的产品/型号 */}
          <div>
            <label className={labelCls}>客户</label>
            <SearchableSelect
              value={selectedCustomerId}
              onChange={v => setSelectedCustomerId(v)}
              options={customers.map(c => ({ id: String(c.id), name: c.name, short_name: c.short_name }))}
              placeholder="全部客户"
              searchPlaceholder="搜索客户名称或简称"
            />
            {selectedCustomerId && (
              <div className="mt-1 flex items-center gap-3">
                <p className="text-xs text-gray-400">
                  {loadingDevices ? '正在加载该客户设备...' : `已按客户筛选，仅显示该客户名下的 ${visibleDevices.length} 台设备`}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId('')}
                  className="text-xs text-primary-600 hover:text-primary-700 underline"
                >
                  清除筛选
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:row-span-2">
              <label className={labelCls}>对应产品 <span className="text-red-500">*</span></label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => set('target_type', 'model')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${form.target_type === 'model' ? 'bg-primary-500 text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-600'}`}
                >产品型号</button>
                <button
                  type="button"
                  onClick={() => set('target_type', 'product')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${form.target_type === 'product' ? 'bg-primary-500 text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-600'}`}
                >具体产品</button>
              </div>
              {form.target_type === 'model' ? (
                <SearchableSelect value={form.model_name || ''} onChange={v => set('model_name', v)} options={modelOptions} placeholder="请选择产品型号" />
              ) : (
                <div className="border border-gray-300 rounded-md max-h-44 overflow-y-auto p-2 space-y-1">
                  {visibleDevices.map(d => (
                    <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={(form.product_ids || []).includes(d.product_id as number)} onChange={() => toggleProduct(d.product_id as number)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40" />
                      <span className="text-gray-700 truncate" title={`${d.device_code || ''} ${d.nickname || ''}`}>
                        {d.nickname ? `${d.device_code ? d.device_code + ' - ' : ''}${d.nickname}` : (d.device_code || '无简称')}
                      </span>
                    </label>
                  ))}
                  {visibleDevices.length === 0 && <div className="text-xs text-gray-400 py-2">{selectedCustomerId ? (loadingDevices ? '加载该客户设备中...' : '该客户暂无设备') : (loadingDevices ? '加载设备中...' : '暂无设备')}</div>}
                </div>
              )}
              {errors.product_id && <p className="mt-1 text-xs text-red-500">{errors.product_id}</p>}
            </div>
            <div>
              <label className={labelCls}>紧急程度 <span className="text-red-500">*</span></label>
              <ButtonGroup
                value={form.priority}
                onChange={v => set('priority', v)}
                options={PRIORITIES.map(p => ({ value: p, label: p }))}
                colorClass={getUrgencyColor}
              />
            </div>
            <div>
              <label className={labelCls}>计划完成时间</label>
              <input type="date" value={form.planned_completion_date} onChange={e => set('planned_completion_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>模块分类</label>
              <Select
                value={form.model_name || ''}
                onChange={v => set('model_name', v)}
                placeholder="请选择模块分类"
                options={[{ value: '', label: '请选择模块分类' }, ...moduleTypes.map(m => ({ value: m.name, label: m.name }))]}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>测试版本号</label>
              <input value={form.model_version} onChange={e => set('model_version', e.target.value)} className={inputCls} placeholder="填写程序或模型版本号（升级时用于定位产品版本）" />
            </div>
            <div>
              <label className={labelCls}>深圳需求人 <span className="text-red-500">*</span></label>
              <div className="relative" ref={requesterRef}>
                <input
                  type="text"
                  value={form.shenzhen_requester_name}
                  onChange={e => {
                    const name = e.target.value;
                    const user = feishuUsers.find(u => u.name === name);
                    setForm(f => ({ ...f, shenzhen_requester_name: name, shenzhen_requester: user?.open_id || '' }));
                  }}
                  className={inputCls}
                  placeholder="选择或输入需求人姓名"
                />
                {feishuUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRequesterOpen(o => !o)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                )}
                {requesterOpen && feishuUsers.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
                    <div className="max-h-56 overflow-y-auto no-scrollbar">
                      {feishuUsers.map(u => (
                        <button
                          key={u.open_id}
                          type="button"
                          onClick={() => { setForm(f => ({ ...f, shenzhen_requester: u.open_id, shenzhen_requester_name: u.name })); setRequesterOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-foreground"
                        >
                          {u.name}{u.department ? ` · ${u.department}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {errors.shenzhen_requester_name && <p className="mt-1 text-xs text-red-500">{errors.shenzhen_requester_name}</p>}
            </div>
            <div>
              <label className={labelCls}>上海测试人</label>
              <input value={form.shanghai_tester} onChange={e => set('shanghai_tester', e.target.value)} className={inputCls} placeholder="上海测试人（可空，流转时填写）" />
            </div>
          </div>

          {[
            { key: 'upgrade_content', label: '升级内容' },
            { key: 'model_features', label: '模型特点' },
            { key: 'test_focus', label: '测试要点' },
            { key: 'test_requirements', label: '测试要求' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <textarea value={form[key as keyof TestTaskFormData] as string} onChange={e => set(key as keyof TestTaskFormData, e.target.value)} rows={2} className={inputCls} />
            </div>
          ))}

          <div>
            <label className={labelCls}>车型要求</label>
            <input value={form.vehicle_requirements} onChange={e => set('vehicle_requirements', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>测试场景</label>
            <textarea value={form.test_scenarios} onChange={e => set('test_scenarios', e.target.value)} rows={2} className={inputCls} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={submitting}>{submitting ? '提交中...' : '保存'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TestTaskForm;
