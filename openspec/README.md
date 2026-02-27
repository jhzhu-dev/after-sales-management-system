# OpenSpec 规范文档

> 本项目使用 OpenSpec 进行规范驱动开发

## 📁 目录结构

```
openspec/
├── AGENTS.md           # AI Assistant 使用指南
├── project.md          # 项目上下文和技术栈
├── README.md           # 本文件
├── changes/            # 活跃变更（正在开发的功能）
│   ├── archive/        # 已归档的历史变更
│   └── backup/         # 重置前的备份
└── specs/              # 已实施的规范（生产代码）
    ├── device-management/
    ├── product-management/
    ├── customer-management/
    ├── issue-tracking/
    ├── release-management/
    ├── module-types/
    ├── dashboard/
    ├── after-sales/
    └── sop-management/
```

## 🎯 当前规范状态

**最后更新**: 2026-02-27

### ✅ 已实施规范 (9个)

| 规范 | 说明 | 后端路由 | 前端页面 |
|------|------|---------|---------|
| device-management | 设备管理 | devices.js, modules.js, versions.js | Devices.tsx, DeviceDetail.tsx |
| product-management | 产品管理 | product-lines.js, products.js, product-modules.js, product-documents.js | ProductLines.tsx, Products.tsx, ProductDetail.tsx |
| customer-management | 客户管理 | customers.js | - |
| issue-tracking | 问题跟踪 | issues.js, issue-logs.js | Issues.tsx, IssueDetail.tsx |
| release-management | 版本发布 | version-releases.js, versions.js | ReleaseLibrary.tsx |
| module-types | 模块类型 | module-types.js | - |
| dashboard | 数据仪表盘 | dashboard.js | Dashboard.tsx |
| after-sales | 售后服务 | after-sales.js, device-upgrades.js, device-documents.js | - |
| sop-management | SOP流程 | sop-templates.js | - |

### 📦 活跃变更 (0个)

当前没有活跃的变更。所有已实施功能的需求都已记录在 specs/ 目录中。

## 🔄 工作流程

### 1. 创建新功能（Creating Changes）

```bash
# 1. 创建变更目录
mkdir -p openspec/changes/my-feature/specs/capability-name

# 2. 编写提案
# openspec/changes/my-feature/proposal.md

# 3. 编写任务清单
# openspec/changes/my-feature/tasks.md

# 4. 编写规范增量
# openspec/changes/my-feature/specs/capability-name/spec.md
```

### 2. 实施功能（Implementing Changes）

- 根据 tasks.md 逐项实施
- 更新任务状态 `[x]`
- 编写代码并测试

### 3. 归档变更（Archiving Changes）

```bash
# 功能完成后归档
openspec archive my-feature --yes
```

这会将规范增量合并到 `openspec/specs/`，并移动变更到 `archive/`。

## 📖 快速参考

### 规范文件格式

```markdown
# Capability Name

**Capability**: capability-name
**Status**: Implemented
**Last Updated**: 2026-02-27

## Overview
功能概述

## Requirements

### Requirement: 需求标题
需求描述

#### Scenario: 场景名称
- **WHEN** 条件
- **THEN** 期望结果
- **AND** 附加条件

## Implementation
实现细节

## Related Specs
相关规范链接
```

### 变更提案格式

```markdown
## Why
为什么要做这个变更？

## What Changes
具体要改什么？

## Impact
影响范围和风险
```

### 任务清单格式

```markdown
## 1. 实施阶段
- [ ] 1.1 任务描述
- [x] 1.2 已完成的任务
```

## 🔍 规范查询

```bash
# 查看所有规范
ls openspec/specs/*/spec.md

# 搜索特定需求
rg "Requirement:" openspec/specs/

# 查看变更历史
ls openspec/changes/archive/
```

## 📚 相关文档

- [AGENTS.md](AGENTS.md) - AI Assistant 使用 OpenSpec 的详细指南
- [project.md](project.md) - 项目技术栈和约束条件
- 各规范文件：[specs/](specs/)

## 🗂️ 重置说明

**2026-02-27**: OpenSpec 规范体系已完成重置

- ✅ 清空了不匹配的历史变更（已备份到 `changes/backup/`）
- ✅ 根据当前代码状态重建了9个核心功能规范
- ✅ 所有规范都已验证与实际代码对应
- ✅ 项目进入规范驱动开发阶段

旧变更备份位置：
- `openspec/changes/backup/` - 变更提案和规范增量
- `openspec/specs/backup/` - 旧的 dashboard 规范

## 💡 使用建议

1. **新功能开发前**：先在 `changes/` 创建提案和规范增量
2. **实施过程中**：持续更新 tasks.md 的完成状态
3. **功能完成后**：使用 `openspec archive` 归档变更
4. **查看规范时**：直接阅读 `specs/` 目录下的规范文件
5. **AI协作时**：让 AI 先阅读 `@/openspec/AGENTS.md`

---

**维护者**: 根据项目实际情况更新规范  
**问题反馈**: 通过项目 issue 提交
