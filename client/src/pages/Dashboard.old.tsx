import React, { useState, useEffect } from 'react';
import { 
  DevicePhoneMobileIcon, 
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { dashboardApi } from '../services/api';
import { DashboardStats } from '../types';
import Layout from '../components/Layout';
import StatsCard from '../components/StatsCard';
import DeviceTypeChart from '../components/DeviceTypeChart';
import LocationStatsChart from '../components/LocationStatsChart';
import DataTable from '../components/DataTable';
import { formatDate, getStatusColor, getSeverityColor, getDeviceTypeColor } from '../utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">无法加载仪表盘数据</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard
            title="设备总数"
            value={stats.basicStats.total_devices}
            icon={<DevicePhoneMobileIcon className="h-6 w-6" />}
            color="blue"
          />
          <StatsCard
            title="待解决问题"
            value={stats.basicStats.open_issues}
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
            color="red"
          />
          <StatsCard
            title="本月已解决"
            value={stats.basicStats.resolved_this_month}
            icon={<DocumentTextIcon className="h-6 w-6" />}
            color="purple"
          />
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 设备状态分布 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">设备状态分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.deviceStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {stats.deviceStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 问题严重性分布 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">问题严重性分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.issueSeverityDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="severity" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 新增：设备类型和位置统计 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DeviceTypeChart data={stats.deviceTypeDistribution} />
          <LocationStatsChart data={stats.locationStats} />
        </div>

        {/* 月度趋势 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">月度趋势</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={stats.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="数量"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 最近活动 */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">最近活动</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {stats.recentActivities.map((activity, index) => (
              <div key={index} className="px-6 py-4 flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <ClockIcon className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {activity.action} - {formatDate(activity.timestamp)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    activity.type === 'device' ? 'bg-blue-100 text-blue-800' :
                    activity.type === 'issue' ? 'bg-red-100 text-red-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {activity.type === 'device' ? '设备' :
                     activity.type === 'issue' ? '问题' : '版本'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
