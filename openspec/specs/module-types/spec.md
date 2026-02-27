# Module Types

**Capability**: module-types  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

模块类型系统定义了设备管理系统中的标准模块分类，为设备模块配置和版本管理提供基础。

## Requirements

### Requirement: 模块类型定义
系统应支持预定义的模块类型分类体系。

#### Scenario: 标准模块类型
- **WHEN** 系统初始化时
- **THEN** 应包含以下标准模块类型：
  - 机械设备（Mechanical）
  - 电气系统（Electrical） - 包含硬件和软件
  - 上位机（HMI） - 包含硬件和软件
  - 服务器（Server） - 包含硬件和软件
  - 视觉系统（Vision） - 包含硬件和软件

#### Scenario: 模块类型属性
- **WHEN** 定义模块类型时
- **THEN** 应包含以下属性：
  - 类型名称（中文）
  - 类型代码（英文标识）
  - 描述信息
  - 是否包含软件版本
  - 是否包含硬件版本

### Requirement: 模块类型管理
系统应支持模块类型的增删改查操作。

#### Scenario: 创建模块类型
- **WHEN** 管理员创建新模块类型
- **THEN** 系统应保存模块类型信息
- **AND** 类型名称和代码必须唯一

#### Scenario: 查询模块类型列表
- **WHEN** 用户访问模块类型管理或版本发布页面
- **THEN** 系统应返回所有模块类型
- **AND** 按名称或创建时间排序

#### Scenario: 更新模块类型
- **WHEN** 管理员修改模块类型信息
- **THEN** 系统应更新记录

#### Scenario: 删除模块类型
- **WHEN** 管理员删除模块类型
- **THEN** 系统应检查是否有关联的模块或版本发布
- **AND** 如果有关联数据则禁止删除

### Requirement: 模块类型关联
模块类型应作为多个功能模块的基础数据。

#### Scenario: 设备模块关联
- **WHEN** 为设备添加模块时
- **THEN** 应从模块类型列表中选择类型

#### Scenario: 版本发布关联
- **WHEN** 发布新版本时
- **THEN** 应指定版本所属的模块类型

#### Scenario: 产品BOM关联
- **WHEN** 配置产品模块时
- **THEN** 应从模块类型列表中选择类型

## Implementation

### Backend
- **Routes**: `server/routes/module-types.js` - 模块类型 CRUD API

### Frontend
- 模块类型选择器集成在各功能页面中

### Database
- **Tables**: `module_types` - 模块类型表

## Related Specs
- [device-management](../device-management/spec.md) - 设备模块使用模块类型
- [release-management](../release-management/spec.md) - 版本发布关联模块类型
- [product-management](../product-management/spec.md) - 产品模块配置使用模块类型
