import React, { useState, useEffect, useRef } from 'react';
import { IssueLog } from '../types';
import { ClockIcon, UserIcon, PlusIcon, XMarkIcon, PaperClipIcon, TrashIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import AttachmentViewer, { Attachment } from './AttachmentViewer';

interface IssueLogTimelineProps {
  issueId: string;
  issueStatus?: string;
  onLogAdded?: () => void;
}

interface UploadedAttachment {
  name: string;
  url: string;
  ossPath: string;
  size: number;
}

const IssueLogTimeline: React.FC<IssueLogTimelineProps> = ({ issueId, issueStatus, onLogAdded }) => {
  const [logs, setLogs] = useState<IssueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    operator: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAtts, setPreviewAtts] = useState<Attachment[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/issue-logs/${issueId}`);
      setLogs(response.data.data || []);
    } catch (error) {
      console.error('获取处理记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [issueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.content.trim() || !formData.operator.trim()) {
      alert('请填写处理内容和处理人');
      return;
    }

    try {
      setSubmitting(true);

      // 如果有附件，先上传附件
      let attachments: UploadedAttachment[] = [];
      if (pendingFiles.length > 0) {
        setUploadingCount(pendingFiles.length);
        const fd = new FormData();
        fd.append('issue_id', issueId);
        pendingFiles.forEach(f => fd.append('files', f));
        const { data: uploadData } = await api.post('/issue-logs/upload-attachment', fd);
        if (!uploadData.success) throw new Error(uploadData.error || '附件上传失败');
        attachments = uploadData.data || [];
        setUploadingCount(0);
      }

      // 创建处理记录
      await api.post('/issue-logs', {
        issue_id: issueId,
        content: formData.content,
        operator: formData.operator,
        ...(attachments.length > 0 ? { attachments: JSON.stringify(attachments) } : {})
      });

      // 重置表单
      setFormData({ content: '', operator: '' });
      setPendingFiles([]);
      setShowForm(false);

      // 刷新列表
      await fetchLogs();
      
      if (onLogAdded) {
        onLogAdded();
      }

      alert('处理记录添加成功');
    } catch (error) {
      console.error('添加处理记录失败:', error);
      alert('添加处理记录失败');
    } finally {
      setSubmitting(false);
      setUploadingCount(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">处理记录</h3>
        {issueStatus !== 'closed' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            {showForm ? (
              <>
                <XMarkIcon className="h-4 w-4 mr-1" />
                取消
              </>
            ) : (
              <>
                <PlusIcon className="h-4 w-4 mr-1" />
                添加处理记录
              </>
            )}
          </button>
        )}
      </div>

      {/* 添加记录表单 */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                处理内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请描述本次处理的具体内容..."
                required
              />
            </div>

            {/* 附件上传 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <PaperClipIcon className="h-4 w-4" />
                添加附件
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <ArrowUpTrayIcon className="h-5 w-5 mx-auto text-blue-400 mb-1" />
                <p className="text-xs text-blue-500">点击选择附件（支持多选）</p>
              </div>
              {pendingFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pendingFiles.map((file, i) => (
                    <li key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <PaperClipIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate text-gray-700">{file.name}</span>
                        <span className="text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                      </div>
                      <button type="button" onClick={() => removePendingFile(i)} className="ml-2 text-red-400 hover:text-red-600 flex-shrink-0">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  处理人 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.operator}
                  onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入处理人姓名"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setPendingFiles([]); }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting
                  ? (uploadingCount > 0 ? `上传附件中 (${uploadingCount})…` : '提交中…')
                  : '提交'
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 时间线 */}
      <div className="relative">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无处理记录
          </div>
        ) : (
          <div className="space-y-6">
            {logs.map((log, index) => (
              <div key={log.id} className="relative pl-8">
                {/* 时间线 */}
                {index < logs.length - 1 && (
                  <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200"></div>
                )}
                
                {/* 时间点 */}
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                </div>

                {/* 内容卡片 */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <UserIcon className="h-4 w-4 mr-1" />
                        <span className="font-medium">{log.operator || '-'}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-gray-800 whitespace-pre-wrap mb-2">
                    {log.content}
                  </div>

                  {/* 附件列表 */}
                  {(() => {
                    const atts: Attachment[] = log.attachments
                      ? (typeof log.attachments === 'string'
                          ? (() => { try { return JSON.parse(log.attachments as any); } catch { return []; } })()
                          : log.attachments)
                      : [];
                    return atts.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                          <PaperClipIcon className="h-3.5 w-3.5" />附件
                        </p>
                        <ul className="space-y-1">
                          {atts.map((att, i) => (
                            <li key={i} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded px-2.5 py-1 text-xs">
                              <PaperClipIcon className="h-3 w-3 text-blue-400 flex-shrink-0" />
                              <button
                                onClick={() => { setPreviewAtts(atts); setPreviewIdx(i); }}
                                className="text-blue-700 hover:underline truncate text-left"
                              >{att.name}</button>
                              <span className="text-gray-400 ml-auto flex-shrink-0">{formatFileSize(att.size ?? 0)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

      {/* 附件预览模态框 */}
      {previewAtts.length > 0 && (
        <AttachmentViewer
          attachments={previewAtts}
          initialIndex={previewIdx}
          onClose={() => setPreviewAtts([])}
        />
      )}
    </>
  );
};

export default IssueLogTimeline;
