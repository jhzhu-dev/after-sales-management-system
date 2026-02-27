# Dashboard

**Capability**: dashboard  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

仪表盘系统提供设备管理系统的核心统计数据和运营概览，帮助管理者快速了解系统整体状况。

## Requirements

### Requirement: 核心统计数据
系统应提供关键业务指标的实时统计。

#### Scenario: 设备统计
- **WHEN** 用户访问仪表盘
- **THEN** 系统应显示设备总数统计
- **AND** 按设备状态（正常/异常/维护中）分类统计
- **AND** 显示各产品线的设备数量分布

#### Scenario: 问题统计
- **WHEN** 用户访问仪表盘
- **THEN** 系统应显示问题总数统计
- **AND** 按问题状态（待处理/处理中/已解决）分类统计
- **AND** 按严重性等级（低/中/高）分类统计

#### Scenario: 客户统计
- **WHEN** 用户访问仪表盘
- **THEN** 系统应显示客户总数
- **AND** 显示各客户的设备数量

#### Scenario: 版本统计
- **WHEN** 用户访问仪表盘
- **THEN** 系统应显示版本发布总数
- **AND** 按模块类型统计版本数量

### Requirement: 数据可视化
系统应使用图表直观展示统计数据。

#### Scenario: 饼图展示分布
- **WHEN** 显示分类统计数据时
- **THEN** 应使用饼图或环形图展示比例
- **AND** 支持点击图表区域筛选详细数据

#### Scenario: 柱状图展示趋势
- **WHEN** 显示数量对比时
- **THEN** 应使用柱状图展示
- **AND** 支持交互式图例

#### Scenario: 卡片展示总数
- **WHEN** 显示关键指标时
- **THEN** 应使用统计卡片展示总数
- **AND** 支持点击跳转到详情页面

### Requirement: 实时数据刷新
仪表盘数据应保持实时或准实时更新。

#### Scenario: 页面加载时获取数据
- **WHEN** 用户访问仪表盘页面
- **THEN** 系统应从后端API获取最新统计数据

#### Scenario: 数据缓存策略
- **WHEN** 后端提供统计数据时
- **THEN** 可选对统计结果进行短时缓存（如1分钟）
- **AND** 减少数据库查询压力

### Requirement: 性能优化
仪表盘统计查询应进行性能优化。

#### Scenario: 优化SQL查询
- **WHEN** 执行统计查询时
- **THEN** 应使用 COUNT、GROUP BY 等聚合查询
- **AND** 避免多次单独查询

#### Scenario: 并发查询优化
- **WHEN** 仪表盘需要多个统计数据时
- **THEN** 可以使用 Promise.all 并发查询
- **AND** 减少总响应时间

## Implementation

### Backend
- **Routes**: `server/routes/dashboard.js` - 仪表盘统计 API

### Frontend
- **Pages**: `client/src/pages/Dashboard.tsx` - 仪表盘页面

### Database
- 使用聚合查询从各业务表获取统计数据
- 主要涉及表：devices, issues, customers, version_releases, product_lines

## Related Specs
- [device-management](../device-management/spec.md) - 设备统计数据源
- [issue-tracking](../issue-tracking/spec.md) - 问题统计数据源
- [customer-management](../customer-management/spec.md) - 客户统计数据源
- [release-management](../release-management/spec.md) - 版本统计数据源
