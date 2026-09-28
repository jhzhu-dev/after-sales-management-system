import React, { useState, useEffect } from 'react';
import {
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PrinterIcon,
  FolderOpenIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { DashboardStats } from '../types';
import Layout from '../components/Layout';
import StatsCard from '../components/StatsCard';
import ChartCard from '../components/ChartCard';
import StackedBarChart from '../components/StackedBarChart';
import ActionList, { ActionListItem } from '../components/ActionList';
import { formatDate, useIs1080p } from '../utils';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
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
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const severityBarColor = (severity: string) => {
  const map: Record<string, string> = {
    low: '#22C55E', medium: '#F59E0B', high: '#EF4444',
    低: '#22C55E', 中: '#F59E0B', 高: '#EF4444',
  };
  return map[severity] || '#EF4444';
};

// 通用徽章映射
const badgeMap: Record<string, { text: string; className: string }> = {
  待处理: { text: '待处理', className: 'bg-red-100 text-red-800' },
  处理中: { text: '处理中', className: 'bg-yellow-100 text-yellow-800' },
  已解决: { text: '已解决', className: 'bg-green-100 text-green-800' },
  低: { text: '低', className: 'bg-green-100 text-green-800' },
  中: { text: '中', className: 'bg-yellow-100 text-yellow-800' },
  高: { text: '高', className: 'bg-red-100 text-red-800' },
  测试中: { text: '测试中', className: 'bg-blue-100 text-blue-800' },
  已测试: { text: '已测试', className: 'bg-purple-100 text-purple-800' },
  通过: { text: '通过', className: 'bg-green-100 text-green-800' },
  不通过: { text: '不通过', className: 'bg-red-100 text-red-800' },
};
const getBadge = (text: string) => badgeMap[text] || { text, className: 'bg-gray-100 text-gray-800' };

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const is1080p = useIs1080p();
  const chartHeight = is1080p ? 220 : 280;
  const pieRadius = is1080p ? 80 : 100;
  const [expandedSections, setExpandedSections] = useState({
    issues: true,
    devices: true,
    releases: false,
    pipeline: false,
    kb: false,
    activities: true,
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
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4 3xl:space-y-6">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 3xl:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border shadow-soft p-4 3xl:p-6">
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

  const kpiCards = [
    { title: '待处理问题', value: stats.kpi.open_issues, icon: <ExclamationTriangleIcon className="h-6 w-6" />, color: 'red' as const },
    { title: '未结高严重度', value: stats.kpi.high_open_issues, icon: <ExclamationTriangleIcon className="h-6 w-6" />, color: 'red' as const },
    { title: '本月新增问题', value: stats.kpi.issues_created_this_month, icon: <DocumentTextIcon className="h-6 w-6" />, color: 'blue' as const },
    { title: '本月已解决', value: stats.kpi.issues_resolved_this_month, icon: <DocumentTextIcon className="h-6 w-6" />, color: 'green' as const },
    { title: '设备总数', value: stats.kpi.total_devices, icon: <DevicePhoneMobileIcon className="h-6 w-6" />, color: 'blue' as const },
    { title: '使用中异常', value: stats.kpi.abnormal_devices, icon: <ExclamationTriangleIcon className="h-6 w-6" />, color: 'yellow' as const },
    { title: '进行中需求', value: stats.kpi.active_requirements, icon: <FolderOpenIcon className="h-6 w-6" />, color: 'purple' as const },
    { title: '进行中测试', value: stats.kpi.active_tasks, icon: <BeakerIcon className="h-6 w-6" />, color: 'purple' as const },
  ];

  const highIssueItems: ActionListItem[] = stats.latestHighIssues.map((i) => ({
    id: i.id,
    title: i.description,
    subtitle: i.device_name ? `设备：${i.device_name}` : '未关联设备',
    meta: formatDate(i.created_at, 'yyyy-MM-dd'),
    badge: { text: '高', className: 'bg-red-100 text-red-800' },
    onClick: () => navigate(`/issues/${i.id}`),
  }));

  const abnormalItems: ActionListItem[] = stats.abnormalDevices.map((d) => ({
    id: d.id,
    title: d.name || d.id,
    subtitle: d.customer,
    badge: { text: '异常', className: 'bg-red-100 text-red-800' },
    onClick: () => navigate(`/devices/${d.id}`),
  }));

  const releaseItems: ActionListItem[] = stats.latestReleases.map((r) => ({
    id: r.id,
    title: `${r.version_number} · ${r.title}`,
    subtitle: r.module_type_name,
    meta: r.category || '',
    onClick: () => navigate('/releases'),
  }));

  const requirementItems: ActionListItem[] = stats.activeRequirements.map((r) => ({
    id: r.id,
    title: `${r.req_code} · ${r.customer_name}`,
    subtitle: r.description,
    badge: getBadge(r.urgency),
    onClick: () => navigate(`/customer-requirements/${r.id}`),
  }));

  const taskItems: ActionListItem[] = stats.activeTasks.map((t) => ({
    id: t.id,
    title: `${t.task_code} · ${t.model_name || ''}`,
    subtitle: t.product_name,
    badge: getBadge(t.status),
    onClick: () => navigate(`/test-tasks/${t.id}`),
  }));

  const allActivities: ActionListItem[] = stats.recentActivities.map((a) => ({
    id: `${a.type}-${a.id}`,
    title: a.name,
    subtitle: `${a.action} · ${formatDate(a.timestamp)}`,
    badge: getBadge(activityBadgeText(a.type)),
  }));

  function activityBadgeText(type: string) {
    const map: Record<string, string> = {
      issue: '问题', requirement: '需求', task: '测试', release: '发布',
      upgrade: '升级', kb: '知识',
    };
    return map[type] || type;
  }

  const sectionHeader = (title: string, key: keyof typeof expandedSections) => (
    <Button
      variant="ghost"
      className="w-full justify-between px-0 py-0 mb-4 h-auto"
      onClick={() => toggleSection(key)}
    >
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {expandedSections[key] ? (
        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
      ) : (
        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
      )}
    </Button>
  );

  return (
    <Layout>
      <div className="space-y-4 3xl:space-y-6">
        {/* 打印专用页眉 */}
        <div className="hidden print:block print-header">
          <h1 style={{ fontSize: '13pt', fontWeight: '800', margin: 0 }}>系统运营中心</h1>
          <p style={{ fontSize: '8pt', color: '#6b7280', marginTop: '2pt' }}>
            打印时间：{new Date().toLocaleString('zh-CN')}
          </p>
        </div>

        {/* 页面标题 */}
        <div className="flex items-center justify-between h-10 print:hidden">
          <div>
            <h1 className="text-2xl 3xl:text-3xl font-bold text-gray-900">运营中心</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <PrinterIcon className="h-4 w-4" />
            打印
          </Button>
        </div>

        {/* 1. 关键指标卡片 */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 3xl:gap-6">
            {kpiCards.map((card) => (
              <StatsCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
              />
            ))}
          </div>
        </section>

        {/* 2. 售后问题工作台 */}
        <section>
          {sectionHeader('售后问题工作台', 'issues')}
          {expandedSections.issues && (
            <>
              <div className="mb-4">
                <ChartCard title="月度问题 新增 vs 已解决" description="近12个月售后问题吞吐（新增与解决对比）">
                  <StackedBarChart
                    data={stats.issueMonthly}
                    xKey="month"
                    series={[
                      { key: 'created', name: '新增', color: '#3B82F6' },
                      { key: 'resolved', name: '已解决', color: '#10B981' },
                    ]}
                    height={chartHeight}
                  />
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 3xl:gap-6">
                <ChartCard title="问题状态分布" description="处理进度统计">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.issueStatusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="问题严重度分布" description="按紧急程度分类统计">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.issueSeverityDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="severity" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {stats.issueSeverityDistribution.map((entry: any, index: number) => (
                          <Cell key={index} fill={severityBarColor(entry.severity)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="问题分类分布" description="硬件 / 软件 / 安装调试等">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.issueCategoryDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 3xl:gap-6 mt-4">
                <ChartCard title="最新高严重度问题" description="未关闭且高严重度，优先处理">
                  <ActionList items={highIssueItems} emptyText="暂无高严重度待办" />
                </ChartCard>
              </div>
            </>
          )}
        </section>

        {/* 3. 设备健康与分布 */}
        <section>
          {sectionHeader('设备健康与分布', 'devices')}
          {expandedSections.devices && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 3xl:gap-6">
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

              <ChartCard title="设备按客户分布 Top10" description="设备保有量最高的客户">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={stats.deviceCustomerDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="customer" width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="设备按产品线分布" description="各产品线设备数量">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={stats.deviceProductLineDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="line" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="设备型号数量分析" description="各型号（产品名称）设备保有量 Top15（含多合一成员设备）">
                <ResponsiveContainer width="100%" height={Math.max(chartHeight, 360)}>
                  <BarChart
                    data={[...(stats.deviceModelDistribution || [])].sort((a, b) => a.count - b.count)}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="model"
                      width={170}
                      interval={0}
                      tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 14) + '…' : v)}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="异常设备清单" description="使用中(异常) 的设备，需跟进">
                <ActionList items={abnormalItems} emptyText="当前无异常设备" />
              </ChartCard>
            </div>
          )}
        </section>

        {/* 4. 版本发布库 */}
        <section>
          {sectionHeader('版本发布库', 'releases')}
          {expandedSections.releases && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 3xl:gap-6">
              <ChartCard title="版本发布按产品/类型分布" description="版本发布库分类统计" className="h-full">
                <div className="h-full min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...stats.releaseCategoryDistribution].sort((a: any, b: any) => b.count - a.count)}
                      layout="vertical"
                      margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="category"
                        width={150}
                        tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 10) + '…' : v)}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8B5CF6" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="最新版本发布" description="最近发布的版本">
                <ActionList items={releaseItems} emptyText="暂无发布" />
              </ChartCard>
            </div>
          )}
        </section>

        {/* 5. 需求与测试管线 */}
        <section>
          {sectionHeader('需求与测试管线', 'pipeline')}
          {expandedSections.pipeline && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 3xl:gap-6">
                <ChartCard title="需求状态分布" description="客户需求当前阶段">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.requirementStatusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="需求类型分布" description="接口/功能/输出定制">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.requirementTypeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="需求紧急度分布" description="低 / 中 / 高">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.requirementUrgencyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="urgency" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {stats.requirementUrgencyDistribution.map((entry: any, index: number) => (
                          <Cell key={index} fill={severityBarColor(entry.urgency)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 3xl:gap-6 mt-4">
                <ChartCard title="测试任务状态分布" description="测试中 / 已测试 / 通过 / 不通过">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.taskStatusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#14B8A6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="测试任务优先级分布" description="低 / 中 / 高">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.taskPriorityDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="priority" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {stats.taskPriorityDistribution.map((entry: any, index: number) => (
                          <Cell key={index} fill={severityBarColor(entry.priority)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="测试升级决策分布" description="待定 / 升级 / 不升级">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={stats.taskDecisionDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="decision" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 3xl:gap-6 mt-4">
                <ChartCard title="进行中需求" description="尚未发布/废弃的需求">
                  <ActionList items={requirementItems} emptyText="暂无进行中需求" />
                </ChartCard>
                <ChartCard title="进行中测试任务" description="测试中或已测试待决策">
                  <ActionList items={taskItems} emptyText="暂无进行中测试" />
                </ChartCard>
              </div>
            </>
          )}
        </section>

        {/* 6. 知识库 */}
        <section>
          {sectionHeader('运维知识库', 'kb')}
          {expandedSections.kb && (
            <ChartCard title="知识库分类分布" description="文章数 / 阅读次数 / 有帮助数">
              {stats.kbCategoryDistribution.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-4">分类</th>
                        <th className="py-2 pr-4">文章数</th>
                        <th className="py-2 pr-4">阅读次数</th>
                        <th className="py-2">有帮助</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.kbCategoryDistribution.map((row) => (
                        <tr key={row.category} className="border-b border-border">
                          <td className="py-2 pr-4 font-medium text-foreground">{row.category}</td>
                          <td className="py-2 pr-4">{row.count}</td>
                          <td className="py-2 pr-4">{row.views}</td>
                          <td className="py-2">{row.helpful}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">暂无知识库数据</div>
              )}
            </ChartCard>
          )}
        </section>

        {/* 7. 最近动态 */}
        <section>
          {sectionHeader('最近动态', 'activities')}
          {expandedSections.activities && (
            <Card className="overflow-hidden">
              <ActionList items={allActivities} emptyText="暂无最近活动" />
            </Card>
          )}
        </section>
      </div>
    </Layout>
  );
}
