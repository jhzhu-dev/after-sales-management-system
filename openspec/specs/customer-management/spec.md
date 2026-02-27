# Customer Management

**Capability**: customer-management  
**Status**: Implemented  
**Last Updated**: 2026-02-27

## Overview

客户管理系统负责管理设备的最终归属客户信息，支持客户的基本信息管理和设备-客户关联关系。

## Requirements

### Requirement: 客户信息管理
系统应支持客户的增删改查操作。

#### Scenario: 创建客户
- **WHEN** 用户创建新客户记录
- **THEN** 系统应保存客户名称、联系人、联系方式、地址等信息
- **AND** 客户名称建议唯一

#### Scenario: 查询客户列表
- **WHEN** 用户访问客户管理页面
- **THEN** 系统应返回所有客户
- **AND** 支持搜索和分页

#### Scenario: 更新客户信息
- **WHEN** 用户修改客户的联系信息或地址
- **THEN** 系统应更新客户记录

#### Scenario: 删除客户
- **WHEN** 用户删除客户
- **THEN** 系统应检查是否有关联的设备
- **AND** 如果有关联设备则禁止删除或提示用户

### Requirement: 设备客户关联
系统应记录设备与客户的关联关系，用于售后归属管理。

#### Scenario: 关联设备到客户
- **WHEN** 设备出厂或销售时
- **THEN** 系统应记录设备归属的客户
- **AND** 一个设备只能归属一个客户

#### Scenario: 查看客户的设备
- **WHEN** 用户查看客户详情
- **THEN** 系统应显示该客户拥有的所有设备
- **AND** 显示设备编号、产品线、状态等信息

#### Scenario: 转移设备归属
- **WHEN** 设备转售或移交时
- **THEN** 系统应支持更新设备的客户关联
- **AND** 可选记录转移历史

## Implementation

### Backend
- **Routes**: `server/routes/customers.js` - 客户 CRUD API

### Frontend
- 客户管理功能集成在设备管理页面中

### Database
- **Tables**: `customers` - 客户表
- **Foreign Key**: `devices.customer_id` → `customers.id`

## Related Specs
- [device-management](../device-management/spec.md) - 设备关联客户
