import React, { useState } from 'react';
import { ArrowUpTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { testTaskApi } from '../services/api';

interface TestSummaryFormProps {
  taskId: number;
  onSubmitted: () => void;
}

const TestSummaryForm: React.FC<TestSummaryFormProps> = ({ taskId, onSubmitted }) => {
  const [testSummary, setTestSummary] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    if (e.target) e.target.value = '';
  };

  const removeFile = (idx: number) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!testSummary.trim()) { alert('请填写测试总结'); return; }
    if (pendingFiles.length === 0) { alert('请上传至少一份《测试反馈单》附件'); return; }

    setSubmitting(true);
    setMsg('');
    try {
      // 上传反馈单附件
      const fd = new FormData();
      fd.append('category', '测试反馈单');
      pendingFiles.forEach(f => fd.append('files', f));
      const upRes = await testTaskApi.uploadAttachments(taskId, fd);
      if (!upRes.success) throw new Error(upRes.error);

      // 提交总结
      const res = await testTaskApi.submitSummary(taskId, { test_summary: testSummary });
      if (!res.success) throw new Error(res.error);

      setMsg('测试总结提交成功，任务已进入「已测试」');
      setTestSummary('');
      setPendingFiles([]);
      setUploadedCount(0);
      onSubmitted();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (uploadedCount) return <div className="text-sm text-gray-500">正在上传附件 {uploadedCount}...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">提交测试总结（上海）</h2>

      {msg && <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">{msg}</div>}

      <label className="block text-sm text-gray-600 mb-1">测试总结 <span className="text-red-500">*</span></label>
      <textarea
        value={testSummary}
        onChange={e => setTestSummary(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="填写测试结果、结论与说明..."
      />

      <div className="mt-4">
        <label className="block text-sm text-gray-600 mb-1">《测试反馈单》附件 <span className="text-red-500">*</span></label>
        <label className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
          <ArrowUpTrayIcon className="h-4 w-4 mr-1" /> 选择文件
          <input type="file" multiple className="hidden" onChange={addFiles} />
        </label>
        {pendingFiles.length > 0 && (
          <ul className="mt-2 space-y-1">
            {pendingFiles.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-sm text-gray-700 border border-gray-200 rounded px-2 py-1">
                <span className="truncate">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-600 ml-2">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircleIcon className="h-4 w-4 mr-1" />
          {submitting ? '提交中...' : '提交总结'}
        </button>
      </div>
    </div>
  );
};

export default TestSummaryForm;
