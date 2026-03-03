# 项目上下文

> **最后更新：** 2026年3月2日  
> **环境状态：** ✅ PRODUCTION（已于 2026年2月27日 上线）

---

## 项目简介

**设备管理系统**（售后登记系统）是一套面向工业设备全生命周期管理的 Web 应用，支持多类型设备注册、模块版本追踪、售后问题记录与统计分析。系统目前持有真实生产数据，**严禁对数据库执行任何测试性或破坏性操作**。

---

## 核心技术栈

### 后端（`server/`）
| 技术 | 版本/说明 |
|------|-----------|
| Node.js + Express | Web 服务器框架（`^4.18.2`） |
| MySQL 2 | 数据库驱动（`^3.6.5`）|
| JWT (jsonwebtoken) | 身份验证（`^9.0.2`） |
| bcryptjs | 密码哈希（`^2.4.3`） |
| multer | 文件上传中间件（本地存储）|
| ali-oss | 阿里云 OSS 文件存储（`^6.18.0`）|
| helmet + express-rate-limit | 安全中间件 |
| express-validator | 请求参数校验 |
| xlsx + moment | Excel 导出 / 日期处理 |
| nodemon + concurrently | 开发工具 |

### 前端（`client/`）
| 技术 | 版本/说明 |
|------|-----------|
| React 18 + TypeScript | 前端框架（`^18.2.0 / ^4.9.5`）|
| React Router v6 | 客户端路由 |
| Tailwind CSS v3 | 原子化样式框架 |
| Axios | HTTP 客户端 |
| Recharts | 图表可视化 |
| react-query v3 | 服务端状态管理 |
| react-hook-form | 表单管理 |
| @heroicons/react + lucide-react | 图标库 |
| @headlessui/react | 无障碍 UI 组件 |
| xlsx + date-fns | Excel 导出 / 日期格式化 |

### 部署 & 基础设施
| 技术 | 说明 |
|------|------|
| Docker + docker-compose | 容器化部署（MySQL 8.0 + Node.js App）|
| HTTPS (Node.js https 模块) | SSL 证书挂载于 `ssl/` |
| 阿里云 OSS | 华东2（oss-cn-shanghai），Bucket: `els-pub-04` |
| 本地文件存储 | OSS 关闭时回退到 `uploads/` 目录 |

---

## 项目文件结构

```
manger/
├── server/                  # Node.js 后端
│   ├── index.js             # 主入口（HTTPS + 路由注册 + 静态文件服务）
│   ├── database.js          # MySQL 连接池与数据库初始化
│   ├── routes/              # API 路由（每个功能模块独立文件）
│   │   ├── devices.js       # 设备 CRUD
│   │   ├── modules.js       # 设备模块管理
│   │   ├── module-types.js  # 模块类型字典
│   │   ├── versions.js      # 模块版本记录
│   │   ├── version-releases.js # 版本发布库
│   │   ├── issues.js        # 售后问题管理
│   │   ├── issue-logs.js    # 问题处理日志
│   │   ├── dashboard.js     # 仪表盘统计聚合
│   │   ├── product-lines.js # 产品线管理
│   │   ├── products.js      # 产品管理
│   │   ├── product-modules.js    # 产品模块配置
│   │   ├── product-documents.js  # 产品文档
│   │   ├── device-documents.js   # 设备文档
│   │   ├── device-upgrades.js    # 设备升级记录
│   │   ├── after-sales.js   # 售后管理集成（Phase 4）
│   │   ├── customers.js     # 客户管理
│   │   └── uploads.js       # 文件上传（OSS / 本地）
│   └── services/
│       └── oss-service.js   # 阿里云 OSS 封装
│
├── client/                  # React 前端
│   ├── src/
│   │   ├── App.tsx          # 路由配置根组件
│   │   ├── pages/           # 页面组件（10 个页面）
│   │   │   ├── Dashboard.tsx        # 仪表盘统计
│   │   │   ├── Devices.tsx          # 设备列表
│   │   │   ├── DeviceDetail.tsx     # 设备详情（含模块/版本/问题/升级）
│   │   │   ├── Issues.tsx           # 售后问题列表
│   │   │   ├── IssueDetail.tsx      # 问题详情与处理日志
│   │   │   ├── Products.tsx         # 产品列表
│   │   │   ├── ProductDetail.tsx    # 产品详情
│   │   │   ├── ProductLines.tsx     # 产品线管理
│   │   │   ├── ReleaseLibrary.tsx   # 版本发布库
│   │   │   └── Settings.tsx         # 系统设置
│   │   ├── components/      # 复用组件（15+ 个）
│   │   │   ├── Layout.tsx           # 侧边栏 + 顶部导航布局
│   │   │   ├── DataTable.tsx        # 通用数据表格
│   │   │   ├── AttachmentViewer.tsx # OSS 附件预览
│   │   │   ├── ExportButton.tsx     # Excel 导出按钮
│   │   │   ├── ChartCard.tsx / StatsCard.tsx # 统计卡片
│   │   │   ├── DeviceTypeChart.tsx / LocationStatsChart.tsx / ProductLineChart.tsx
│   │   │   ├── IssueLogTimeline.tsx # 问题处理时间线
│   │   │   └── *Form.tsx            # 各业务实体表单
│   │   ├── services/
│   │   │   └── api.ts       # Axios 封装，统一 API 调用
│   │   ├── types/
│   │   │   └── index.ts     # TypeScript 类型定义（所有领域实体）
│   │   └── utils/
│   │       └── exportUtils.ts # Excel 导出工具
│   └── build/               # 生产构建产物（已构建，由后端直接 serve）
│
├── openspec/                # OpenSpec 规格管理
│   ├── project.md           # 本文件
│   ├── AGENTS.md            # AI 助手工作流规范
│   ├── specs/               # 功能能力规格文件
│   └── changes/             # 变更提案（archive/ 存放已归档）
│
├── doc/                     # 技术文档
│   ├── OSS_INTEGRATION.md   # 阿里云 OSS 集成说明
│   ├── OSS_STORAGE_STRUCTURE.md
│   ├── DOCKER_HOT_UPDATE.md
│   └── CLEANUP_RECORD.md
│
├── ssl/                     # SSL 证书（生产环境 HTTPS）
├── uploads/                 # 本地文件存储（OSS 禁用时使用）
├── docker-compose.yml       # 容器编排配置
├── Dockerfile               # 应用镜像构建
├── deploy.ps1 / restart.ps1 # 部署与重启脚本（PowerShell）
├── PRODUCTION.md            # 生产环境操作规范
└── README.md                # 项目说明文档
```

