import React, { useEffect } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

export interface Attachment {
  name: string;
  url: string;
  ossPath?: string;
  size?: number;
}

interface AttachmentViewerProps {
  attachments: Attachment[];
  initialIndex: number;
  onClose: () => void;
}

function getFileType(name: string): 'image' | 'pdf' | 'video' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'm4v'].includes(ext)) return 'video';
  return 'other';
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachments, initialIndex, onClose }) => {
  const [index, setIndex] = React.useState(initialIndex);
  const att = attachments[index];
  const fileType: 'image' | 'pdf' | 'video' | 'other' = getFileType(att.name);

  // Close on Escape, navigate with arrow keys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, attachments.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [attachments.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-75" />

      {/* Modal */}
      <div
        className="relative z-10 flex flex-col bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-medium text-gray-900 truncate">{att.name}</span>
            {att.size && <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(att.size)}</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {attachments.length > 1 && (
              <span className="text-sm text-gray-500">{index + 1} / {attachments.length}</span>
            )}
            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="在新标签页打开"
            >
              <ArrowTopRightOnSquareIcon className="h-5 w-5" />
            </a>
            <a
              href={att.url}
              download={att.name}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="下载"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-50 rounded-b-xl" style={{ minHeight: '300px' }}>
          {fileType === 'image' && (
            <img
              src={att.url}
              alt={att.name}
              className="max-w-full max-h-full object-contain rounded"
              style={{ maxHeight: 'calc(90vh - 120px)' }}
            />
          )}
          {fileType === 'pdf' && (
            <iframe
              src={att.url}
              title={att.name}
              className="w-full rounded border"
              style={{ height: 'calc(90vh - 120px)' }}
            />
          )}
          {fileType === 'video' && (
            <video
              key={att.url}
              src={att.url}
              controls
              className="max-w-full rounded"
              style={{ maxHeight: 'calc(90vh - 120px)' }}
            >
              您的浏览器不支持视频播放
            </video>
          )}
          {fileType === 'other' && (
            <div className="text-center py-16">
              <div className="text-gray-300 text-7xl mb-4">📄</div>
              <p className="text-gray-600 mb-2 font-medium">{att.name}</p>
              <p className="text-gray-400 text-sm mb-6">该文件类型不支持预览</p>
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                在新标签页打开
              </a>
            </div>
          )}
        </div>

        {/* Navigation */}
        {attachments.length > 1 && (
          <div className="flex justify-center gap-3 py-3 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={() => setIndex(i => Math.max(i - 1, 0))}
              disabled={index === 0}
              className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              ← 上一个
            </button>
            <div className="flex gap-1.5 items-center">
              {attachments.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`}
                />
              ))}
            </div>
            <button
              onClick={() => setIndex(i => Math.min(i + 1, attachments.length - 1))}
              disabled={index === attachments.length - 1}
              className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              下一个 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttachmentViewer;
