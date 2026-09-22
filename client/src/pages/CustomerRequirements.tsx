import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import ExportButton from '../components/ExportButton';
import DataTable, { Column } from '../components/DataTable';
import SearchableSelect, { SearchableSelectOption } from '../components/SearchableSelect';
import Select from '../components/Select';
import CustomerRequirementForm from '../components/CustomerRequirementForm';
import { customerRequirementApi, customerApi } from '../services/api';
import { CustomerRequirement, CustomerRequirementFormData, Customer } from '../types';
import { formatDate, getUrgencyColor, getRequirementTypeColor } from '../utils';
import { exportToExcel } from '../utils/exportUtils';

const REQ_TYPES = ['接口对接', '功能定制', '输出结果定制'];
const URGENCIES = ['高', '中', '低'];
const STATUSES = ['需求收集', '待评估', '已评估待开发', '开发中', '已开发待测试', '测试中', '已测试待发布', '已发布', '废弃'];

const STATUS_COLORS: Record<string, string> = {
  '需求收集': 'text-teal-600 bg-teal-100',
  '待评估': 'text-gray-600 bg-gray-100',
  '已评估待开发': 'text-indigo-600 bg-indigo-100',
  '开发中': 'text-purple-600 bg-purple-100',
  '已开发待测试': 'text-cyan-600 bg-cyan-100',
  '测试中': 'text-orange-600 bg-orange-100',
  '已测试待发布': 'text-yellow-600 bg-yellow-100',
  '已发布': 'text-green-600 bg-green-100',
  '废弃': 'text-red-600 bg-red-100',
};