---

## 业务领域模型

| 领域实体 | 说明 |
|---------|------|
| **Customer（客户）** | 设备所属客户，含简称 |
| **ProductLine（产品线）** | 产品的顶层分类 |
| **Product（产品）** | 具体产品型号，属于产品线 |
| **Device（设备）** | 实体设备，关联客户、产品；状态：正常/异常/维护中 |
| **ModuleType（模块类型）** | 模块类别字典（机械/电气/上位机/服务器/视觉等）|
| **Module（模块）** | 设备下的功能模块实例 |
| **Version（版本）** | 模块版本记录（出厂版本/更新版本）|
| **VersionRelease（发布库）** | 官方版本发布记录（独立于设备） |
| **Issue（售后问题）** | 问题单，含严重性（low/medium/high）、状态（open/in_progress/closed）|
| **IssueLog（处理日志）** | 问题处理进度记录，支持附件 |
| **DeviceUpgrade（升级记录）** | 设备硬件升级/软件更新记录 |

---

## 代码规范与架构约定

### 后端
- 路由文件按业务实体拆分，统一在 `server/index.js` 注册
- 数据库操作使用 `mysql2` Promise API，连接池管理
- 文件上传：优先使用阿里云 OSS（`USE_OSS_STORAGE=true`），否则存入 `uploads/` 本地目录
- API 响应格式统一：`{ success: boolean, data: T, message?: string }`
- 分页响应格式：`{ success, data[], pagination: { page, limit, total, pages } }`

### 前端
- TypeScript 严格类型，所有领域类型集中定义在 `client/src/types/index.ts`
- API 调用统一通过 `client/src/services/api.ts`，不在组件中直接使用 axios
- 样式全部使用 Tailwind CSS 工具类，不写自定义 CSS（除 `App.css` / `index.css` 全局样式）
- 表单使用 `react-hook-form`，数据请求状态使用 `react-query`
- 组件命名使用 PascalCase，文件以 `.tsx` 结尾

### Git 工作流
- 功能分支：`feature/your-feature-name`
- 生产环境变更必须经代码审查后合并
- 部署使用 `deploy.ps1`（Docker 热更新）或 `restart.ps1`

---

## 当前主要开发进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 基础数据模块（产品线、产品、产品模块、产品文档） | ✅ 已完成 |
| Phase 2 | 设备管理（设备注册、模块绑定、版本记录） | ✅ 已完成 |
| Phase 3 | 售后问题管理（问题单、处理日志、附件上传） | ✅ 已完成 |
| Phase 4 | 售后管理集成（after-sales、设备升级、客户管理） | ✅ 已完成 |
| 基础设施 | Docker 容器化部署、HTTPS、阿里云 OSS 集成 | ✅ 已完成 |
| **生产上线** | **2026年2月27日正式投入生产环境** | ✅ **线上运行中** |

**当前重点**：系统已全面上线，后续以功能迭代和稳定性优化为主。所有变更须遵循 OpenSpec 规范提交提案（proposal），经审批后方可实施。

---

## 外部依赖与关键配置

| 依赖 | 用途 | 配置位置 |
|------|------|---------|
| 阿里云 OSS `els-pub-04` | 产品文档、设备文档、问题附件存储 | `.env` → `OSS_*` 环境变量 |
| MySQL 8.0 | 主数据库 | `.env` → `DB_*` 环境变量 / docker-compose |
| JWT Secret | 身份验证签名 | `.env` → `JWT_SECRET` |
| SSL 证书 | HTTPS 服务 | `ssl/` 目录 |

> `.env` 文件已加入 `.gitignore`，**不提交到版本控制**。参考 `env.example` 创建本地配置。

---

## 重要约束

1. **生产数据保护**：禁止执行 DELETE / TRUNCATE / DROP TABLE / 种子数据脚本
2. **数据库迁移**：必须先在开发环境测试，人工审核后方可在生产执行
3. **OpenSpec 工作流**：新功能、架构变更、API 破坏性修改须先创建 `proposal.md` 并通过审批
4. **OSS 密钥安全**：AccessKey 仅存于 `.env`，不得硬编码或提交到 Git
5. **前端构建产物**：`client/build/` 已存在并由后端 serve，部署前执行 `npm run build` 更新
