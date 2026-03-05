import React, { useState, useEffect } from 'react';
import { 
  DevicePhoneMobileIcon, 
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
import { dashboardApi } from '../services/api';
import { DashboardStats } from '../types';
import Layout from '../components/Layout';
import StatsCard from '../components/StatsCard';
import ProductLineChart from '../components/ProductLineChart';
import ChartCard from '../components/ChartCard';
import { formatDate } from '../utils';
import { useIs1080p } from '../utils';
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
  const is1080p = useIs1080p();
  const chartHeight = is1080p ? 240 : 300;
  const largeChartHeight = is1080p ? 280 : 400;
  const pieRadius = is1080p ? 80 : 100;
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    distribution: true,
    trends: false,
    activities: true
  });

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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4 3xl:space-y-6">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 3xl:gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-4 3xl:p-6">
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
      <div className="space-y-4 3xl:space-y-6">
        {/* 打印专用页眉 */}
        <div className="hidden print:block print-header">
          <h1 style={{fontSize:'13pt',fontWeight:'800',margin:0}}>系统仪表盘</h1>
          <p style={{fontSize:'8pt',color:'#6b7280',marginTop:'2pt'}}>打印时间：{new Date().toLocaleString('zh-CN')}</p>
        </div>

        {/* 页面标题 */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl 3xl:text-3xl font-bold text-gray-900">系统仪表盘</h1>
            <p className="mt-1 text-sm text-gray-600">实时监控系统运行状态和关键指标</p>
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <PrinterIcon className="h-4 w-4 mr-2" />
            打印
          </button>
        </div>

        {/* 核心指标卡片 */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 3xl:gap-6">
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
              color="green"
            />
            <StatsCard
              title="版本类型"
              value={stats.basicStats.version_types}
              icon={<ClockIcon className="h-6 w-6" />}
              color="purple"
            />
          </div>
        </section>

        {/* 设备分布统计 */}
        <section>
          <button
            onClick={() => toggleSection('distribution')}
            className="w-full flex items-center justify-between mb-4 text-left"
          >
            <h2 className="text-xl font-semibold text-gray-900">设备分布统计</h2>
            {expandedSections.distribution ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            )}
          </button>
          
          {expandedSections.distribution && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 3xl:gap-6">
              {/* 产品线分布 */}
              <ProductLineChart data={stats.deviceTypeDistribution} />

              {/* 设备状态分布 */}
              <ChartCard title="设备状态分布" description="设备当前运行状态统计">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <PieChart>
                    <Pie
                      data={stats.deviceStatusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, count }) => `${status}: ${count}`}
                      outerRadius={pieRadius}
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
              </ChartCard>

              {/* 问题严重性分布 */}
              <ChartCard title="问题严重性分布" description="按严重程度分类统计">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={stats.issueSeverityDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="severity" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* 问题状态分布 */}
              <ChartCard title="问题状态分布" description="问题处理进度统计">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={stats.issueStatusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

            </div>
          )}
        </section>

        {/* 趋势分析 */}
        <section>
          <button
            onClick={() => toggleSection('trends')}
            className="w-full flex items-center justify-between mb-4 text-left"
          >
            <h2 className="text-xl font-semibold text-gray-900">趋势分析</h2>
            {expandedSections.trends ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            )}
          </button>

          {expandedSections.trends && (
            <ChartCard title="月度活动趋势" description="过去12个月的系统活动统计">
              <ResponsiveContainer width="100%" height={largeChartHeight}>
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
            </ChartCard>
          )}
        </section>

        {/* 最近活动 */}
        <section>
          <button
            onClick={() => toggleSection('activities')}
            className="w-full flex items-center justify-between mb-4 text-left"
          >
            <h2 className="text-xl font-semibold text-gray-900">最近活动</h2>
            {expandedSections.activities ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            )}
          </button>

          {expandedSections.activities && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="divide-y divide-gray-200">
                {stats.recentActivities.length > 0 ? (
                  stats.recentActivities.map((activity, index) => (
                    <div key={index} className="px-4 py-3 3xl:px-6 3xl:py-4 flex items-center space-x-4 hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          activity.type === 'device' ? 'bg-blue-100' :
                          activity.type === 'issue' ? 'bg-red-100' :
                          'bg-green-100'
                        }`}>
                          <ClockIcon className={`h-5 w-5 ${
                            activity.type === 'device' ? 'text-blue-600' :
                            activity.type === 'issue' ? 'text-red-600' :
                            'text-green-600'
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {activity.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {activity.action} · {formatDate(activity.timestamp)}
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
                  ))
                ) : (
                  <div className="px-4 py-8 3xl:px-6 3xl:py-12 text-center text-gray-500">
                    暂无最近活动
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
