# After Sales

**Capability**: after-sales  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

售后服务系统提供设备售后管理的统一入口，整合问题报修、设备升级、文档管理等售后相关功能。

## Requirements

### Requirement: 统一售后中心
系统应提供统一的售后服务入口页面。

#### Scenario: 售后概览看板
- **WHEN** 用户访问售后中心
- **THEN** 系统应显示售后服务的概览统计
- **AND** 包含待处理问题数量、处理中问题数量、最近升级记录等
- **AND** 提供快速跳转到各子功能的入口

### Requirement: 设备升级管理
系统应记录设备的硬件升级、软件更新和系统重装等升级活动。

#### Scenario: 记录设备升级
- **WHEN** 设备进行升级操作时
- **THEN** 系统应创建升级记录
- **AND** 记录升级类型（硬件升级/软件更新/系统重装）
- **AND** 记录升级内容、升级人、升级时间

#### Scenario: 查询升级历史
- **WHEN** 用户查看设备升级记录
- **THEN** 系统应返回该设备的所有升级历史
- **AND** 按时间倒序排列
- **AND** 显示升级类型、内容、执行人、时间

#### Scenario: 升级记录详情
- **WHEN** 用户点击查看升级详情
- **THEN** 系统应显示升级的完整信息
- **AND** 包含升级前后版本对比（如果适用）

### Requirement: 设备文档管理
系统应支持为具体设备上传和管理专属文档。

#### Scenario: 上传设备文档
- **WHEN** 用户为设备上传文档
- **THEN** 系统应保存文件到服务器
- **AND** 记录文档名称、类型、上传时间
- **AND** 关联到指定设备

#### Scenario: 查看设备文档列表
- **WHEN** 用户查看设备详情
- **THEN** 系统应显示该设备的所有文档
- **AND** 支持在线预览或下载

#### Scenario: 删除设备文档
- **WHEN** 用户删除设备文档
- **THEN** 系统应删除数据库记录和文件

### Requirement: 问题跟踪集成
售后中心应集成问题跟踪功能。

#### Scenario: 查看待处理问题
- **WHEN** 用户在售后中心查看问题
- **THEN** 系统应显示所有待处理和处理中的问题
- **AND** 按优先级和严重性排序

#### Scenario: 快速创建问题
- **WHEN** 用户从售后中心创建问题
- **THEN** 系统应提供简化的问题创建流程
- **AND** 支持快速选择设备和填写问题描述

## Implementation

### Backend
- **Routes**: `server/routes/after-sales.js` - 售后中心统计 API
- **Routes**: `server/routes/device-upgrades.js` - 设备升级 CRUD API
- **Routes**: `server/routes/device-documents.js` - 设备文档 API

### Frontend
- 售后功能集成在问题管理和设备详情页面中

### Database
- **Tables**: `device_upgrades` - 设备升级记录表
- **Tables**: `device_documents` - 设备文档表
- **Foreign Key**: `device_upgrades.device_id` → `devices.id`
- **Foreign Key**: `device_documents.device_id` → `devices.id`

## Related Specs
- [device-management](../device-management/spec.md) - 设备升级和文档关联
- [issue-tracking](../issue-tracking/spec.md) - 问题报修集成
