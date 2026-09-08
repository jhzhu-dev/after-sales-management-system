import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import DataTable, { Column } from '../components/DataTable';
import SearchableSelect, { SearchableSelectOption } from '../components/SearchableSelect';
import TestTaskForm from '../components/TestTaskForm';
import { testTaskApi, productApi } from '../services/api';
import { TestTask, TestTaskFormData, Product } from '../types';
import { getUrgencyColor } from '../utils';

const PRIORITIES = ['高', '中', '低'];
const STATUSES = ['测试中', '已测试', '通过', '不通过'];

const STATUS_COLORS: Record<string, string> = {
  '测试中': 'text-blue-600 bg-blue-100',
  '已测试': 'text-orange-600 bg-orange-100',
  '通过': 'text-green-600 bg-green-100',
  '不通过': 'text-red-600 bg-red-100',
};

const TestTasks: React.FC = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<TestTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TestTask | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    product_id: '',
    status: '',
    priority: '',
    shanghai_tester: '',
    planned_from: '',
    planned_to: '',
    search: '',
  });

  const productOptions: SearchableSelectOption[] = useMemo(
    () => products.map(p => ({ id: String(p.id), name: `${p.name}${p.model ? ` (${p.model})` : ''}` })),
    [products]
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await testTaskApi.getList({
        page: filters.page,
        limit: filters.limit,
        product_id: filters.product_id || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        shanghai_tester: filters.shanghai_tester || undefined,
        planned_from: filters.planned_from || undefined,
        planned_to: filters.planned_to || undefined,
        search: filters.search || undefined,
      });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error('获取测试任务列表失败:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    productApi.getProducts().then(res => setProducts(res.data || [])).catch(() => {});
  }, []);

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (t: TestTask) => { setEditing(t); setShowForm(true); };

  const handleSubmit = async (formData: TestTaskFormData) => {
    if (editing) {
      await testTaskApi.update(editing.id, formData);
    } else {
      const res = await testTaskApi.create(formData);
      if (!res.success) throw new Error(res.error);
    }
    setSuccessMsg(editing ? '任务单更新成功' : '任务单创建成功');
    setTimeout(() => setSuccessMsg(''), 3000);
    fetchList();
  };

  const columns: Column<TestTask>[] = [
    { key: 'task_code', title: '任务编号', width: '130px' },
    { key: 'product_name', title: '产品', render: (v: any, r: TestTask) => v || '-' },
    { key: 'model_name', title: '模型名称', render: (v: any) => v || '-' },
    { key: 'model_version', title: '版本号', render: (v: any) => v || '-' },
    { key: 'priority', title: '紧急程度', render: (v: any) => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(v)}`}>{v}</span> },
    { key: 'shenzhen_requester_name', title: '深圳需求人', render: (v: any) => v || '-' },
    { key: 'shanghai_tester', title: '上海测试人', render: (v: any) => v || '-' },
    { key: 'status', title: '状态', render: (v: any) => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v] || 'text-gray-600 bg-gray-100'}`}>{v}</span> },
    { key: 'planned_completion_date', title: '计划完成', render: (v: any) => v || '-' },
  ];

  return (
    <Layout>
      <div className="p-4 3xl:p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl 3xl:text-2xl font-bold text-gray-900">测试管理</h1>
            <p className="mt-1 text-sm text-gray-600">跨区域模型测试任务单管理</p>
          </div>
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> 新建任务单
          </Button>
        </div>

        {successMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">{successMsg}</div>}

        <div className="bg-card rounded-2xl border border-border shadow-soft p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 relative z-20">
          <div>
            <label className="block text-xs text-gray-500 mb-1">产品</label>
            <SearchableSelect value={filters.product_id} onChange={v => setFilters(f => ({ ...f, product_id: v, page: 1 }))} options={productOptions} placeholder="全部产品" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">状态</label>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">全部</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">优先级</label>
            <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">全部</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">上海测试人</label>
            <input value={filters.shanghai_tester} onChange={e => setFilters(f => ({ ...f, shanghai_tester: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">计划完成起</label>
            <input type="date" value={filters.planned_from} onChange={e => setFilters(f => ({ ...f, planned_from: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">计划完成止</label>
            <input type="date" value={filters.planned_to} onChange={e => setFilters(f => ({ ...f, planned_to: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">关键字</label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
              <input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))} placeholder="任务编号 / 模型 / 需求人" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
            </div>
          </div>
        </div>

        <DataTable
          data={data}
          columns={columns}
          loading={loading}
          rowKey="id"
          onRowClick={(r) => navigate(`/test-tasks/${r.id}`)}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total,
            onChange: (page, pageSize) => setFilters(f => ({ ...f, page, limit: pageSize })),
          }}
        />
      </div>

      {showForm && <TestTaskForm testTask={editing} onClose={() => setShowForm(false)} onSubmit={handleSubmit} />}
    </Layout>
  );
};

export default TestTasks;
