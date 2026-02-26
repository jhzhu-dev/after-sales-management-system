import React, { useState, useEffect } from 'react';
import { IssueLog } from '../types';
import { ClockIcon, UserIcon, PaperClipIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

interface IssueLogTimelineProps {
  issueId: string;
  onLogAdded?: () => void;
}

const IssueLogTimeline: React.FC<IssueLogTimelineProps> = ({ issueId, onLogAdded }) => {
  const [logs, setLogs] = useState<IssueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    handler: '',
    handled_at: new Date().toISOString().slice(0, 16),
    attachments: [] as File[]
  });
  const [submitting, setSubmitting] = useState(false);

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
    
    if (!formData.content.trim() || !formData.handler.trim()) {
      alert('请填写处理内容和处理人');
      return;
    }

    try {
      setSubmitting(true);

      // 上传附件（如果有）
      let attachmentUrls: string[] = [];
      if (formData.attachments.length > 0) {
        const uploadFormData = new FormData();
        formData.attachments.forEach(file => {
          uploadFormData.append('files', file);
        });
        uploadFormData.append('type', 'issue-logs');

        const uploadResponse = await api.post('/uploads/multiple', uploadFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        attachmentUrls = uploadResponse.data.data.urls || [];
      }

      // 创建处理记录
      await api.post('/issue-logs', {
        issue_id: issueId,
        content: formData.content,
        handler: formData.handler,
        handled_at: formData.handled_at,
        attachments: attachmentUrls
      });

      // 重置表单
      setFormData({
        content: '',
        handler: '',
        handled_at: new Date().toISOString().slice(0, 16),
        attachments: []
      });
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
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData({
        ...formData,
        attachments: Array.from(e.target.files)
      });
    }
  };

  const removeFile = (index: number) => {
    const newAttachments = [...formData.attachments];
    newAttachments.splice(index, 1);
    setFormData({
      ...formData,
      attachments: newAttachments
    });
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">处理记录</h3>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  处理人 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.handler}
                  onChange={(e) => setFormData({ ...formData, handler: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入处理人姓名"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  处理时间
                </label>
                <input
                  type="datetime-local"
                  value={formData.handled_at}
                  onChange={(e) => setFormData({ ...formData, handled_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                附件
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                multiple
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formData.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {formData.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-200">
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '提交'}
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
                        <span className="font-medium">{log.handler}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        <span>{formatDateTime(log.handled_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-gray-800 whitespace-pre-wrap mb-2">
                    {log.content}
                  </div>

                  {/* 附件 */}
                  {log.attachments && log.attachments.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <PaperClipIcon className="h-4 w-4 mr-1" />
                        <span>附件 ({log.attachments.length})</span>
                      </div>
                      <div className="space-y-1">
                        {log.attachments.map((url, idx) => {
                          const filename = url.split('/').pop() || `附件${idx + 1}`;
                          return (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              📎 {filename}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IssueLogTimeline;
