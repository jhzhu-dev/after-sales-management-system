# Product Management

**Capability**: product-management  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

产品管理系统负责管理公司的产品线、具体产品型号、产品模块配置和产品技术文档。

## Requirements

### Requirement: 产品线管理
系统应支持产品线的增删改查操作。

#### Scenario: 创建产品线
- **WHEN** 用户创建新产品线（如龙门、底盘）
- **THEN** 系统应保存产品线名称和描述
- **AND** 产品线名称必须唯一

#### Scenario: 查询产品线列表
- **WHEN** 用户访问产品线管理页面
- **THEN** 系统应返回所有产品线
- **AND** 显示每个产品线下的产品数量

#### Scenario: 更新产品线信息
- **WHEN** 用户修改产品线名称或描述
- **THEN** 系统应更新产品线记录

#### Scenario: 删除产品线
- **WHEN** 用户删除产品线
- **THEN** 系统应检查是否有关联的产品或设备
- **AND** 如果有关联数据则禁止删除

### Requirement: 产品型号管理
系统应支持在产品线下管理具体的产品型号。

#### Scenario: 创建产品型号
- **WHEN** 用户在产品线下创建新产品
- **THEN** 系统应保存产品名称、型号、描述
- **AND** 关联到指定产品线

#### Scenario: 查询产品列表
- **WHEN** 用户访问产品管理页面
- **THEN** 系统应返回所有产品
- **AND** 支持按产品线筛选
- **AND** 显示产品名称、型号、产品线等信息

#### Scenario: 查看产品详情
- **WHEN** 用户点击查看产品详情
- **THEN** 系统应显示产品的完整信息
- **AND** 显示关联的产品模块配置
- **AND** 显示关联的技术文档

### Requirement: 产品模块配置
系统应支持为产品配置标准模块和子模块规格。

#### Scenario: 配置产品模块
- **WHEN** 用户为产品添加模块配置
- **THEN** 系统应保存模块类型和模块描述
- **AND** 关联到指定产品

#### Scenario: 配置子模块规格
- **WHEN** 用户为产品模块添加子模块规格
- **THEN** 系统应保存子模块名称、默认版本等信息
- **AND** 关联到产品模块

#### Scenario: 查看产品BOM
- **WHEN** 用户查看产品详情
- **THEN** 系统应显示产品的完整模块配置
- **AND** 按模块类型分组显示

### Requirement: 产品文档管理
系统应支持为产品上传和下载技术文档。

#### Scenario: 上传产品文档
- **WHEN** 用户上传产品技术文档
- **THEN** 系统应保存文件到服务器
- **AND** 记录文档名称、类型、上传时间等信息

#### Scenario: 下载产品文档
- **WHEN** 用户点击下载文档
- **THEN** 系统应返回文档文件
- **AND** 设置正确的文件名和MIME类型

#### Scenario: 删除产品文档
- **WHEN** 用户删除文档
- **THEN** 系统应删除数据库记录和文件

## Implementation

### Backend
- **Routes**: `server/routes/product-lines.js` - 产品线 CRUD API
- **Routes**: `server/routes/products.js` - 产品 CRUD API
- **Routes**: `server/routes/product-modules.js` - 产品模块配置 API
- **Routes**: `server/routes/product-documents.js` - 产品文档 API

### Frontend
- **Pages**: `client/src/pages/ProductLines.tsx` - 产品线列表页
- **Pages**: `client/src/pages/Products.tsx` - 产品列表页
- **Pages**: `client/src/pages/ProductDetail.tsx` - 产品详情页

### Database
- **Tables**: `product_lines` - 产品线表
- **Tables**: `products` - 产品表
- **Tables**: `product_modules` - 产品模块配置表
- **Tables**: `product_submodule_specs` - 产品子模块规格表
- **Tables**: `product_documents` - 产品文档表

## Related Specs
- [device-management](../device-management/spec.md) - 设备关联产品线
- [module-types](../module-types/spec.md) - 模块类型定义
