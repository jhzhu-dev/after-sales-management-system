import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import ExportButton from '../components/ExportButton';
import DataTable, { Column } from '../components/DataTable';
import SearchableSelect, { SearchableSelectOption } from '../components/SearchableSelect';
import Select from '../components/Select';
import TestTaskForm from '../components/TestTaskForm';
import { testTaskApi, productApi } from '../services/api';
import { TestTask, TestTaskFormData, Product } from '../types';
import { getUrgencyColor } from '../utils';
import { exportToExcel } from '../utils/exportUtils';

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
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<TestTask | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [printAll, setPrintAll] = useState<TestTask[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

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
        page: 1,
        limit: 9999,
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
      setVisibleCount(20);
      setSelectedIds([]);
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
    { key: 'module_category', title: '模块分类', render: (v: any) => v || '-' },
    { key: 'model_version', title: '测试版本号', render: (v: any) => v || '-' },
    { key: 'priority', title: '紧急程度', render: (v: any) => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(v)}`}>{v}</span> },
    { key: 'shenzhen_requester_name', title: '深圳需求人', render: (v: any) => v || '-' },
    { key: 'shanghai_tester', title: '上海测试人', render: (v: any) => v || '-' },
    { key: 'status', title: '状态', render: (v: any) => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v] || 'text-gray-600 bg-gray-100'}`}>{v}</span> },
    { key: 'planned_completion_date', title: '计划完成', render: (v: any) => v || '-' },
  ];

  const EXPORT_COLUMNS = [
    { key: 'task_code', label: '任务编号' },
    { key: 'product_name', label: '产品' },
    { key: 'module_category', label: '模块分类' },
    { key: 'model_version', label: '测试版本号' },
    { key: 'priority', label: '紧急程度' },
    { key: 'shenzhen_requester_name', label: '深圳需求人' },
    { key: 'shanghai_tester', label: '上海测试人' },
    { key: 'status', label: '状态' },
    { key: 'planned_completion_date', label: '计划完成' },
  ];

  const handleExport = async (ids?: Array<string | number>) => {
    setExporting(true);
    try {
      const res = await testTaskApi.getList({
        page: 1, limit: 9999,
        product_id: filters.product_id || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        shanghai_tester: filters.shanghai_tester || undefined,
        planned_from: filters.planned_from || undefined,
        planned_to: filters.planned_to || undefined,
        search: filters.search || undefined,
      });
      let list = res.data || [];
      if (ids && ids.length) list = list.filter((t: any) => ids.includes(t.id));
      const rows = list.map((t: any) => ({
        ...t,
        planned_completion_date: t.planned_completion_date ? new Date(t.planned_completion_date).toLocaleDateString('zh-CN') : '',
      }));
      const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
      exportToExcel(rows, EXPORT_COLUMNS, `测试管理_${timestamp}`);
    } catch (e) {
      console.error('导出测试任务失败:', e);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async (ids?: Array<string | number>) => {
    try {
      const res = await testTaskApi.getList({
        page: 1, limit: 9999,
        product_id: filters.product_id || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        shanghai_tester: filters.shanghai_tester || undefined,
        planned_from: filters.planned_from || undefined,
        planned_to: filters.planned_to || undefined,
        search: filters.search || undefined,
      });
      let list = res.data || [];
      if (ids && ids.length) list = list.filter((t: any) => ids.includes(t.id));
      setPrintAll(list);
    } catch (e) {
      console.error('获取打印数据失败:', e);
      window.print();
    }
  };

  useEffect(() => {
    if (printAll !== null) {
      setTimeout(() => { window.print(); setPrintAll(null); }, 100);
    }
  }, [printAll]);

  return (
    <Layout>
      <div className="space-y-4 3xl:space-y-6">
        <div className="flex justify-between items-center h-10 no-print">
          <div>
            <h1 className="text-2xl 3xl:text-3xl font-bold text-gray-900">测试管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton onExport={handleExport} disabled={exporting} />
            <Button variant="outline" size="sm" onClick={() => handlePrint()}>
              <PrinterIcon className="h-4 w-4" /> 打印
            </Button>
            <Button onClick={openCreate}>
              <PlusIcon className="h-4 w-4" /> 新建任务单
            </Button>
          </div>
        </div>

        {successMsg && <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm no-print">{successMsg}</div>}

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md no-print">
            <span className="text-sm text-blue-800">已选 {selectedIds.length} 条</span>
            <Button size="sm" variant="outline" onClick={() => handleExport(selectedIds)} disabled={exporting}>导出选中</Button>
            <Button size="sm" variant="outline" onClick={() => handlePrint(selectedIds)}>打印选中</Button>
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-500 hover:text-gray-700">取消选择</button>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border shadow-soft p-2 relative z-20 no-print">
          <button
            type="button"
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center justify-between w-full px-2 py-1.5 text-sm font-medium text-gray-700 hover:text-primary-600"
          >
            <span>筛选</span>
            <span className="text-xs">{showFilters ? '▲ 收起' : '▼ 展开'}</span>
          </button>
          {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">产品</label>
            <SearchableSelect value={filters.product_id} onChange={v => setFilters(f => ({ ...f, product_id: v, page: 1 }))} options={productOptions} placeholder="全部产品" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">状态</label>
            <Select value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v, page: 1 }))} placeholder="全部" options={STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">优先级</label>
            <Select value={filters.priority} onChange={v => setFilters(f => ({ ...f, priority: v, page: 1 }))} placeholder="全部" options={PRIORITIES.map(p => ({ value: p, label: p }))} />
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
          )}
        </div>

        <DataTable
          data={data.slice(0, visibleCount)}
          columns={columns}
          loading={loading}
          rowKey="id"
          className="print:hidden"
          onRowClick={(r) => navigate(`/test-tasks/${r.id}`)}
          onLoadMore={visibleCount < data.length ? () => setVisibleCount(p => p + 20) : undefined}
          scrollable
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>

      {/* 打印专用页眉 */}
      <div className="hidden print:block print-header">
        <div className="flex items-center justify-between" style={{marginBottom: '3pt'}}>
          <span style={{fontSize: '8pt', color: '#6b7280'}}>售后登记系统</span>
          <span style={{fontSize: '8pt', color: '#6b7280'}}>打印时间：{new Date().toLocaleString('zh-CN')}</span>
        </div>
        <h1 style={{fontSize: '13pt', fontWeight: 'bold', margin: '0 0 3pt 0', color: '#111827'}}>测试管理</h1>
        <div className="print-flex-row" style={{marginTop: '2pt'}}>
          <span style={{fontSize: '8pt', color: '#6b7280'}}>共 {(printAll ?? data).length} 条记录</span>
        </div>
      </div>

      {/* 打印专用表格 */}
      <div className="hidden print:block">
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt'}}>
          <thead>
            <tr style={{borderBottom:'1pt solid #374151', backgroundColor:'#f9fafb'}}>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>任务编号</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>产品</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>模块分类</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>测试版本号</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>紧急程度</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>深圳需求人</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>上海测试人</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>状态</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>计划完成</th>
            </tr>
          </thead>
          <tbody>
            {(printAll ?? data).map((t, i) => (
              <tr key={t.id} style={{borderBottom:'0.5pt solid #e5e7eb', backgroundColor: i%2===0?'white':'#f9fafb'}}>
                <td style={{padding:'3pt 6pt'}}>{t.task_code || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{t.product_name || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{t.module_category || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{t.model_version || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{t.priority || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{t.shenzhen_requester_name || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{t.shanghai_tester || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{t.status || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{t.planned_completion_date ? new Date(t.planned_completion_date).toLocaleDateString('zh-CN') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <TestTaskForm testTask={editing} onClose={() => setShowForm(false)} onSubmit={handleSubmit} />}
    </Layout>
  );
};

export default TestTasks;
