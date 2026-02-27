# SOP Management

**Capability**: sop-management  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

SOP（标准作业程序）管理系统为生产流程的各个阶段提供标准检查清单模板，确保作业流程的规范化和可追溯性。

## Requirements

### Requirement: SOP模板管理
系统应支持为不同生产阶段定义SOP检查清单模板。

#### Scenario: 创建SOP模板
- **WHEN** 管理员创建新的SOP模板
- **THEN** 系统应保存模板名称、阶段、检查项列表
- **AND** 每个检查项包含项目名称、检查标准、是否必填

#### Scenario: 查询SOP模板
- **WHEN** 用户在生产流程中需要SOP检查清单
- **THEN** 系统应返回对应阶段的SOP模板

#### Scenario: 更新SOP模板
- **WHEN** 管理员修改SOP模板内容
- **THEN** 系统应更新模板
- **AND** 可选保留版本历史

#### Scenario: 删除SOP模板
- **WHEN** 管理员删除过时的SOP模板
- **THEN** 系统应删除模板记录

### Requirement: 生产阶段定义
系统应支持预定义的生产阶段分类。

#### Scenario: 标准生产阶段
- **WHEN** 系统初始化时
- **THEN** 应包含以下标准阶段：
  - 生产阶段：BOM确认、组装、测试
  - 调试阶段：烧录固件、参数校准、老化测试
  - 打包阶段：清洁、附件核对、装箱
  - 物流阶段：发货准备、物流追踪
  - 完成/售后：订单交付、售后维护

### Requirement: SOP检查执行
系统应支持在实际生产中使用SOP模板执行检查。

#### Scenario: 应用SOP模板到订单
- **WHEN** 订单进入某个生产阶段
- **THEN** 系统应自动加载该阶段的SOP模板
- **AND** 创建待检查的清单实例

#### Scenario: 执行SOP检查
- **WHEN** 操作人员执行检查项
- **THEN** 系统应记录检查结果（通过/不通过）
- **AND** 记录检查人和检查时间

#### Scenario: SOP审核
- **WHEN** 所有检查项完成后
- **THEN** 系统应提交审核
- **AND** 审核通过后自动进入下一阶段

## Implementation

### Backend
- **Routes**: `server/routes/sop-templates.js` - SOP模板 CRUD API

### Frontend
- SOP功能预留接口，前端页面待实现

### Database
- **Tables**: `sop_templates` - SOP模板表

## Related Specs
- [product-management](../product-management/spec.md) - SOP可关联产品或订单

## Notes
- 当前 SOP 功能主要提供后端 API 支持
- 前端 SOP 执行界面和订单管理集成待后续开发
