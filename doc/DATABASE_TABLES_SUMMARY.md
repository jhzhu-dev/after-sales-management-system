# 系统数据库表设计总览（device_management）

生成时间：2026-05-25

## 说明

- 本文档基于 server/database.js 中的建表与迁移逻辑整理。
- 以下为当前系统涉及的全部业务表（共 29 张），按模块分类。

## 一、产品体系

| 序号 | 表名 | 用途 | 关键字段 |
|---|---|---|---|
| 1 | product_lines | 产品线主数据 | id, name, code, description, is_active, created_at, updated_at |
| 2 | products | 产品型号主数据 | id, product_line_id, name, short_name, model, description, specifications, is_active, created_at, updated_at |
| 3 | product_versions | 产品迭代版本 | id, product_id, version_number, version_name, description, specifications, status, release_date, is_current, sort_order, created_at, updated_at |
| 4 | product_version_documents | 产品迭代版本附件 | id, product_version_id, name, file_path, file_type, file_size, category, uploaded_by, created_at |
| 5 | product_documents | 产品资料文档 | id, product_id, doc_type, title, original_name, file_path, file_size, uploaded_by, created_at |

## 二、设备管理

| 序号 | 表名 | 用途 | 关键字段 |
|---|---|---|---|
| 6 | devices | 设备主表 | id(VARCHAR), name, nickname, device_code, product_line_id, product_id, customer_id, bundle_id, status, remote_code, password, merchant_id, merchant_password, notes, created_at, updated_at |
| 7 | device_bundles | 多设备组合管理 | id, bundle_code, name, customer_id, description, created_at, updated_at |
| 8 | device_documents | 设备/设备组合文档 | id, device_id, bundle_id, category, title, original_name, file_path, file_size, uploaded_by, created_at |
| 9 | device_upgrades | 设备升级记录 | id, device_id, upgrade_type, description, old_version, new_version, operator_id, upgrade_at, created_at |

## 三、模块与版本

| 序号 | 表名 | 用途 | 关键字段 |
|---|---|---|---|
| 10 | module_types | 模块类型字典 | id, name, code, description, is_active, feishu_user_open_id, created_at, updated_at |
| 11 | modules | 设备上的模块实例 | id, device_id, type_id, created_at, updated_at |
| 12 | module_versions | 模块版本历史 | id, module_id, version_number, version_type(factory/update), release_date, description, updated_by, checklist, created_at |
| 13 | module_sop_templates | 模块 SOP 检查清单模板 | id, module_type_id, items(JSON), created_at, updated_at |
| 14 | submodules | 模块下子组件 | id, module_id, name, model, factory_version, current_version, description, status, created_at, updated_at |
| 15 | submodule_versions | 子组件版本历史 | id, submodule_id, version_number, version_type(factory/update), release_date, description, updated_by, created_at |

## 四、产品模块配置

| 序号 | 表名 | 用途 | 关键字段 |
|---|---|---|---|
| 16 | product_modules | 产品模块模板（当前态） | id, product_id, module_type_id, is_required, default_config, created_at |
| 17 | product_submodule_specs | 产品子模块规格 | id, product_module_id, name, model, specifications, default_version, created_at |
| 18 | product_module_history | 产品模块配置历史版本 | id, product_id, module_type_id, is_required, default_config, version_number, change_description, effective_date, deprecated_date, is_current, created_by, created_at |

## 五、版本发布库

| 序号 | 表名 | 用途 | 关键字段 |
|---|---|---|---|
| 19 | version_releases | 版本发布库主表 | id, module_type_id, version_number, title, change_log, category, release_date, source(manual/synced), created_at |
| 20 | release_attachments | 版本发布附件 | id, release_id, file_name, original_name, file_path, file_size, created_at |
| 21 | version_release_products | 版本发布与产品的多对多关联 | id, release_id, product_id |

## 六、客户与售后

| 序号 | 表名 | 用途 | 关键字段 |
|---|---|---|---|
| 22 | customers | 客户主数据 | id, name, short_name, created_at, updated_at |
| 23 | issues | 售后问题工单 | id(VARCHAR), device_id, module_id, category, classification_id, description, contact_person, contact_phone, is_visit_required, visit_at, attachments, severity, status, assignee, assignee_open_id, resolution_description, resolved_at, created_at, updated_at |
| 24 | issue_logs | 问题跟进日志 | id, issue_id, content, operator, created_at |
| 25 | issue_classification_types | 问题归属分类字典 | id, name, sort_order, created_at |

## 七、知识库

| 序号 | 表名 | 用途 | 关键字段 |
|---|---|---|---|
| 26 | kb_articles | 运维知识库词条 | id, title, symptom, cause, solution, category, product_line_id, tags, is_pinned, view_count, helpful_count, created_by, created_at, updated_at |

## 八、飞书集成

| 序号 | 表名 | 用途 | 关键字段 |
|---|---|---|---|
| 27 | feishu_config | 飞书应用与通知群配置 | id, app_id, app_secret, chat_id, issues_chat_id, devices_chat_id, upgrades_chat_id, updated_at |
| 28 | feishu_users | 飞书通讯录用户缓存 | id, open_id, union_id, name, department, avatar_url, is_active, synced_at |
| 29 | feishu_notifications | 飞书通知消息记录 | id, message_id, type(device/issue/upgrade), ref_id, notify_open_ids, created_at |

## 核心关系速览

- 产品线 -> 产品：products.product_line_id -> product_lines.id
- 产品 -> 产品版本：product_versions.product_id -> products.id
- 设备 -> 产品线/产品/客户/组合：devices.product_line_id/product_id/customer_id/bundle_id
- 设备 -> 模块：modules.device_id -> devices.id
- 模块 -> 模块版本：module_versions.module_id -> modules.id
- 模块类型 -> 模块/版本发布：modules.type_id、version_releases.module_type_id -> module_types.id
- 版本发布 -> 附件：release_attachments.release_id -> version_releases.id
- 版本发布 <-> 产品：version_release_products 关联
- 问题工单 -> 设备/模块/分类：issues.device_id/module_id/classification_id

完。
