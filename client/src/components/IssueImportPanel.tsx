import React, { useState, useEffect } from 'react';
import { ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/ui/button';
import { issueImportApi, deviceApi } from '../services/api';

interface PreviewRow {
  rowIndex: number;
  feedback_time: string | null;
  feedback_no: string;
  type: string;
  customer: string;
  region: string;
  device_type: string;
  device_code: string;
  severity: string;
  occurrence: string;
  description: string;
  assignee: string;
  status: string;
  category: string;
  note: string;
  is_first_occurrence: boolean;
  device_id: string | null;
  device_name: string;
  errors: string[];
}

interface IssueImportPanelProps {
  onClose: () => void;
  onDone?: () => void;
}

const SEVERITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];
const STATUS_OPTIONS = [
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'closed', label: '已解决' },
];
const CATEGORY_OPTIONS = ['硬件故障', '软件Bug', '操作咨询', '安装调试', '其他'].map(c => ({ value: c, label: c }));

const IssueImportPanel: React.FC<IssueImportPanelProps> = ({ onClose, onDone }) => {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  // 设备列表，用于手动编辑设备编码时重新解析
  const [deviceList, setDeviceList] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await deviceApi.getDevices({ page: 1, limit: 1000 });
        if (res.success) setDeviceList(res.data || []);
      } catch (_) {
        // 忽略，设备解析失败时靠手动填写
      }
    };
    load();
  }, []);

  const resolveDevice = (code: string): { id: string | null; name: string } => {
    const c = (code || '').trim().toLowerCase();
    if (!c) return { id: null, name: '' };
    const byCode = deviceList.find(d => String(d.device_code || '').trim().toLowerCase() === c);
    if (byCode) return { id: byCode.id, name: byCode.name || byCode.id };
    const byId = deviceList.find(d => String(d.id || '').trim().toLowerCase() === c);
    if (byId) return { id: byId.id, name: byId.name || byId.id };
    return { id: null, name: '' };
  };

  const setCell = (rowIndex: number, patch: Partial<PreviewRow>) => {
    setRows(prev => prev.map(r => (r.rowIndex === rowIndex ? { ...r, ...patch } : r)));
  };

  const setDeviceCode = (rowIndex: number, code: string) => {
    const dev = resolveDevice(code);
    setRows(prev => prev.map(r => r.rowIndex === rowIndex ? { ...r, device_code: code, device_id: dev.id, device_name: dev.name } : r));
  };

  // 是否填写完成：问题描述非空 且 解析到设备
  const isComplete = (r: PreviewRow) => !!r.description?.trim() && !!r.device_id;
  const importableRows = rows.filter(isComplete);
  const importableCount = importableRows.length;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await issueImportApi.preview(file);
      if (res.success && res.data) {
        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
      } else {
        setError(res.error || '解析失败');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || '解析失败，请确认是反馈单模板');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const validRows = rows.filter(isComplete);
    if (validRows.length === 0) return;
    setSubmitting(true);
    setError('');
    setMsg('');
    try {
      const res = await issueImportApi.confirm(validRows);
      if (res.success) {
        setMsg(`成功导入 ${res.data?.imported} 条问题${res.data?.failed ? `，${res.data.failed} 条失败` : ''}`);
        setTimeout(() => { onDone?.(); onClose(); }, 1200);
      } else {
        setError(res.error || '导入失败');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'hidden';
  const cellInputCls = 'w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 bg-white';
  const cellSelectCls = 'w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 bg-white';

  return (
    <div className="space-y-4">
        <div>
          {/* 上传区 */}
          <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden mb-4">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">上传反馈单</h3>
              <label className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                {loading ? '解析中...' : rows.length > 0 ? '重新选择' : '选择 Excel'}
                <input type="file" accept=".xlsx,.xls" className={inputCls} onChange={handleFile} disabled={loading} />
              </label>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500">上传《反馈单模板.xlsx》，自动识别反馈时间、设备编码、严重程度、问题状态与分类。识别后可在表格中手动修改，填写完整即可导入。</p>
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-start gap-2">
                  <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" /> {error}
                </div>
              )}
              {msg && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 flex-shrink-0" /> {msg}
                </div>
              )}
              {rows.length > 0 && (
                <div className="mt-3 text-sm text-gray-600">
                  共 {total} 条，可导入 <span className="font-semibold text-green-600">{importableCount}</span> 条
                  {importableCount < total && <span className="text-orange-600">，{total - importableCount} 条需补充完整（问题描述+设备）</span>}
                </div>
              )}
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">行号</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">反馈时间</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">反馈单号</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">设备编码</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">设备</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">紧急度</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">状态</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">问题描述</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">责任人</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">分类</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">校验</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => {
                        const complete = isComplete(r);
                        return (
                          <tr key={r.rowIndex} className={complete ? '' : 'bg-orange-50/40'}>
                            <td className="px-3 py-2 text-xs text-gray-500">{r.rowIndex}</td>
                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                              <input type="text" value={r.feedback_time || ''} onChange={e => setCell(r.rowIndex, { feedback_time: e.target.value })} className={cellInputCls} />
                            </td>
                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                              <input type="text" value={r.feedback_no || ''} onChange={e => setCell(r.rowIndex, { feedback_no: e.target.value })} className={cellInputCls} />
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <div className="relative">
                                <input type="text" value={r.device_code || ''} onChange={e => setDeviceCode(r.rowIndex, e.target.value)} className={`${cellInputCls} pr-6`} placeholder="输入编码/序列号" />
                                <MagnifyingGlassIcon className="h-3 w-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {r.device_id ? (
                                <span className="text-green-600">{r.device_name || r.device_id}</span>
                              ) : (
                                <span className="text-red-500" title="未匹配到设备">未匹配</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <select value={r.severity} onChange={e => setCell(r.rowIndex, { severity: e.target.value })} className={cellSelectCls}>
                                {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <select value={r.status} onChange={e => setCell(r.rowIndex, { status: e.target.value })} className={cellSelectCls}>
                                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-xs min-w-[220px]">
                              <textarea value={r.description || ''} onChange={e => setCell(r.rowIndex, { description: e.target.value })} rows={1} className={`${cellInputCls} resize-y`} placeholder="问题描述" />
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <input type="text" value={r.assignee || ''} onChange={e => setCell(r.rowIndex, { assignee: e.target.value })} className={cellInputCls} placeholder="责任人" />
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <select value={r.category} onChange={e => setCell(r.rowIndex, { category: e.target.value })} className={cellSelectCls}>
                                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {complete ? (
                                <span className="text-green-600">可导入</span>
                              ) : (
                                <span className="text-orange-500" title={!r.description?.trim() ? '问题描述为空' : '未匹配到设备'}>需补充</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>取消</Button>
                <Button onClick={handleConfirm} disabled={submitting || importableCount === 0}>
                  {submitting ? '导入中...' : `确认导入 ${importableCount} 条`}
                </Button>
              </div>
            </>
          )}
        </div>
    </div>
  );
};

export default IssueImportPanel;
