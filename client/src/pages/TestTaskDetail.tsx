import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TrashIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import AttachmentViewer, { Attachment } from '../components/AttachmentViewer';
import TestTaskForm from '../components/TestTaskForm';
import TestSummaryForm from '../components/TestSummaryForm';
import Select from '../components/Select';
import { testTaskApi } from '../services/api';
import { TestTask, TestTaskFormData } from '../types';
import { formatDate, getUrgencyColor } from '../utils';

const STATUS_COLORS: Record<string, string> = {
  '测试中': 'text-blue-600 bg-blue-100',
  '已测试': 'text-orange-600 bg-orange-100',
  '通过': 'text-green-600 bg-green-100',
  '不通过': 'text-red-600 bg-red-100',
};

const attUrl = (id: number, inline = false) => {
  const token = localStorage.getItem('auth_token');
  return `/api/test-tasks/attachments/${id}/download?token=${token}${inline ? '&inline=1' : ''}`;
};

const TestTaskDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const taskId = Number(id);

  const [data, setData] = useState<TestTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [msg, setMsg] = useState('');

  // 附件
  const [category, setCategory] = useState('测试反馈单');
  const [uploading, setUploading] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<Attachment[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  // 决策
  const [decisionStatus, setDecisionStatus] = useState<'通过' | '不通过'>('通过');
  const [upgradeDecision, setUpgradeDecision] = useState<'升级' | '不升级'>('升级');
  const [decisionNote, setDecisionNote] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await testTaskApi.getDetail(taskId);
      if (res.success) setData(res.data);
    } catch (e) {
      console.error('获取测试任务详情失败:', e);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleEditSubmit = async (formData: TestTaskFormData) => {
    const res = await testTaskApi.update(taskId, formData);
    if (!res.success) throw new Error(res.error);
    setShowEdit(false);
    setMsg('任务单已更新');
    setTimeout(() => setMsg(''), 3000);
    fetchDetail();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('category', category);
    files.forEach(f => fd.append('files', f));
    try {
      const res = await testTaskApi.uploadAttachments(taskId, fd);
      if (res.success) fetchDetail();
      else alert(res.error || '上传失败');
    } catch (e: any) {
      alert(e?.response?.data?.error || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAtt = async (attId: number) => {
    if (!window.confirm('确定删除该附件吗？')) return;
    try {
      const res = await testTaskApi.deleteAttachment(attId);
      if (res.success) fetchDetail();
      else alert(res.error || '删除失败');
    } catch (e: any) {
      alert(e?.response?.data?.error || '删除失败');
    }
  };

  const openPreview = (idx: number) => {
    const atts = (data?.attachments || []).map(a => ({ name: a.original_name, url: attUrl(a.id, true), size: a.file_size }));
    setPreviewAtt(atts);
    setPreviewIdx(idx);
  };

  const handleDecision = async () => {
    if (decisionStatus === '不通过' && !decisionNote.trim()) { alert('选择「不通过」必须填写决策说明'); return; }
    if (decisionStatus === '通过' && upgradeDecision === '不升级' && !decisionNote.trim()) { alert('选择「不升级」必须填写说明'); return; }

    setSubmittingDecision(true);
    try {
      const res = await testTaskApi.decision(taskId, {
        status: decisionStatus,
        upgrade_decision: decisionStatus === '通过' ? upgradeDecision : undefined,
        decision_note: decisionNote || undefined,
      });
      if (res.success) {
        setMsg('升级决策已提交');
        setDecisionNote('');
        setTimeout(() => setMsg(''), 3000);
        fetchDetail();
      } else {
        alert(res.error || '决策提交失败');
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || '决策提交失败');
    } finally {
      setSubmittingDecision(false);
    }
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
        <div className="text-center py-12 text-gray-500">测试任务不存在</div>
      </Layout>
    );
  }

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );

  return (
    <Layout>
      <div className="p-4 3xl:p-6">
        <button onClick={() => navigate('/test-tasks')} className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> 返回测试管理
        </button>

        {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">{msg}</div>}

        <div className="bg-card rounded-2xl border border-border shadow-soft p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.task_code}</h1>
              <p className="text-sm text-gray-500 mt-1">创建人：{data.created_by} · 创建时间：{formatDate(data.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              {data.status === '测试中' && (
                <button onClick={() => setShowEdit(true)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                  <PencilIcon className="h-4 w-4 mr-1" /> 编辑
                </button>
              )}
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[data.status] || 'text-gray-600 bg-gray-100'}`}>{data.status}</span>
            </div>
          </div>

          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {field('对应产品', data.product_name ? `${data.product_name}${data.product_model ? ` (${data.product_model})` : ''}` : null)}
            {field('模型名称', data.model_name)}
            {field('模型版本号', data.model_version)}
            {field('当前版本', data.current_version)}
            {field('紧急程度', <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(data.priority)}`}>{data.priority}</span>)}
            {field('深圳需求人', data.shenzhen_requester_name)}
            {field('上海测试人', data.shanghai_tester)}
            {field('计划完成时间', data.planned_completion_date)}
          </dl>
        </div>

        {/* 业务详情 */}
        {[
          { label: '升级内容', value: data.upgrade_content },
          { label: '模型特点', value: data.model_features },
          { label: '测试要点', value: data.test_focus },
          { label: '测试要求', value: data.test_requirements },
          { label: '车型要求', value: data.vehicle_requirements },
          { label: '测试场景', value: data.test_scenarios },
        ].map(({ label, value }) =>
          value ? (
            <div key={label} className="bg-card rounded-2xl border border-border shadow-soft p-6 mb-4">
              <dt className="text-xs text-gray-500 mb-1">{label}</dt>
              <dd className="text-sm text-gray-900 whitespace-pre-wrap">{value}</dd>
            </div>
          ) : null
        )}

        {/* 测试总结（已填则展示） */}
        {data.test_summary && (
          <div className="bg-card rounded-2xl border border-border shadow-soft p-6 mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">测试总结</h2>
            <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-md p-3">{data.test_summary}</p>
          </div>
        )}

        {/* 决策信息 */}
        {(data.status === '通过' || data.status === '不通过') && (
          <div className="bg-card rounded-2xl border border-border shadow-soft p-6 mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">决策信息</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {field('升级决策', data.upgrade_decision)}
              {field('决策操作人', data.decided_by)}
              {field('决策时间', data.decided_at ? formatDate(data.decided_at) : null)}
              {field('决策说明', data.decision_note)}
            </div>
          </div>
        )}

        {/* 附件 */}
        <div className="bg-card rounded-2xl border border-border shadow-soft p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-gray-900">附件</h2>
            <div className="flex items-center gap-2">
              <Select value={category} onChange={v => setCategory(v)} options={[{ value: '测试反馈单', label: '测试反馈单' }, { value: '测试报告', label: '测试报告' }, { value: '其他', label: '其他' }]} className="px-2 py-1.5 border border-border rounded-xl text-sm" />
              <label className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                {uploading ? '上传中...' : '上传附件'}
                <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          </div>
          {(!data.attachments || data.attachments.length === 0) ? (
            <p className="text-sm text-gray-500">暂无附件</p>
          ) : (
            <div className="space-y-2">
              {data.attachments.map((a, idx) => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-400 flex-shrink-0">{a.category}</span>
                    <span className="text-sm text-gray-800 truncate">{a.original_name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openPreview(idx)} title="预览" className="p-1.5 text-gray-500 hover:text-primary-600"><EyeIcon className="h-4 w-4" /></button>
                    <a href={attUrl(a.id)} download={a.original_name} title="下载" className="p-1.5 text-gray-500 hover:text-primary-600"><ArrowDownTrayIcon className="h-4 w-4" /></a>
                    <button onClick={() => handleDeleteAtt(a.id)} title="删除" className="p-1.5 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 提交总结（测试中） */}
        {data.status === '测试中' && (
          <div className="mb-4">
            <TestSummaryForm taskId={taskId} onSubmitted={fetchDetail} />
          </div>
        )}

        {/* 升级决策（已测试） */}
        {data.status === '已测试' && (
          <div className="bg-card rounded-2xl border border-border shadow-soft p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">升级决策</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">决策结果</label>
                <div className="flex gap-6">
                  <RadioOption checked={decisionStatus === '通过'} onChange={() => setDecisionStatus('通过')} label="通过" />
                  <RadioOption checked={decisionStatus === '不通过'} onChange={() => setDecisionStatus('不通过')} label="不通过" />
                </div>
              </div>
              {decisionStatus === '通过' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">是否升级为产品最新模型</label>
                  <div className="flex gap-6">
                    <RadioOption checked={upgradeDecision === '升级'} onChange={() => setUpgradeDecision('升级')} label="升级（替换产品模型为最新）" />
                    <RadioOption checked={upgradeDecision === '不升级'} onChange={() => setUpgradeDecision('不升级')} label="不升级" />
                  </div>
                </div>
              )}
              {(decisionStatus === '不通过' || (decisionStatus === '通过' && upgradeDecision === '不升级')) && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">决策说明 <span className="text-red-500">*</span></label>
                  <textarea value={decisionNote} onChange={e => setDecisionNote(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="填写不替换说明 / 不通过原因" />
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleDecision} disabled={submittingDecision}>{submittingDecision ? '提交中...' : '提交决策'}</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showEdit && <TestTaskForm testTask={data} onClose={() => setShowEdit(false)} onSubmit={handleEditSubmit} />}

      {previewAtt.length > 0 && (
        <AttachmentViewer attachments={previewAtt} initialIndex={previewIdx} onClose={() => setPreviewAtt([])} />
      )}
    </Layout>
  );
};

const RadioOption: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="radio" checked={checked} onChange={onChange} className="h-4 w-4 text-primary-600 focus:ring-primary-500/40" />
    <span className="text-sm text-gray-800">{label}</span>
  </label>
);

export default TestTaskDetail;
