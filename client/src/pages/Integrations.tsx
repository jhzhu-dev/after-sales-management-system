import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { integrationApi, customerApi } from '../services/api';
import { Integration, IntegrationStatus } from '../types';

const STATUS_COLORS: Record<IntegrationStatus, string> = {
  '洽谈中': 'bg-yellow-100 text-yellow-800',
  '对接中': 'bg-blue-100 text-blue-800',
  '已完成': 'bg-green-100 text-green-800',
  '暂停': 'bg-gray-100 text-gray-500',
};

const ALL_STATUSES: IntegrationStatus[] = ['洽谈中', '对接中', '已完成', '暂停'];

export default function Integrations() {
  const navigate = useNavigate();
  const [list, setList] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [filterCustomer, setFilterCustomer] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', customer_id: '', status: '洽谈中' as IntegrationStatus, responsible_person: '', description: '' });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await integrationApi.getList({
        status: filterStatus || undefined,
        customer_id: filterCustomer ? Number(filterCustomer) : undefined,
        search: search || undefined,
      });
      if (res.success) setList(res.data);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterCustomer]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    customerApi.getCustomers({}).then(res => {
      if (res.success) setCustomers(res.data || []);
    }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await integrationApi.create({
        title: form.title.trim(),
        customer_id: form.customer_id ? Number(form.customer_id) : undefined,
        status: form.status,
        responsible_person: form.responsible_person.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      if (res.success) {
        setShowCreateModal(false);
        setForm({ title: '', customer_id: '', status: '洽谈中', responsible_person: '', description: '' });
        navigate(`/integrations/${res.data.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">系统对接</h1>
            <p className="text-sm text-gray-500 mt-1">管理客户系统与设备的软件/接口对接项目</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <PlusIcon className="h-4 w-4" />
            新建对接
          </button>
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索项目名称/负责人/客户..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterCustomer}
            onChange={e => setFilterCustomer(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部客户</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.short_name || c.name}</option>)}
          </select>
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">加载中...</div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-gray-400">暂无对接记录</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目名称</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">负责人</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">关联设备</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">跟进记录</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">更新时间</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/integrations/${item.id}`)}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-blue-600">{item.title}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{item.customer_short_name || item.customer_name || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{item.responsible_person || '-'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{item.device_count ?? 0} 台</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{item.log_count ?? 0} 条</td>
                    <td className="px-5 py-3 text-sm text-gray-400">{item.updated_at?.slice(0, 10)}</td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`确认删除「${item.title}」？`)) return;
                          await integrationApi.delete(item.id);
                          fetchList();
                        }}
                        className="p-1.5 text-gray-300 hover:text-red-500 rounded hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 新建弹窗 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">新建系统对接</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">项目名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="如：XX客户 POS 系统对接"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客户</label>
                  <select
                    value={form.customer_id}
                    onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">不指定</option>
                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.short_name || c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">负责人</label>
                  <input
                    type="text"
                    value={form.responsible_person}
                    onChange={e => setForm(f => ({ ...f, responsible_person: e.target.value }))}
                    placeholder="负责人姓名"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">初始状态</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as IntegrationStatus }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="对接背景、目标等..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >取消</button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !form.title.trim()}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
