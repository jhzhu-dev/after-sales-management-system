import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import DataTable, { Column } from '../components/DataTable';
import SearchableSelect, { SearchableSelectOption } from '../components/SearchableSelect';
import CustomerRequirementForm from '../components/CustomerRequirementForm';
import { customerRequirementApi, customerApi } from '../services/api';
import { CustomerRequirement, CustomerRequirementFormData, Customer } from '../types';
import { formatDate, getUrgencyColor, getRequirementTypeColor } from '../utils';

const REQ_TYPES = ['接口对接', '功能定制', '输出结果定制'];
const URGENCIES = ['低', '中', '高'];
const STATUSES = ['待评估', '评估中', '已评估待开发', '开发中', '已开发待测试', '测试中', '已测试待发布', '已发布', '废弃'];

const STATUS_COLORS: Record<string, string> = {
  '待评估': 'text-gray-600 bg-gray-100',
  '评估中': 'text-blue-600 bg-blue-100',
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
  const [editing, setEditing] = useState<CustomerRequirement | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

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
        page: filters.page,
        limit: filters.limit,
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
    } catch (e) {
      console.error('获取需求列表失败:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchList(); }, [fetchList]);

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

  return (
    <Layout>
      <div className="p-4 3xl:p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl 3xl:text-2xl font-bold text-gray-900">需求管理</h1>
            <p className="mt-1 text-sm text-gray-600">登记客户需求并跟踪评估到发布全流程</p>
          </div>
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> 新增需求
          </Button>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">{successMsg}</div>
        )}

        {/* 筛选区 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">客户</label>
            <SearchableSelect value={filters.customer_id} onChange={v => setFilters(f => ({ ...f, customer_id: v, page: 1 }))} options={customerOptions} placeholder="全部客户" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">分类</label>
            <select value={filters.requirement_type} onChange={e => setFilters(f => ({ ...f, requirement_type: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">全部</option>
              {REQ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">紧急程度</label>
            <select value={filters.urgency} onChange={e => setFilters(f => ({ ...f, urgency: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">全部</option>
              {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">状态</label>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))} className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">全部</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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

        {/* 列表 */}
        <DataTable
          data={data}
          columns={columns}
          loading={loading}
          rowKey="id"
          onRowClick={(r) => navigate(`/customer-requirements/${r.id}`)}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total,
            onChange: (page, pageSize) => setFilters(f => ({ ...f, page, limit: pageSize })),
          }}
        />
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
