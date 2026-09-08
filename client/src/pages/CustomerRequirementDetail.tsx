import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TrashIcon, EyeIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import AttachmentViewer, { Attachment } from '../components/AttachmentViewer';
import CustomerRequirementForm from '../components/CustomerRequirementForm';
import { customerRequirementApi } from '../services/api';
import { CustomerRequirement, CustomerRequirementFormData, CustomerRequirementAttachment } from '../types';
import { formatDate } from '../utils';

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

const attUrl = (id: number, inline = false) => {
  const token = localStorage.getItem('auth_token');
  return `/api/customer-requirements/attachments/${id}/download?token=${token}${inline ? '&inline=1' : ''}`;
};

const SectionCard: React.FC<{ title: string; extra?: React.ReactNode; children: React.ReactNode }> = ({ title, extra, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {extra}
    </div>
    <div className="p-4 3xl:p-5">{children}</div>
  </div>
);

const CustomerRequirementDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reqId = Number(id);

  const [data, setData] = useState<CustomerRequirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  // 状态流转
  const [targetStatus, setTargetStatus] = useState('');
  const [reason, setReason] = useState('');
  const [publishVersion, setPublishVersion] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [deprecatedReason, setDeprecatedReason] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [msg, setMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successStatus, setSuccessStatus] = useState('');

  // 附件
  const [uploadingStatus, setUploadingStatus] = useState('');
  const [previewAtt, setPreviewAtt] = useState<Attachment[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customerRequirementApi.getDetail(reqId);
      if (res.success) setData(res.data);
    } catch (e) {
      console.error('获取需求详情失败:', e);
    } finally {
      setLoading(false);
    }
  }, [reqId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleEditSubmit = async (formData: CustomerRequirementFormData) => {
    const res = await customerRequirementApi.update(reqId, formData);
    if (!res.success) throw new Error(res.error);
    setShowEdit(false);
    setMsg('需求已更新');
    setTimeout(() => setMsg(''), 3000);
    fetchDetail();
  };

  const handleStatusChange = async () => {
    if (!targetStatus) { alert('请选择目标状态'); return; }
    if (targetStatus === data?.status) { alert('目标状态与当前状态一致'); return; }
    if (!reason.trim()) { alert('请填写状态流转原因'); return; }
    if (targetStatus === '已发布' && (!publishVersion || !publishTime)) { alert('进入「已发布」需填写发布版本号与发布时间'); return; }
    if (targetStatus === '废弃' && !deprecatedReason.trim()) { alert('废弃需求必须填写废弃原因'); return; }

    const newStatus = targetStatus;
    setTransitioning(true);
    try {
      const res = await customerRequirementApi.changeStatus(reqId, {
        status: targetStatus,
        reason,
        publish_version: publishVersion || undefined,
        publish_time: publishTime || undefined,
        deprecated_reason: deprecatedReason || undefined,
      });
      if (res.success) {
        // 隐藏流转表单 + 弹出成功提示
        setTargetStatus('');
        setReason(''); setPublishVersion(''); setPublishTime(''); setDeprecatedReason('');
        setSuccessStatus(newStatus);
        setShowSuccess(true);
        fetchDetail();
      } else {
        alert(res.error || '状态流转失败');
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || '状态流转失败');
    } finally {
      setTransitioning(false);
    }
  };

  const handleUploadForStatus = async (status: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingStatus(status);
    const fd = new FormData();
    fd.append('status', status);
    files.forEach(f => fd.append('files', f));
    try {
      const res = await customerRequirementApi.uploadAttachments(reqId, fd);
      if (res.success) fetchDetail();
      else alert(res.error || '上传失败');
    } catch (e: any) {
      alert(e?.response?.data?.error || '上传失败');
    } finally {
      setUploadingStatus('');
    }
  };

  const handleDeleteAtt = async (attId: number) => {
    if (!window.confirm('确定删除该附件吗？')) return;
    try {
      const res = await customerRequirementApi.deleteAttachment(attId);
      if (res.success) fetchDetail();
      else alert(res.error || '删除失败');
    } catch (e: any) {
      alert(e?.response?.data?.error || '删除失败');
    }
  };

  const openPreview = (atts: CustomerRequirementAttachment[], idx: number) => {
    const mapped = atts.map(a => ({ name: a.original_name, url: attUrl(a.id, true), size: a.file_size }));
    setPreviewAtt(mapped);
    setPreviewIdx(idx);
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-500">需求不存在</div>
      </Layout>
    );
  }

  const statusBadge = (s: string) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s] || 'text-gray-600 bg-gray-100'}`}>{s}</span>
  );

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );

  const currentIndex = STATUSES.indexOf(data.status);
  const byStatus = (s: string) => (data.attachments || []).filter(a => (a.status || '') === s);

  return (
    <Layout>
      <div className="p-4 3xl:p-6">
        <button onClick={() => navigate('/customer-requirements')} className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> 返回需求列表
        </button>

        {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">{msg}</div>}

        <SectionCard
          title="基本信息"
          extra={
            <button onClick={() => setShowEdit(true)} className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
              <PencilIcon className="h-4 w-4 mr-1" /> 编辑
            </button>
          }
        >
          <h1 className="text-xl font-bold text-gray-900 mb-1">{data.req_code}</h1>
          <p className="text-sm text-gray-500 mb-4">登记人：{data.created_by} · 登记时间：{formatDate(data.created_at)}</p>

          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {field('客户', data.customer_name)}
            {field('需求分类', data.requirement_type)}
            {field('紧急程度', data.urgency)}
            {field('当前状态', statusBadge(data.status))}
            {field('需求提出日期', data.proposed_date)}
            {field('发布版本号', data.publish_version)}
            {field('发布时间', data.publish_time ? formatDate(data.publish_time) : null)}
            {field('最后更新', data.updated_by ? `${data.updated_by} · ${formatDate(data.updated_at)}` : null)}
          </dl>

          <div className="mt-4">
            <dt className="text-xs text-gray-500 mb-1">需求详情描述</dt>
            <dd className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-md p-3">{data.description}</dd>
          </div>

          {data.remarks && (
            <div className="mt-4">
              <dt className="text-xs text-gray-500 mb-1">备注</dt>
              <dd className="text-sm text-gray-900 whitespace-pre-wrap">{data.remarks}</dd>
            </div>
          )}
          {data.deprecated_reason && (
            <div className="mt-4">
              <dt className="text-xs text-gray-500 mb-1">废弃原因</dt>
              <dd className="text-sm text-red-600 whitespace-pre-wrap">{data.deprecated_reason}</dd>
            </div>
          )}
        </SectionCard>

        {/* 状态时间轴（横向） */}
        <SectionCard title="状态时间轴">
          <div className="w-full">
            <div className="flex items-center w-full">
              {STATUSES.map((s, i) => {
                const done = i < currentIndex;
                const current = i === currentIndex;
                const selected = targetStatus === s;
                const reached = i <= currentIndex;
                return (
                  <React.Fragment key={s}>
                    {i > 0 && <div className={`flex-1 h-0.5 ${reached ? 'bg-blue-500' : 'bg-gray-200'}`}></div>}
                    <button
                      type="button"
                      onClick={() => { if (s !== data.status) setTargetStatus(s); }}
                      disabled={s === data.status}
                      className={`flex-1 flex flex-col items-center ${s === data.status ? '' : 'cursor-pointer group'}`}
                      title={s === data.status ? '当前状态' : '点击流转到该阶段'}
                    >
                      <div className={`flex items-center justify-center h-9 w-9 rounded-full text-sm font-medium transition-colors
                        ${current ? 'bg-blue-600 text-white'
                          : done ? 'bg-blue-100 text-blue-600'
                          : selected ? 'bg-white text-blue-700 ring-1 ring-blue-400'
                          : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}
                      >
                        {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={`mt-1.5 text-[11px] whitespace-nowrap ${current ? 'font-semibold text-blue-700' : done ? 'text-blue-600' : selected ? 'font-medium text-blue-700' : 'text-gray-400'}`}>
                        {s}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {targetStatus ? (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600 mb-3">
                将状态流转至：<span className="font-medium text-gray-900">{targetStatus}</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">流转原因 <span className="text-red-500">*</span></label>
                  <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="必填，写入状态变更日志" />
                </div>
                {targetStatus === '已发布' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">发布版本号 <span className="text-red-500">*</span></label>
                      <input type="text" value={publishVersion} onChange={e => setPublishVersion(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="如 V2.3.0" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">发布时间 <span className="text-red-500">*</span></label>
                      <input type="datetime-local" value={publishTime} onChange={e => setPublishTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                  </>
                )}
                {targetStatus === '废弃' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">废弃原因 <span className="text-red-500">*</span></label>
                    <textarea value={deprecatedReason} onChange={e => setDeprecatedReason(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setTargetStatus('')} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">取消</button>
                <button type="button" onClick={handleStatusChange} disabled={transitioning} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {transitioning ? '提交中...' : '确认流转'}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-400">点击上方灰色阶段可进行状态流转（须填写原因）。</p>
          )}
        </SectionCard>

        {/* 阶段附件 */}
        <SectionCard
          title="阶段附件"
          extra={<p className="text-xs text-gray-400">每个阶段可独立上传/管理附件</p>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {STATUSES.map(s => {
              const atts = byStatus(s);
              const done = STATUSES.indexOf(s) <= currentIndex;
              return (
                <div key={s} className={`border rounded-md p-3 ${done ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${done ? 'text-blue-700' : 'text-gray-500'}`}>{s}</span>
                    {done && (
                      <label className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                        <ArrowUpTrayIcon className="h-3 w-3 mr-1" />
                        {uploadingStatus === s ? '上传中...' : '上传'}
                        <input type="file" multiple className="hidden" onChange={e => handleUploadForStatus(s, e)} disabled={uploadingStatus === s} />
                      </label>
                    )}
                  </div>
                  {atts.length === 0 ? (
                    <p className="text-xs text-gray-400">暂无附件</p>
                  ) : (
                    <ul className="space-y-1">
                      {atts.map((a, idx) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-gray-700 truncate">{a.original_name}</span>
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => openPreview(atts, idx)} title="预览" className="p-1 text-gray-500 hover:text-blue-600"><EyeIcon className="h-3 w-3" /></button>
                            <a href={attUrl(a.id)} download={a.original_name} title="下载" className="p-1 text-gray-500 hover:text-blue-600"><ArrowDownTrayIcon className="h-3 w-3" /></a>
                            <button onClick={() => handleDeleteAtt(a.id)} title="删除" className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="h-3 w-3" /></button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* 流转日志 */}
        <SectionCard title="流转日志">
          {(data.logs && data.logs.length > 0) ? (
            <ol className="space-y-3">
              {data.logs.map(log => (
                <li key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900">
                      由 <span className="font-medium">{log.from_status || '待评估'}</span> 变更为 <span className="font-medium">{log.to_status}</span>
                    </p>
                    {log.remark && <p className="text-xs text-gray-600 mt-0.5">{log.remark}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{log.operator} · {formatDate(log.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-500">暂无流转记录</p>
          )}
        </SectionCard>
      </div>

      {showEdit && (
        <CustomerRequirementForm requirement={data} onClose={() => setShowEdit(false)} onSubmit={handleEditSubmit} />
      )}

      {previewAtt.length > 0 && (
        <AttachmentViewer attachments={previewAtt} initialIndex={previewIdx} onClose={() => setPreviewAtt([])} />
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSuccess(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 text-center">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-3">
              <CheckIcon className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">状态流转成功</h3>
            <p className="text-sm text-gray-500 mt-1">需求已流转至「{successStatus}」</p>
            <button onClick={() => setShowSuccess(false)} className="mt-5 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">确定</button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CustomerRequirementDetail;
