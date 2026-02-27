# Issue Tracking

**Capability**: issue-tracking  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

问题跟踪系统负责管理设备在使用过程中出现的故障和问题，支持问题报修、分配、处理和关闭的完整流程。

## Requirements

### Requirement: 问题报修管理
系统应支持问题的创建、查询、更新和关闭操作。

#### Scenario: 创建问题报修单
- **WHEN** 用户报修设备故障
- **THEN** 系统应创建问题记录
- **AND** 记录故障设备、问题描述、严重性等级等信息
- **AND** 默认状态为"待处理"

#### Scenario: 查询问题列表
- **WHEN** 用户访问问题列表页面
- **THEN** 系统应返回所有问题
- **AND** 支持按设备、状态、严重性、跟进人筛选
- **AND** 显示设备编号、问题描述、严重性、状态、跟进人等信息

#### Scenario: 查看问题详情
- **WHEN** 用户点击查看问题详情
- **THEN** 系统应显示问题的完整信息
- **AND** 显示关联设备的详细信息
- **AND** 显示问题处理日志

### Requirement: 问题严重性等级
系统应支持三级严重性等级分类。

#### Scenario: 严重性等级枚举
- **WHEN** 用户设置问题严重性
- **THEN** 严重性必须是以下之一：低、中、高

#### Scenario: 高优先级问题标识
- **WHEN** 问题严重性为"高"
- **THEN** 系统应在列表中高亮显示
- **AND** 在仪表盘中优先展示

### Requirement: 问题状态流转
系统应支持问题状态的流转管理。

#### Scenario: 问题状态枚举
- **WHEN** 用户更新问题状态
- **THEN** 状态必须是以下之一：待处理、处理中、已解决

#### Scenario: 分配问题跟进人
- **WHEN** 问题从"待处理"转为"处理中"
- **THEN** 系统应要求分配跟进人
- **AND** 记录分配时间

#### Scenario: 关闭问题
- **WHEN** 问题解决后标记为"已解决"
- **THEN** 系统应记录解决时间
- **AND** 可选填写解决方案

### Requirement: 问题处理日志
系统应记录问题处理过程中的所有操作日志。

#### Scenario: 添加处理日志
- **WHEN** 用户添加处理进展或备注
- **THEN** 系统应创建日志记录
- **AND** 记录操作人、操作时间、日志内容

#### Scenario: 查看处理历史
- **WHEN** 用户查看问题详情
- **THEN** 系统应显示所有处理日志
- **AND** 按时间倒序排列

## Implementation

### Backend
- **Routes**: `server/routes/issues.js` - 问题 CRUD API
- **Routes**: `server/routes/issue-logs.js` - 问题日志 API

### Frontend
- **Pages**: `client/src/pages/Issues.tsx` - 问题列表页
- **Pages**: `client/src/pages/IssueDetail.tsx` - 问题详情页

### Database
- **Tables**: `issues` - 问题表
- **Tables**: `issue_logs` - 问题日志表
- **Foreign Key**: `issues.device_id` → `devices.id`

## Related Specs
- [device-management](../device-management/spec.md) - 问题关联设备
- [after-sales](../after-sales/spec.md) - 售后服务集成
