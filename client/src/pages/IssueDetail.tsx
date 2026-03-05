import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AttachmentViewer, { Attachment } from '../components/AttachmentViewer';
import {
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  DevicePhoneMobileIcon,
  CogIcon,
  PrinterIcon,
  PaperClipIcon
} from '@heroicons/react/24/outline';
import { Issue, IssueFormData } from '../types';
import { issueApi } from '../services/api';
import Layout from '../components/Layout';
import IssueForm from '../components/IssueForm';
import IssueLogTimeline from '../components/IssueLogTimeline';
import { formatDate, getStatusColor, getSeverityColor } from '../utils';

export default function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [previewAtts, setPreviewAtts] = useState<Attachment[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  useEffect(() => {
    if (id) {
      fetchIssue();
    }
  }, [id]);

  const fetchIssue = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await issueApi.getIssue(id);
      if (response.success) {
        setIssue(response.data);
      } else {
        console.error('获取问题详情失败:', response.error);
        // 如果问题不存在，跳转到问题列表页
        console.log('问题不存在，跳转到问题列表页');
        navigate('/issues');
      }
    } catch (error) {
      console.error('获取问题详情失败:', error);
      // 如果是404错误，跳转到问题列表页
      if (error instanceof Error && error.message.includes('404')) {
        navigate('/issues');
      } else {
        setIssue(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setShowEditForm(true);
  };

  const handleEditSubmit = async (data: IssueFormData) => {
    if (!id) return;
    try {
      await issueApi.updateIssue(id, data);
      await fetchIssue();
      setShowEditForm(false);
    } catch (error) {
      console.error('更新问题失败:', error);
      throw error;
    }
  };

  const handleResolve = () => {
    setShowResolveForm(true);
  };

  const handleResolveSubmit = async () => {
    if (!id) return;
    try {
      await issueApi.updateIssue(id, {
        status: 'closed',
        resolution_description: resolveNotes,
        resolved_at: new Date().toISOString()
      });
      await fetchIssue();
      setShowResolveForm(false);
      setResolveNotes('');
    } catch (error) {
      console.error('解决问题失败:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <ExclamationTriangleIcon className="h-5 w-5 text-blue-500" />;
      case 'in_progress':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'closed':
        return <CheckIcon className="h-5 w-5 text-green-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return '待处理';
      case 'in_progress':
        return '处理中';
      case 'closed':
        return '已解决';
      default:
        return status;
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'low':
        return '低';
      case 'medium':
        return '中';
      case 'high':
        return '高';
      default:
        return severity;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      </Layout>
    );
  }

  if (!issue && !loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-gray-500 text-lg">问题不存在或已被删除</div>
          <button
            onClick={() => navigate('/issues')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            返回售后问题管理
          </button>
        </div>
      </Layout>
    );
  }

  if (!issue) {
    return null; // 这个情况已经在上面处理了，但为了TypeScript安全
  }

  // 打印页面
  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout>
      <div className="space-y-4 3xl:space-y-6">
        {/* 仅打印可见的页眉 */}
        <div className="hidden print:block print-header">
          <div className="flex items-center justify-between" style={{marginBottom: '3pt'}}>
            <span style={{fontSize: '8pt', color: '#6b7280'}}>售后登记系统</span>
            <span style={{fontSize: '8pt', color: '#6b7280'}}>打印时间：{new Date().toLocaleString('zh-CN')}</span>
          </div>
          <h1 style={{fontSize: '12pt', fontWeight: 'bold', margin: '0 0 3pt 0', color: '#111827'}}>
            问题详情 #{issue.id} — {issue.description}
          </h1>
          <div className="print-flex-row" style={{marginTop: '3pt'}}>
            <span style={{padding: '0 6pt', borderRadius: '999px', fontSize: '8pt', fontWeight: '600',
              background: issue.status === 'closed' ? '#d1fae5' : issue.status === 'in_progress' ? '#fef3c7' : '#fee2e2',
              color: issue.status === 'closed' ? '#065f46' : issue.status === 'in_progress' ? '#92400e' : '#991b1b'}}>
              {issue.status === 'closed' ? '已解决' : issue.status === 'in_progress' ? '处理中' : '待处理'}
            </span>
            <span style={{padding: '0 6pt', borderRadius: '999px', fontSize: '8pt', fontWeight: '600',
              background: issue.severity === 'high' ? '#fee2e2' : issue.severity === 'medium' ? '#fef3c7' : '#f0f9ff',
              color: issue.severity === 'high' ? '#991b1b' : issue.severity === 'medium' ? '#92400e' : '#0369a1'}}>
              {issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}
            </span>
            <span style={{fontSize: '8pt', color: '#6b7280'}}>
              设备：{issue.device_name}{issue.device_type ? '（' + issue.device_type + '）' : ''}
            </span>
          </div>
        </div>

        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/issues"
              className="flex items-center text-gray-600 hover:text-gray-900 no-print"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              返回售后问题管理
            </Link>
            <div className="h-6 w-px bg-gray-300 no-print" />
            <h1 className="text-2xl font-bold text-gray-900">
              问题详情 #{issue.id}
            </h1>
          </div>
          <div className="flex items-center space-x-3 no-print">
            <button
              onClick={handlePrint}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              打印
            </button>
            {issue.status !== 'closed' && (
              <button
                onClick={handleResolve}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                解决问题
              </button>
            )}
            <button
              onClick={handleEdit}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              编辑问题
            </button>
          </div>
        </div>

        {/* 问题概览卡片 */}
        <div className="bg-white rounded-lg shadow-lg border-l-4 border-l-blue-500">
          <div className="px-6 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {getStatusIcon(issue.status)}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {issue.description}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(issue.status)}`}>
                      {getStatusText(issue.status)}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(issue.severity)}`}>
                      {getSeverityText(issue.severity)}
                    </span>
                    <span className="text-sm text-gray-500 flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {formatDate(issue.created_at, 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 print:hidden">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">问题ID</p>
                  <p className="text-xl font-mono font-bold text-gray-900">#{issue.id}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 详细信息网格 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 3xl:gap-6 print:grid-cols-2 print:gap-4 print-2col-grid">
          {/* 设备信息卡片 */}
          <div className="bg-white rounded-lg shadow print:shadow-none print:border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 flex items-center print:text-xs">
                <DevicePhoneMobileIcon className="h-4 w-4 mr-2" />
                设备信息
              </h3>
            </div>
            <div className="px-6 py-4 print:px-4 print:py-3">
              <div className="space-y-4 print:space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 print:text-xs">设备名称</span>
                  <span className="text-sm font-medium text-gray-900 print:text-xs">{issue.device_name}</span>
                </div>
                {issue.device_type && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 print:text-xs">设备类型</span>
                    <span className="text-sm font-medium text-gray-900 print:text-xs">{issue.device_type}</span>
                  </div>
                )}
                {issue.module_category && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 print:text-xs">模块</span>
                    <span className="text-sm font-medium text-gray-900 print:text-xs">{issue.module_category}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 print:text-xs">登记人</span>
                  <span className="text-sm font-medium text-gray-900 print:text-xs">{issue.assignee || '未分配'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 时间信息卡片 */}
          <div className="bg-white rounded-lg shadow print:shadow-none print:border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 flex items-center print:text-xs">
                <ClockIcon className="h-4 w-4 mr-2" />
                时间信息
              </h3>
            </div>
            <div className="px-6 py-4 print:px-4 print:py-3">
              <div className="space-y-4 print:space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 print:text-xs">创建时间</span>
                  <span className="text-sm font-medium text-gray-900 print:text-xs">
                    {formatDate(issue.created_at, 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
                {issue.updated_at && issue.updated_at !== issue.created_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 print:text-xs">更新时间</span>
                    <span className="text-sm font-medium text-gray-900 print:text-xs">
                      {formatDate(issue.updated_at, 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                )}
                {issue.resolved_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 print:text-xs">解决时间</span>
                    <span className="text-sm font-medium text-gray-900 print:text-xs">
                      {formatDate(issue.resolved_at, 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                )}
                {issue.resolved_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 print:text-xs">处理时长</span>
                    <span className="text-sm font-medium text-gray-900 print:text-xs">
                      {Math.ceil((new Date(issue.resolved_at).getTime() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24))} 天
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 问题描述和备注 */}
        <div className="bg-white rounded-lg shadow print:shadow-none print:border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 flex items-center print:text-xs">
              <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              问题详情
            </h3>
          </div>
          <div className="px-6 py-4 print:px-4 print:py-3">
            <div className="space-y-6 print:space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 print:text-xs print:mb-1">问题描述</h4>
                <p className="text-sm text-gray-900 leading-relaxed bg-gray-50 p-4 rounded-lg print:text-xs print:p-2">
                  {issue.description}
                </p>
              </div>

              {issue.resolution_description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">问题备注</h4>
                  <p className="text-sm text-gray-900 leading-relaxed bg-blue-50 p-4 rounded-lg whitespace-pre-wrap print:bg-white print:p-0">
                    {issue.resolution_description}
                  </p>
                </div>
              )}

              {/* 问题附件 */}
              {(() => {
                const atts: Attachment[] = issue.attachments
                  ? (typeof issue.attachments === 'string'
                      ? (() => { try { return JSON.parse(issue.attachments as any); } catch { return []; } })()
                      : issue.attachments)
                  : [];
                return atts.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                      <PaperClipIcon className="h-4 w-4" />登记附件
                    </h4>
                    <ul className="space-y-1.5">
                      {atts.map((att, i) => (
                        <li key={i} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded px-3 py-1.5 text-sm">
                          <PaperClipIcon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                          <button
                            onClick={() => { setPreviewAtts(atts); setPreviewIdx(i); }}
                            className="text-blue-700 hover:underline truncate text-left print-show"
                          >{att.name}</button>
                          <span className="text-gray-400 text-xs ml-auto flex-shrink-0">{att.size ? (att.size / 1024).toFixed(0) + ' KB' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        {/* 处理记录时间线 - 不打印 */}
        <div className="bg-white rounded-lg shadow print:hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 flex items-center">
              <ClockIcon className="h-4 w-4 mr-2" />
              处理流程
            </h3>
          </div>
          <div className="px-6 py-4">
            <IssueLogTimeline issueId={id!} issueStatus={issue.status} onLogAdded={fetchIssue} />
          </div>
        </div>

        {/* 固定操作栏 - 仅在移动端显示 */}
        <div className="fixed bottom-6 right-6 z-40 md:hidden no-print">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2">
            <div className="flex items-center space-x-2">
              {issue.status !== 'closed' && (
                <button
                  onClick={handleResolve}
                  className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  title="解决问题"
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  解决
                </button>
              )}
              <button
                onClick={handleEdit}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                title="编辑问题"
              >
                <PencilIcon className="h-4 w-4 mr-1" />
                编辑
              </button>
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

        {/* 编辑表单 */}
        {showEditForm && (
          <IssueForm
            issue={issue}
            onClose={() => setShowEditForm(false)}
            onSubmit={handleEditSubmit}
          />
        )}

        {/* 解决表单 */}
        {showResolveForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 3xl:p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">解决问题</h3>
                <button
                  onClick={() => setShowResolveForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">关闭</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 3xl:p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    解决说明
                  </label>
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请描述问题的解决方案..."
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowResolveForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleResolveSubmit}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                  >
                    确认解决
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
