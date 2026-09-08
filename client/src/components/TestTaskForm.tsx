import React, { useState, useEffect, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import { testTaskApi, productApi, feishuApi } from '../services/api';
import { Button } from '../components/ui/button';
import { TestTask, TestTaskFormData, Product, FeishuUser } from '../types';

interface TestTaskFormProps {
  testTask?: TestTask | null;
  onClose: () => void;
  onSubmit: (data: TestTaskFormData) => Promise<void>;
}

const PRIORITIES = ['低', '普通', '高', '紧急'];

const TestTaskForm: React.FC<TestTaskFormProps> = ({ testTask, onClose, onSubmit }) => {
  const isEdit = !!testTask?.id;

  const [form, setForm] = useState<TestTaskFormData>({
    product_id: 0,
    model_name: '',
    model_version: '',
    upgrade_content: '',
    model_features: '',
    test_focus: '',
    test_requirements: '',
    vehicle_requirements: '',
    test_scenarios: '',
    planned_completion_date: '',
    priority: '普通',
    shenzhen_requester: '',
    shenzhen_requester_name: '',
    shanghai_tester: '',
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [feishuUsers, setFeishuUsers] = useState<FeishuUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    productApi.getProducts().then(res => setProducts(res.data || [])).catch(e => console.error('加载产品失败:', e));
    feishuApi.getUsers().then(res => setFeishuUsers(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit || !testTask) return;
    setForm({
      product_id: testTask.product_id,
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

  const productOptions: SearchableSelectOption[] = useMemo(
    () => products.map(p => ({ id: String(p.id), name: `${p.name}${p.model ? ` (${p.model})` : ''}` })),
    [products]
  );

  const handleRequesterSelect = (value: string) => {
    if (!value) { setForm(f => ({ ...f, shenzhen_requester: '', shenzhen_requester_name: '' })); return; }
    const user = feishuUsers.find(u => u.open_id === value);
    setForm(f => ({ ...f, shenzhen_requester: value, shenzhen_requester_name: user?.name || '' }));
  };

  const set = (key: keyof TestTaskFormData, value: any) => setForm(f => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const ne: { [key: string]: string } = {};
    if (!form.product_id) ne.product_id = '请选择对应产品';
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
      await onSubmit({ ...form, product_id: Number(form.product_id) });
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
      <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{isEdit ? '编辑测试任务单' : '新建测试任务单'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><XMarkIcon className="h-6 w-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{serverError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>对应产品 <span className="text-red-500">*</span></label>
              <SearchableSelect value={form.product_id ? String(form.product_id) : ''} onChange={v => set('product_id', v ? Number(v) : 0)} options={productOptions} placeholder="请选择产品" />
              {errors.product_id && <p className="mt-1 text-xs text-red-500">{errors.product_id}</p>}
            </div>
            <div>
              <label className={labelCls}>优先级别 <span className="text-red-500">*</span></label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>模型名称</label>
              <input value={form.model_name} onChange={e => set('model_name', e.target.value)} className={inputCls} placeholder="待测模型名称" />
            </div>
            <div>
              <label className={labelCls}>模型版本号</label>
              <input value={form.model_version} onChange={e => set('model_version', e.target.value)} className={inputCls} placeholder="待测模型版本号（升级时用于定位产品版本）" />
            </div>
            <div>
              <label className={labelCls}>深圳需求人 <span className="text-red-500">*</span></label>
              {feishuUsers.length > 0 ? (
                <select
                  value={form.shenzhen_requester || ''}
                  onChange={e => handleRequesterSelect(e.target.value)}
                  className={inputCls}
                >
                  <option value="">选择需求人</option>
                  {feishuUsers.map(u => <option key={u.open_id} value={u.open_id}>{u.name}{u.department ? ` · ${u.department}` : ''}</option>)}
                </select>
              ) : (
                <input value={form.shenzhen_requester_name} onChange={e => set('shenzhen_requester_name', e.target.value)} className={inputCls} placeholder="请输入深圳需求人姓名" />
              )}
              {(feishuUsers.length > 0 && !form.shenzhen_requester_name) && (
                <input value={form.shenzhen_requester_name} onChange={e => set('shenzhen_requester_name', e.target.value)} className={`${inputCls} mt-2`} placeholder="或手动输入需求人姓名" />
              )}
              {errors.shenzhen_requester_name && <p className="mt-1 text-xs text-red-500">{errors.shenzhen_requester_name}</p>}
            </div>
            <div>
              <label className={labelCls}>上海测试人</label>
              <input value={form.shanghai_tester} onChange={e => set('shanghai_tester', e.target.value)} className={inputCls} placeholder="上海测试人（可空，流转时填写）" />
            </div>
            <div>
              <label className={labelCls}>计划完成时间</label>
              <input type="date" value={form.planned_completion_date} onChange={e => set('planned_completion_date', e.target.value)} className={inputCls} />
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
