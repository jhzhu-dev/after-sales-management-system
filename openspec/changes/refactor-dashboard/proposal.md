## Why

当前仪表盘「设备中心」导向，数据实用性低：
- 核心指标只有 `设备总数 / 待解决问题 / 版本类型 / 本月已解决`，其中 `版本类型`（`COUNT(DISTINCT version_type)`）恒为 2，无信息量；`本月已解决` 用 `updated_at` 且是滚动 30 天而非自然月，口径错误。
- 大量高价值数据未被呈现：**版本发布库（164 条）**、**客户需求（2）**、**测试任务（1）**、**知识库（4）**、**多合一设备（45）**、**客户（87）** 等都被忽略。
- 动态流只覆盖 设备/问题/模块版本 三类，未包含 需求/测试/发布/升级/知识库。
- `device_upgrades` 当前 0 行，但仪表盘仍保留"升级"维度，占用空间。

需要把仪表盘重构为**运营驾驶舱**，聚焦「售后问题吞吐、设备健康、需求/测试管线、版本发布」等真正能指导工作的数据。

## What Changes

**后端 `server/routes/dashboard.js`**
- 重构 `/api/dashboard/stats`：返回结构化数据（KPI + 分布 + 趋势 + 动态），修正口径：
  - `resolved_this_month` 改用 `resolved_at` + 自然月；
  - 去掉无用的 `version_types`；
  - 新增按月「新增 vs 解决」、问题分类/负责人负载、需求管线段、测试任务、版本发布分布等。
- 可选拆分：新增 `/api/dashboard/activity`（动态流，独立轻量接口）。

**前端 `client/src/pages/Dashboard.tsx`**
- 重构为分区块布局：KPI 卡片行 → 售后问题工作台 → 设备健康 → 版本发布 → 需求/测试管线 → 知识库 → 最近动态。
- 新增图表组件（堆叠条形、漏斗、列表）与「待办/关注项」列表。
- `client/src/types/index.ts` 同步 `DashboardStats`；`client/src/services/api.ts` 同步 `dashboardApi`。

## Impact

- Affected specs: 重构 `dashboard` capability spec。
- Affected code:
  - `server/routes/dashboard.js`（重构 stats 查询）
  - `client/src/pages/Dashboard.tsx`（重构布局与图表）
  - `client/src/types/index.ts`（`DashboardStats` 类型重定义）
  - `client/src/services/api.ts`（`dashboardApi` 方法）
  - 可复用现有 `StatsCard / ChartCard / ProductLineChart` 组件；新增 1-2 个图表/列表组件
- 数据库：**无变更**，仅读取现有数据（零破坏性）。
- API：`/api/dashboard/stats` 返回结构变更（前端同步适配）；不影响其他业务接口。
