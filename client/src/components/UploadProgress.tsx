import React from 'react';

interface UploadProgressProps {
  /** 0-100 百分比 */
  progress: number;
  /** 前缀文字，默认“上传中” */
  label?: string;
  className?: string;
}

/** 上传进度条：细条动画 + 百分比文字，用于大文件（视频等）上传反馈 */
const UploadProgress: React.FC<UploadProgressProps> = ({ progress, label = '上传中', className = '' }) => {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between text-xs text-primary-600 mb-1">
        <span>{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default UploadProgress;
