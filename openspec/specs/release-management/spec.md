# Release Management

**Capability**: release-management  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

版本发布管理系统负责管理系统各模块的版本发布、版本库和版本升级记录。

## Requirements

### Requirement: 版本发布管理
系统应支持为不同模块类型发布新版本。

#### Scenario: 发布新版本
- **WHEN** 用户为某个模块类型发布新版本
- **THEN** 系统应创建版本发布记录
- **AND** 记录版本号、发布说明、发布人、发布时间
- **AND** 支持上传版本附件（固件、文档等）

#### Scenario: 版本号格式
- **WHEN** 用户输入版本号
- **THEN** 建议使用语义化版本格式（如 v1.2.3）

#### Scenario: 查询版本库
- **WHEN** 用户访问版本中心页面
- **THEN** 系统应按模块类型分类展示所有版本
- **AND** 支持按模块类型筛选
- **AND** 显示版本号、发布时间、发布人、发布说明

### Requirement: 版本文件管理
系统应支持版本相关文件的上传和下载。

#### Scenario: 上传版本附件
- **WHEN** 用户发布版本时上传附件
- **THEN** 系统应保存文件到服务器
- **AND** 记录文件名、文件大小、上传时间

#### Scenario: 下载版本附件
- **WHEN** 用户点击下载版本附件
- **THEN** 系统应返回文件
- **AND** 设置正确的文件名和MIME类型

#### Scenario: 删除版本发布
- **WHEN** 用户删除版本发布记录
- **THEN** 系统应删除数据库记录和关联文件

### Requirement: 空状态处理
当没有模块类型或版本时，系统应显示友好的空状态。

#### Scenario: 无模块类型时的空状态
- **WHEN** 系统中没有任何模块类型
- **THEN** 系统应显示"暂无模块类型"提示
- **AND** 隐藏"发布新版本"按钮

#### Scenario: 无版本时的空状态
- **WHEN** 选中的模块类型下没有版本发布
- **THEN** 系统应显示"暂无版本发布"提示
- **AND** 显示"发布新版本"按钮

#### Scenario: 加载状态显示
- **WHEN** 数据正在加载中
- **THEN** 系统应显示"加载中..."提示
- **AND** 加载完成后根据数据情况显示对应内容或空状态

## Implementation

### Backend
- **Routes**: `server/routes/version-releases.js` - 版本发布 CRUD API
- **Routes**: `server/routes/versions.js` - 版本查询 API
- **Routes**: `server/routes/uploads.js` - 文件上传 API

### Frontend
- **Pages**: `client/src/pages/ReleaseLibrary.tsx` - 版本中心页面

### Database
- **Tables**: `version_releases` - 版本发布表
- **Tables**: `release_attachments` - 版本附件表
- **Foreign Key**: `version_releases.module_type_id` → `module_types.id`

## Related Specs
- [module-types](../module-types/spec.md) - 模块类型定义
- [device-management](../device-management/spec.md) - 设备版本关联
