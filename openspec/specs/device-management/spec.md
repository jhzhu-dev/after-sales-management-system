# Device Management

**Capability**: device-management  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

设备管理系统负责管理公司生产的所有设备的全生命周期信息，包括设备基本信息、模块配置、子模块版本追踪等。

## Requirements

### Requirement: 设备信息管理
系统应支持设备的完整生命周期管理，包括录入、查询、更新和删除操作。

#### Scenario: 创建新设备
- **WHEN** 用户提交包含设备编号、产品线、客户、位置的设备信息
- **THEN** 系统应创建设备记录并返回设备ID
- **AND** 设备编号必须唯一

#### Scenario: 查询设备列表
- **WHEN** 用户访问设备列表页面
- **THEN** 系统应返回所有设备的列表
- **AND** 支持按产品线、客户、状态筛选
- **AND** 显示设备编号、产品线、客户、位置、状态等信息

#### Scenario: 更新设备信息
- **WHEN** 用户修改设备的位置、状态或其他属性
- **THEN** 系统应更新设备记录
- **AND** 记录更新时间

#### Scenario: 删除设备
- **WHEN** 用户删除设备
- **THEN** 系统应检查设备是否有关联的模块或问题记录
- **AND** 如果有关联数据则禁止删除或级联删除

### Requirement: 模块配置管理
系统应支持为设备配置各类模块（机械、电气、上位机、服务器、视觉等）。

#### Scenario: 为设备添加模块
- **WHEN** 用户为设备添加新模块
- **THEN** 系统应创建模块记录并关联到设备
- **AND** 记录模块类型、名称、描述等信息

#### Scenario: 查看设备模块列表
- **WHEN** 用户查看设备详情
- **THEN** 系统应显示该设备的所有模块
- **AND** 按模块类型分组显示

#### Scenario: 更新模块信息
- **WHEN** 用户修改模块的名称或描述
- **THEN** 系统应更新模块记录

### Requirement: 子模块版本管理
系统应追踪每个子模块的出厂版本和当前版本信息。

#### Scenario: 记录子模块出厂版本
- **WHEN** 设备出厂时记录子模块版本
- **THEN** 系统应保存 factory_version
- **AND** 初始的 current_version 与 factory_version 相同

#### Scenario: 更新子模块当前版本
- **WHEN** 子模块进行版本升级
- **THEN** 系统应更新 current_version
- **AND** 保持 factory_version 不变
- **AND** 记录更新时间和更新人

#### Scenario: 查看版本历史
- **WHEN** 用户查看子模块版本信息
- **THEN** 系统应显示出厂版本和当前版本
- **AND** 标识版本是否已更新

### Requirement: 设备状态管理
系统应支持设备状态的实时更新和追踪。

#### Scenario: 设备状态枚举
- **WHEN** 用户设置或查看设备状态
- **THEN** 状态必须是以下之一：正常、异常、维护中

#### Scenario: 状态自动推断
- **WHEN** 设备有未解决的高优先级问题
- **THEN** 系统应在仪表盘标识设备状态为异常

## Implementation

### Backend
- **Routes**: `server/routes/devices.js` - 设备 CRUD API
- **Routes**: `server/routes/modules.js` - 模块 CRUD API
- **Routes**: `server/routes/versions.js` - 版本查询 API

### Frontend
- **Pages**: `client/src/pages/Devices.tsx` - 设备列表页
- **Pages**: `client/src/pages/DeviceDetail.tsx` - 设备详情页

### Database
- **Tables**: `devices` - 设备主表
- **Tables**: `modules` - 模块表
- **Tables**: `submodules` - 子模块表
- **Tables**: `submodule_versions` - 子模块版本表
- **Tables**: `module_versions` - 模块版本表

## Related Specs
- [module-types](../module-types/spec.md) - 模块类型定义
- [product-management](../product-management/spec.md) - 产品线关联
- [customer-management](../customer-management/spec.md) - 客户关联
- [issue-tracking](../issue-tracking/spec.md) - 问题关联
