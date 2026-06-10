import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  PaperClipIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import AttachmentViewer, { Attachment } from '../components/AttachmentViewer';
import { integrationApi, customerApi, deviceApi } from '../services/api';
import { Integration, IntegrationDevice, IntegrationLog, IntegrationStatus } from '../types';

const STATUS_COLORS: Record<IntegrationStatus, string> = {
  '洽谈中': 'bg-yellow-100 text-yellow-800',
  '对接中': 'bg-blue-100 text-blue-800',
  '已完成': 'bg-green-100 text-green-800',
  '暂停': 'bg-gray-100 text-gray-500',
};

const ALL_STATUSES: IntegrationStatus[] = ['洽谈中', '对接中', '已完成', '暂停'];

export default function IntegrationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const integrationId = Number(id);

  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);

  // 设备
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceResults, setDeviceResults] = useState<any[]>([]);
  const [devicePage, setDevicePage] = useState(1);
  const [deviceHasMore, setDeviceHasMore] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [addingDevice, setAddingDevice] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const deviceSearchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceDropdownRef = useRef<HTMLDivElement>(null);

  // 日志
  const [logContent, setLogContent] = useState('');
  const [logOperator, setLogOperator] = useState('');
  const [logAttachments, setLogAttachments] = useState<any[]>([]);
  const [uploadingLog, setUploadingLog] = useState(false);
  const [submittingLog, setSubmittingLog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewAtts, setPreviewAtts] = useState<Attachment[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await integrationApi.getOne(integrationId);
      if (res.success) {
        setIntegration(res.data);
        setEditForm({
          title: res.data.title,
          customer_id: res.data.customer_id || '',
          status: res.data.status,
          responsible_person: res.data.responsible_person || '',
          started_at: res.data.started_at?.slice(0, 10) || '',
          completed_at: res.data.completed_at?.slice(0, 10) || '',
          description: res.data.description || '',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  useEffect(() => {
    customerApi.getCustomers({}).then(res => {
      if (res.success) setCustomers(res.data || []);
    }).catch(() => {});
  }, []);

  // 点击外部关闭设备下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deviceSearchRef.current && !deviceSearchRef.current.contains(e.target as Node)) {
        setDeviceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDeviceResults = useCallback(async (search: string, page = 1, append = false) => {
    setDeviceLoading(true);
    try {
      const res = await deviceApi.getDevices({ limit: 8, page, search: search || undefined });
      if (res.success) {
        const items: any[] = res.data || [];
        setDeviceResults(prev => append ? [...prev, ...items] : items);
        setDevicePage(page);
        setDeviceHasMore(items.length === 8);
      }
    } finally {
      setDeviceLoading(false);
    }
  }, []);

  // 下拉列表滚动到底部时加载更多
  const handleDropdownScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60 && deviceHasMore && !deviceLoading) {
      fetchDeviceResults(deviceSearch, devicePage + 1, true);
    }
  }, [deviceHasMore, deviceLoading, deviceSearch, devicePage, fetchDeviceResults]);

  const handleDeviceSearchChange = (value: string) => {
    setDeviceSearch(value);
    setDeviceDropdownOpen(true);
    setDeviceResults([]);
    setDevicePage(1);
    setDeviceHasMore(false);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchDeviceResults(value, 1, false), 300);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        title: editForm.title,
        status: editForm.status,
        responsible_person: editForm.responsible_person || null,
        started_at: editForm.started_at || null,
        completed_at: editForm.completed_at || null,
        description: editForm.description || null,
      };
      if (editForm.customer_id) payload.customer_id = Number(editForm.customer_id);
      const res = await integrationApi.update(integrationId, payload);
      if (res.success) { setEditing(false); fetchDetail(); }
    } finally {
      setSaving(false);
    }
  };

  const handleAddDevice = async () => {
    setDeviceError('');
    if (!selectedDevice) return;
    setAddingDevice(true);
    try {
      const res = await integrationApi.addDevice(integrationId, selectedDevice.id);
      if (res.success) {
        setSelectedDevice(null);
        setDeviceSearch('');
        setDeviceResults([]);
        fetchDetail();
      } else {
        setDeviceError(res.message || '添加失败');
      }
    } catch (e: any) {
      setDeviceError(e?.response?.data?.message || '添加失败');
    } finally {
      setAddingDevice(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!window.confirm('确认从该对接项目中移除此设备？')) return;
    await integrationApi.removeDevice(integrationId, deviceId);
    fetchDetail();
  };

  const handleUploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploadingLog(true);
    try {
      const res = await integrationApi.uploadAttachment(files, integrationId);
      if (res.success) {
        setLogAttachments(prev => [...prev, ...res.data]);
      }
    } finally {
      setUploadingLog(false);
    }
  };

  const handleSubmitLog = async () => {
    if (!logContent.trim()) return;
    setSubmittingLog(true);
    try {
      const res = await integrationApi.addLog(integrationId, {
        content: logContent.trim(),
        operator: logOperator.trim() || undefined,
        attachments: logAttachments,
      });
      if (res.success) {
        setLogContent('');
        setLogOperator('');
        setLogAttachments([]);
        fetchDetail();
      }
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`确认删除「${integration?.title}」？删除后无法恢复，关联设备和跟进记录将一并删除。`)) return;
    setDeleting(true);
    try {
      const res = await integrationApi.delete(integrationId);
      if (res.success) navigate('/integrations');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-400">加载中...</div>
      </Layout>
    );
  }

  if (!integration) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-400">未找到该对接项目</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* 返回 + 标题行 */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/integrations')} className="text-gray-400 hover:text-gray-600">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{integration.title}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[integration.status]}`}>
                  {integration.status}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                {integration.customer_short_name || integration.customer_name || '未关联客户'}
                {integration.responsible_person && ` · 负责人：${integration.responsible_person}`}
              </p>
            </div>
          </div>
          {!editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" /> {deleting ? '删除中...' : '删除'}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <PencilSquareIcon className="h-4 w-4" /> 编辑
              </button>
            </div>
          )}
        </div>

        {/* 编辑表单 */}
        {editing && (
          <div className="bg-white rounded-xl border border-blue-200 p-5 mb-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">编辑基本信息</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">项目名称</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">客户</label>
                <select
                  value={editForm.customer_id}
                  onChange={e => setEditForm((f: any) => ({ ...f, customer_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">不指定</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.short_name || c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">状态</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">负责人</label>
                <input
                  type="text"
                  value={editForm.responsible_person}
                  onChange={e => setEditForm((f: any) => ({ ...f, responsible_person: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">开始日期</label>
                <input
                  type="date"
                  value={editForm.started_at}
                  onChange={e => setEditForm((f: any) => ({ ...f, started_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">完成日期</label>
                <input
                  type="date"
                  value={editForm.completed_at}
                  onChange={e => setEditForm((f: any) => ({ ...f, completed_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">描述</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <XMarkIcon className="h-4 w-4" /> 取消
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <CheckIcon className="h-4 w-4" /> {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {/* 基本信息卡片（非编辑态） */}
        {!editing && integration.description && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{integration.description}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
              {integration.started_at && <span>开始：{integration.started_at.slice(0, 10)}</span>}
              {integration.completed_at && <span>完成：{integration.completed_at.slice(0, 10)}</span>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 关联设备 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">关联设备 ({integration.devices?.length ?? 0})</h2>

              {/* 设备搜索 */}
              <div ref={deviceSearchRef} className="relative mb-3">
                {selectedDevice ? (
                  <div className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {selectedDevice.nickname || [selectedDevice.customer_name, selectedDevice.product_name].filter(Boolean).join(' · ') || selectedDevice.name}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        {[selectedDevice.name, selectedDevice.id, selectedDevice.remote_code].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <button
                        onClick={handleAddDevice}
                        disabled={addingDevice}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {addingDevice ? '添加中...' : '确认添加'}
                      </button>
                      <button
                        onClick={() => { setSelectedDevice(null); setDeviceSearch(''); }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center w-full px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 bg-white"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 flex-shrink-0 mr-2" />
                    <input
                      type="text"
                      value={deviceSearch}
                      onChange={e => handleDeviceSearchChange(e.target.value)}
                      onFocus={() => { setDeviceDropdownOpen(true); if (!deviceSearch && deviceResults.length === 0) fetchDeviceResults('', 1, false); }}
                      placeholder="搜索订单号、客户、序列号、远程码、简称..."
                      className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                    />
                    {deviceLoading && (
                      <svg className="animate-spin h-4 w-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                  </div>
                )}

                {/* 下拉结果 */}
                {deviceDropdownOpen && !selectedDevice && (
                  <div
                    ref={deviceDropdownRef}
                    onScroll={handleDropdownScroll}
                    className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-[560px] overflow-y-auto"
                  >
                    {deviceResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        {deviceLoading ? '搜索中...' : '未找到匹配设备'}
                      </div>
                    ) : deviceResults.map((device: any) => (
                      <button
                        key={device.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); setSelectedDevice(device); setDeviceDropdownOpen(false); setDeviceSearch(''); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900">
                            {device.nickname || [device.customer_name, device.product_name].filter(Boolean).join(' · ') || device.name}
                          </span>
                          {device.bundle_id && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex-shrink-0">多合一</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {[device.name, device.id, device.remote_code].filter(Boolean).join(' · ')}
                          {device.bundle_name && ` · 归属：${device.bundle_name}`}
                        </div>
                      </button>
                    ))}
                    {deviceResults.length > 0 && (
                      <div className="px-4 py-2 text-center text-xs text-gray-400">
                        {deviceLoading ? '加载中...' : deviceHasMore ? '向下滚动加载更多' : `共 ${deviceResults.length} 台设备`}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {deviceError && <p className="text-xs text-red-500 mb-2">{deviceError}</p>}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {!integration.devices?.length ? (
                  <p className="text-xs text-gray-400 text-center py-4">暂无关联设备</p>
                ) : integration.devices.map((d: IntegrationDevice) => (
                  <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-800">{d.nickname || d.id}</p>
                        {(d as any).bundle_id && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">多合一</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {d.id}{d.product_name ? ` · ${d.product_name}` : ''}
                        {(d as any).bundle_name ? ` · ${(d as any).bundle_name}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveDevice(d.id)}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 跟进日志 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">跟进记录 ({integration.logs?.length ?? 0})</h2>

              {/* 添加日志 */}
              <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50">
                <textarea
                  value={logContent}
                  onChange={e => setLogContent(e.target.value)}
                  rows={3}
                  placeholder="记录跟进内容..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                />
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={logOperator}
                    onChange={e => setLogOperator(e.target.value)}
                    placeholder="操作人（可选）"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLog}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white text-gray-600"
                  >
                    <PaperClipIcon className="h-4 w-4" />
                    {uploadingLog ? '上传中...' : '附件'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => {
                      if (e.target.files) handleUploadFiles(Array.from(e.target.files));
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={handleSubmitLog}
                    disabled={submittingLog || !logContent.trim()}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submittingLog ? '提交中...' : '提交'}
                  </button>
                </div>
                {logAttachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {logAttachments.map((a: any, i: number) => (
                      <span key={i} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        <PaperClipIcon className="h-3 w-3" />
                        {a.name}
                        <button onClick={() => setLogAttachments(prev => prev.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-500">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 日志列表 */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {!integration.logs?.length ? (
                  <p className="text-xs text-gray-400 text-center py-4">暂无跟进记录</p>
                ) : integration.logs.map((log: IntegrationLog) => (
                  <div key={log.id} className="border-l-2 border-blue-200 pl-3 py-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-600">{log.operator || '系统'}</span>
                      <span className="text-xs text-gray-400">{log.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.content}</p>
                    {log.attachments?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {log.attachments.map((a: any, i: number) => (
                          <button
                            key={i}
                            onClick={() => { setPreviewAtts(log.attachments as Attachment[]); setPreviewIdx(i); }}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <PaperClipIcon className="h-3 w-3" />
                            {a.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 附件预览 */}
      {previewAtts.length > 0 && (
        <AttachmentViewer
          attachments={previewAtts}
          initialIndex={previewIdx}
          onClose={() => setPreviewAtts([])}
        />
      )}
    </Layout>
  );
}
