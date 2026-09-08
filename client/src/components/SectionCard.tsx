import React from 'react';

interface SectionCardProps {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * 详情页通用区块卡片，与设备详情页保持一致的配色：
 * bg-white / rounded-lg / shadow（深色下自动转为深色表面）
 */
export default function SectionCard({ title, extra, children, className }: SectionCardProps) {
  return (
    <div className={`bg-card rounded-2xl border border-border shadow-soft p-4 3xl:p-6 mb-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {extra && <div className="flex items-center gap-2">{extra}</div>}
      </div>
      {children}
    </div>
  );
}
