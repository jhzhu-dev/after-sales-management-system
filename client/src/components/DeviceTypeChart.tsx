import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import ChartCard from './ChartCard';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

interface DeviceTypeData {
  type: string;
  count: number;
  percentage: number;
}

interface DeviceTypeChartProps {
  data: DeviceTypeData[];
}

const DeviceTypeChart: React.FC<DeviceTypeChartProps> = React.memo(({ data }) => {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="设备类型分布" description="按设备类型统计数量和占比">
        <div className="flex items-center justify-center h-64 text-gray-500">
          暂无数据
        </div>
      </ChartCard>
    );
  }

  // 自定义标签渲染
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    if (percent < 0.05) return null; // 不显示小于5%的标签

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-sm font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = typeof data.percentage === 'number' ? data.percentage : parseFloat(data.percentage);
      return (
        <div className="bg-white px-4 py-2 border border-gray-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-gray-900">{data.type}</p>
          <p className="text-sm text-gray-600">数量: {data.count}</p>
          <p className="text-sm text-gray-600">占比: {percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartCard title="设备类型分布" description="按设备类型统计数量和占比">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="count"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry: any) => {
              const item = data.find(d => d.type === entry.payload.type);
              return `${value} (${item?.count || 0})`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
});

DeviceTypeChart.displayName = 'DeviceTypeChart';

export default DeviceTypeChart;
