import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface StackedBarSeries {
  key: string;
  name: string;
  color: string;
}

interface StackedBarChartProps {
  data: any[];
  xKey: string;
  series: StackedBarSeries[];
  height?: number;
  emptyText?: string;
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  xKey,
  series,
  height = 260,
  emptyText = '暂无数据',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center w-full" style={{ height }}>
        <span className="text-gray-500">{emptyText}</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default StackedBarChart;
