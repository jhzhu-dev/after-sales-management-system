import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { useIs1080p } from '../utils';

interface LocationData {
  location: string;
  total: number;
  normal: number;
  abnormal: number;
  maintenance: number;
}

interface LocationStatsChartProps {
  data: LocationData[];
}

const LocationStatsChart: React.FC<LocationStatsChartProps> = React.memo(({ data }) => {
  const is1080p = useIs1080p();
  const chartHeight = is1080p ? 240 : 300;
  if (!data || data.length === 0) {
    return (
      <ChartCard title="位置统计" description="按位置统计设备数量和状态分布">
        <div className="flex items-center justify-center h-64 text-gray-500">
          暂无数据
        </div>
      </ChartCard>
    );
  }

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 border border-gray-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              总数: <span className="font-medium">{payload[0].payload.total}</span>
            </p>
            <p className="text-sm text-green-600">
              正常: <span className="font-medium">{payload[0].payload.normal}</span>
            </p>
            <p className="text-sm text-red-600">
              异常: <span className="font-medium">{payload[0].payload.abnormal}</span>
            </p>
            <p className="text-sm text-yellow-600">
              维护中: <span className="font-medium">{payload[0].payload.maintenance}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartCard title="位置统计" description="按位置统计设备数量和状态分布">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="location" 
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="normal" name="正常" fill="#10B981" stackId="a" />
          <Bar dataKey="abnormal" name="异常" fill="#EF4444" stackId="a" />
          <Bar dataKey="maintenance" name="维护中" fill="#F59E0B" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
});

LocationStatsChart.displayName = 'LocationStatsChart';

export default LocationStatsChart;