const CustomerRequirements: React.FC = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<CustomerRequirement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<CustomerRequirement | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [printAll, setPrintAll] = useState<CustomerRequirement[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  // 需求分类筛选选项：基础分类 + 历史使用过的自定义分类
  const [typeOptions, setTypeOptions] = useState<string[]>([...REQ_TYPES]);

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    customer_id: '',
    requirement_type: '',
    urgency: '',
    status: '',
    proposed_date_from: '',
    proposed_date_to: '',
    search: '',
  });

  const customerOptions: SearchableSelectOption[] = useMemo(
    () => customers.map(c => ({ id: String(c.id), name: c.name, short_name: c.short_name })),
    [customers]
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customerRequirementApi.getList({
        page: 1,
        limit: 9999,
        customer_id: filters.customer_id || undefined,
        requirement_type: filters.requirement_type || undefined,
        urgency: filters.urgency || undefined,
        status: filters.status || undefined,
        proposed_date_from: filters.proposed_date_from || undefined,
        proposed_date_to: filters.proposed_date_to || undefined,
        search: filters.search || undefined,
      });
      setData(res.data || []);
      setTotal(res.total || 0);
      setVisibleCount(20);
      setSelectedIds([]);
    } catch (e) {
      console.error('获取需求列表失败:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const loadTypeOptions = useCallback(async () => {
    try {
      const res = await customerRequirementApi.getCategories();
      const history = ((res.data || []) as Array<{ name: string }>).map(c => c.name).filter(Boolean);
      setTypeOptions(Array.from(new Set([...REQ_TYPES, ...history])));
    } catch { /* 加载失败时保留基础分类 */ }
  }, []);

  useEffect(() => { loadTypeOptions(); }, [loadTypeOptions]);

  useEffect(() => {
    customerApi.getCustomers({ search: '' }).then(res => setCustomers(res.data || [])).catch(() => {});
  }, []);

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (r: CustomerRequirement) => { setEditing(r); setShowForm(true); };

  const handleSubmit = async (data: CustomerRequirementFormData) => {
    if (editing) {
      const res = await customerRequirementApi.update(editing.id, data);
      if (!res.success) throw new Error(res.error);
    } else {
      const res = await customerRequirementApi.create(data);
      if (!res.success) throw new Error(res.error);
    }
    setSuccessMsg(editing ? '需求更新成功' : '需求登记成功');
    setTimeout(() => setSuccessMsg(''), 3000);
    fetchList();
    loadTypeOptions();
  };

  const renderStatusBadge = (status: string) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'text-gray-600 bg-gray-100'}`}>
      {status}
    </span>
  );

  const renderTypeBadge = (type: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRequirementTypeColor(type)}`}>
      {type}
    </span>
  );

  const renderUrgencyBadge = (urgency: string) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(urgency)}`}>
      {urgency}
    </span>
  );

  const columns: Column<CustomerRequirement>[] = [
    { key: 'req_code', title: '需求编号', width: '140px' },
    { key: 'customer_name', title: '客户' },
    { key: 'device_names', title: '涉及设备', render: (v: any) => v || '-' },
    { key: 'requirement_type', title: '分类', render: (v: any) => renderTypeBadge(v) },
    { key: 'urgency', title: '紧急程度', render: (v: any) => renderUrgencyBadge(v) },
    { key: 'status', title: '状态', render: (v: any) => renderStatusBadge(v) },
    { key: 'proposed_date', title: '提出日期' },
    { key: 'publish_version', title: '发布版本', render: (v: any) => v || '-' },
    { key: 'updated_at', title: '更新时间', render: (v: any) => formatDate(v, 'yyyy-MM-dd HH:mm') },
  ];

  const EXPORT_COLUMNS = [
    { key: 'req_code', label: '需求编号' },
    { key: 'customer_name', label: '客户' },
    { key: 'device_names', label: '涉及设备' },
    { key: 'requirement_type', label: '分类' },
    { key: 'urgency', label: '紧急程度' },
    { key: 'status', label: '状态' },
    { key: 'proposed_date', label: '提出日期' },
    { key: 'publish_version', label: '发布版本' },
    { key: 'updated_at', label: '更新时间' },
  ];

  const handleExport = async (ids?: Array<string | number>) => {
    setExporting(true);
    try {
      const res = await customerRequirementApi.getList({
        page: 1, limit: 9999,
        customer_id: filters.customer_id || undefined,
        requirement_type: filters.requirement_type || undefined,
        urgency: filters.urgency || undefined,
        status: filters.status || undefined,
        proposed_date_from: filters.proposed_date_from || undefined,
        proposed_date_to: filters.proposed_date_to || undefined,
        search: filters.search || undefined,
      });
      let list = res.data || [];
      if (ids && ids.length) list = list.filter((r: any) => ids.includes(r.id));
      const rows = list.map((r: any) => ({
        ...r,
        proposed_date: r.proposed_date ? new Date(r.proposed_date).toLocaleDateString('zh-CN') : '',
        updated_at: r.updated_at ? new Date(r.updated_at).toLocaleString('zh-CN') : '',
      }));
      const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
      exportToExcel(rows, EXPORT_COLUMNS, `需求管理_${timestamp}`);
    } catch (e) {
      console.error('导出需求失败:', e);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async (ids?: Array<string | number>) => {
    try {
      const res = await customerRequirementApi.getList({
        page: 1, limit: 9999,
        customer_id: filters.customer_id || undefined,
        requirement_type: filters.requirement_type || undefined,
        urgency: filters.urgency || undefined,
        status: filters.status || undefined,
        proposed_date_from: filters.proposed_date_from || undefined,
        proposed_date_to: filters.proposed_date_to || undefined,
        search: filters.search || undefined,
      });
      let list = res.data || [];
      if (ids && ids.length) list = list.filter((r: any) => ids.includes(r.id));
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
      {/* 固定视口高度 flex 布局：列表底边与侧边栏底边对齐（同设备管理页模式） */}
      <div className="flex flex-col gap-4 3xl:gap-6 h-[calc(100vh-15px-1rem)] 3xl:h-[calc(100vh-15px-1.5rem)] print:h-auto">
        <div className="flex justify-between items-center h-10 no-print shrink-0">
          <div>
            <h1 className="text-2xl 3xl:text-3xl font-bold text-gray-900">需求管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton onExport={handleExport} disabled={exporting} />
            <Button variant="outline" size="sm" onClick={() => handlePrint()}>
              <PrinterIcon className="h-4 w-4" /> 打印
            </Button>
            <Button onClick={openCreate}>
              <PlusIcon className="h-4 w-4" /> 新增需求
            </Button>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm no-print shrink-0">{successMsg}</div>
        )}

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md no-print shrink-0">
            <span className="text-sm text-blue-800">已选 {selectedIds.length} 条</span>
            <Button size="sm" variant="outline" onClick={() => handleExport(selectedIds)} disabled={exporting}>导出选中</Button>
            <Button size="sm" variant="outline" onClick={() => handlePrint(selectedIds)}>打印选中</Button>
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-500 hover:text-gray-700">取消选择</button>
          </div>
        )}

        {/* 筛选区 */}
        <div className="bg-card rounded-2xl border border-border shadow-soft p-2 relative z-20 no-print shrink-0">
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
            <label className="block text-xs text-gray-500 mb-1">客户</label>
            <SearchableSelect value={filters.customer_id} onChange={v => setFilters(f => ({ ...f, customer_id: v, page: 1 }))} options={customerOptions} placeholder="全部客户" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">分类</label>
            <Select value={filters.requirement_type} onChange={v => setFilters(f => ({ ...f, requirement_type: v, page: 1 }))} placeholder="全部" options={typeOptions.map(t => ({ value: t, label: t }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">紧急程度</label>
            <Select value={filters.urgency} onChange={v => setFilters(f => ({ ...f, urgency: v, page: 1 }))} placeholder="全部" options={URGENCIES.map(u => ({ value: u, label: u }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">状态</label>
            <Select value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v, page: 1 }))} placeholder="全部" options={STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">提出日期起</label>
            <input type="date" value={filters.proposed_date_from} onChange={e => setFilters(f => ({ ...f, proposed_date_from: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">提出日期止</label>
            <input type="date" value={filters.proposed_date_to} onChange={e => setFilters(f => ({ ...f, proposed_date_to: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">关键字</label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                placeholder="需求编号 / 描述 / 客户"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>
          </div>
          )}
        </div>

        {/* 列表 */}
        <DataTable
          data={data.slice(0, visibleCount)}
          columns={columns}
          loading={loading}
          rowKey="id"
          className="print:hidden"
          onRowClick={(r) => navigate(`/customer-requirements/${r.id}`)}
          onLoadMore={visibleCount < data.length ? () => setVisibleCount(p => p + 20) : undefined}
          scrollable
          fill
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
        <h1 style={{fontSize: '13pt', fontWeight: 'bold', margin: '0 0 3pt 0', color: '#111827'}}>需求管理</h1>
        <div className="print-flex-row" style={{marginTop: '2pt'}}>
          <span style={{fontSize: '8pt', color: '#6b7280'}}>共 {(printAll ?? data).length} 条记录</span>
        </div>
      </div>

      {/* 打印专用表格 */}
      <div className="hidden print:block">
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt'}}>
          <thead>
            <tr style={{borderBottom:'1pt solid #374151', backgroundColor:'#f9fafb'}}>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>需求编号</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>客户</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>涉及设备</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>分类</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>紧急程度</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>状态</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>提出日期</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>发布版本</th>
              <th style={{padding:'4pt 6pt', textAlign:'left', fontWeight:'600'}}>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {(printAll ?? data).map((r, i) => (
              <tr key={r.id} style={{borderBottom:'0.5pt solid #e5e7eb', backgroundColor: i%2===0?'white':'#f9fafb'}}>
                <td style={{padding:'3pt 6pt'}}>{r.req_code || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{r.customer_name || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{r.device_names || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{r.requirement_type || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{r.urgency || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{r.status || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{r.proposed_date ? new Date(r.proposed_date).toLocaleDateString('zh-CN') : '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{r.publish_version || '-'}</td>
                <td style={{padding:'3pt 6pt'}}>{r.updated_at ? new Date(r.updated_at).toLocaleString('zh-CN') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CustomerRequirementForm
          requirement={editing}
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
        />
      )}
    </Layout>
  );
};

export default CustomerRequirements;
