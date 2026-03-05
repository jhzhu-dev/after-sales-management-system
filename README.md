# 售后登记系统

> ** 生产环境运行中**  
> 本项目已于 **2026年2月27日** 投入生产，包含真实业务数据。  
> 详见：[doc/PRODUCTION.md](doc/PRODUCTION.md)

一个面向设备生命周期管理的完整 Web 系统，涵盖产品线、设备、模块版本、售后问题、客户等核心业务，支持阿里云 OSS 附件存储与 Docker 一键部署。

---

## 目录

- [系统功能](#系统功能)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速部署](#快速部署)
- [环境变量](#环境变量)
- [API 接口](#api-接口)
- [页面列表](#页面列表)
- [运维脚本](#运维脚本)
- [文档索引](#文档索引)

---

## 系统功能

| 模块 | 功能说明 |
|------|----------|
| **仪表盘** | 设备总数、问题统计、版本分布、月度趋势图 |
| **产品线管理** | 产品线的增删改查，关联产品管理 |
| **产品管理** | 产品信息、产品文档上传（OSS），按产品线分类 |
| **版本库中心** | 模块版本发布记录，附件按「模块类型/分类/版本号」存储至 OSS |
| **设备管理** | 设备台账、设备文档、模块追踪、升级记录 |
| **售后问题** | 问题工单全生命周期（新建处理中已解决），跟进日志附件 |
| **客户管理** | 客户档案，关联设备与问题 |
| **系统设置** | 模块类型配置、客户档案管理 |

---

## 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 18 (Alpine) | 运行环境 |
| Express | 4.x | HTTP 框架 |
| MySQL | 8.0 | 主数据库 |
| JWT |  | 身份认证 |
| multer |  | 文件上传 |
| ali-oss |  | 阿里云 OSS 存储 |
| express-validator |  | 请求参数校验 |
| Helmet / CORS |  | 安全中间件 |

### 前端

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 前端框架 |
| Tailwind CSS | 样式 |
| Axios（`services/api.ts` 配置实例） | HTTP 客户端，自动携带 Bearer Token |
| React Router | 路由 |
| Recharts | 图表 |
| Heroicons | 图标 |

### 基础设施

| 组件 | 说明 |
|------|------|
| Docker + docker-compose | 容器化部署（3 个容器） |
| Alibaba Cloud OSS | 附件对象存储（可选，`USE_OSS_STORAGE=true` 启用） |
| MySQL 外部卷 | `device-manager_mysql_data`（数据持久化，重部署不丢失） |

---

## 项目结构

```
/
 deploy-to-181.ps1           #  主部署脚本（构建  打包  传输  部署）
 Dockerfile                  # 应用镜像（多阶段：前端构建 + 后端）
 Dockerfile.backup           # 备份服务镜像
 docker-compose.yml          # 本地开发用 compose
 docker-compose.linux.yml    # 生产环境 compose（远端 Linux）
 env.example                 # 环境变量模板
 package.json                # 根项目配置
 AGENTS.md                   # AI 助手指令（openspec 托管）

 client/                     # 前端（React / TypeScript）
    src/
        components/         # 公共组件（表单、图表、布局等）
        pages/              # 页面组件
        services/
           api.ts          # Axios 实例（含 Auth 拦截器）+ 各业务 API
        context/
           AuthContext.tsx # 登录态管理（localStorage token）
        types/              # TypeScript 类型定义

 server/                     # 后端（Node.js / Express）
    index.js                # 服务器入口，注册全部路由
    database.js             # MySQL 连接池
    middleware/
       authenticate.js     # JWT 验证中间件
    routes/                 # API 路由（18 个模块）
       auth.js             # 登录/验证
       devices.js          # 设备
       modules.js          # 模块
       versions.js         # 模块版本
       issues.js           # 售后问题
       issue-logs.js       # 问题跟进日志
       dashboard.js        # 仪表盘统计
       module-types.js     # 模块类型
       version-releases.js # 版本库中心（附件 OSS 分类存储）
       product-lines.js    # 产品线
       products.js         # 产品
       product-modules.js  # 产品模块关联
       product-documents.js # 产品文档（OSS）
       device-documents.js # 设备文档（OSS）
       device-upgrades.js  # 设备升级记录
       after-sales.js      # 售后汇总查询
       customers.js        # 客户档案
       uploads.js          # 通用文件上传
    services/
        oss-service.js      # 阿里云 OSS 封装

 scripts/                    # 运维脚本
    remote-deploy.sh        # 远端执行：加载镜像  重启容器
    backup-entrypoint.sh    # 备份容器入口
    cron-entrypoint.sh      # 容器内定时任务入口
    nas-sync-linux.sh       # 备份文件同步到 NAS
    windows/                # Windows 本地维护脚本
        restart.ps1
        stop.ps1
        backup.ps1
        restore.ps1
        check-status.ps1
        logs.ps1
        setup-backup-task.ps1

 doc/                        # 项目文档
    PRODUCTION.md           # 生产环境运维手册
    DOCKER_DEPLOYMENT.md    # Docker 部署全流程
    DOCKER_HOT_UPDATE.md    # 不停服热更新说明
    BACKUP_GUIDE.md         # 数据库备份方案
    OSS_INTEGRATION.md      # 阿里云 OSS 集成文档
    OSS_STORAGE_STRUCTURE.md # OSS 目录结构规范
    docker-daemon.json      # Docker daemon 参考配置

 openspec/                   # 变更提案（AI 辅助规划）
 ssl/                        # HTTPS 证书（生产环境）
 uploads/                    # 本地文件存储（OSS 未启用时）
 backups/                    # 数据库备份文件
```

---

## 快速部署

### 前置条件

- 本地：Docker Desktop、PowerShell、SSH 密钥已配置到远端
- 远端 `192.168.0.181`：Docker Engine 已安装，外部卷 `device-manager_mysql_data` 已创建

```powershell
# 远端首次创建外部卷（只需执行一次）
ssh els@192.168.0.181 "docker volume create device-manager_mysql_data"
```

### 部署命令

```powershell
# 完整构建 + 部署（修改代码后使用）
.\deploy-to-181.ps1

# 跳过镜像构建（仅改了 compose / .env 时使用）
.\deploy-to-181.ps1 -SkipBuild
```

**自动流程（6 步）：**

| 步骤 | 操作 |
|------|------|
| 1 | `docker build`  构建镜像（含前端 `npm run build`） |
| 2 | 打版本标签 |
| 3 | `docker save`  导出 .tar |
| 4 | `scp`  传输镜像 + compose + .env + 部署脚本 |
| 5 | `ssh` 执行 `scripts/remote-deploy.sh`  加载镜像、重启容器 |
| 6 | 健康检查轮询 `/api/health`，确认就绪后完成 |

### Docker 容器

| 容器名 | 镜像 | 端口 | 说明 |
|--------|------|------|------|
| `device-manager-app` | `device-manager-app:latest` | 5000 / 5001 | 前端静态文件 + API |
| `device-manager-db` | `mysql:8.0` |  | 数据库（外部卷持久化） |
| `device-manager-db-backup` | `device-manager-backup:latest` |  | 定时数据库备份 |

---

## 环境变量

复制 `env.example` 为 `.env` 并填写：

```env
# 数据库
DB_HOST=mysql
DB_PORT=3306
DB_NAME=device_management
DB_USER=your_user
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret

# 服务端口
PORT=5000

# 阿里云 OSS（false = 使用本地 uploads/ 目录存储）
USE_OSS_STORAGE=false
OSS_REGION=oss-cn-shanghai
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=els-pub-04
OSS_BASE_PATH=static/After-sales management system
```

### OSS 存储路径规则

| 文件类型 | OSS 路径格式 |
|----------|------------|
| 产品文档 | `{BasePath}/{产品线}/{产品型号}/{文件名}` |
| 版本附件 | `{BasePath}/version-releases/{模块类型}/{分类}/{版本号}/{文件名}` |
| 设备文档 | `{BasePath}/device-docs/{设备编号}/{文件名}` |
| 问题附件 | `{BasePath}/issues/{文件名}` |

---

## API 接口

所有接口均需请求头 `Authorization: Bearer <token>`，`/api/auth` 和 `/api/health` 除外。

| 路由前缀 | 说明 |
|----------|------|
| `POST /api/auth/login` | 登录，返回 JWT token |
| `GET  /api/auth/verify` | 验证 token 有效性 |
| `/api/devices` | 设备 CRUD，支持分页与筛选 |
| `/api/modules` | 设备模块 CRUD |
| `/api/versions` | 模块版本记录 |
| `/api/module-types` | 模块类型配置（视觉、底盘等） |
| `/api/version-releases` | 版本发布记录；`/:id/attachments` 上传附件至 OSS |
| `/api/issues` | 售后问题工单 CRUD |
| `/api/issue-logs` | 问题跟进日志（含附件） |
| `/api/device-upgrades` | 设备升级记录 |
| `/api/product-lines` | 产品线 CRUD |
| `/api/products` | 产品 CRUD（含封面图上传） |
| `/api/product-modules` | 产品模块关联管理 |
| `/api/product-documents` | 产品文档（OSS） |
| `/api/device-documents` | 设备文档（OSS） |
| `/api/customers` | 客户档案 CRUD |
| `/api/after-sales` | 售后汇总查询 |
| `/api/dashboard` | 仪表盘统计（设备数、问题数、月度趋势等） |
| `/api/uploads` | 通用文件上传 |

---

## 页面列表

| URL | 组件 | 说明 |
|-----|------|------|
| `/login` | `Login.tsx` | 登录页 |
| `/` | `Dashboard.tsx` | 仪表盘（统计图表） |
| `/product-lines` | `ProductLines.tsx` | 产品线管理 |
| `/products` | `Products.tsx` | 产品列表（可按产品线筛选） |
| `/products/:id` | `ProductDetail.tsx` | 产品详情、文档、模块 |
| `/release-library` | `ReleaseLibrary.tsx` | 版本库中心（按模块类型/分类筛选，附件下载） |
| `/devices` | `Devices.tsx` | 设备台账列表 |
| `/devices/:id` | `DeviceDetail.tsx` | 设备详情、模块版本、升级记录、问题 |
| `/issues` | `Issues.tsx` | 售后问题工单列表 |
| `/issues/:id` | `IssueDetail.tsx` | 问题详情与跟进日志 |
| `/settings` | `Settings.tsx` | 模块类型 + 客户档案配置 |

---

## 运维脚本

### Windows（`scripts/windows/`）

| 脚本 | 说明 | 用法 |
|------|------|------|
| `restart.ps1` | 重启所有 Docker 容器 | `.\scripts\windows\restart.ps1` |
| `stop.ps1` | 停止所有容器 | `.\scripts\windows\stop.ps1` |
| `backup.ps1` | 手动触发数据库备份 | `.\scripts\windows\backup.ps1` |
| `restore.ps1` | 从备份还原数据库 | `.\scripts\windows\restore.ps1` |
| `check-status.ps1` | 检查容器状态与 API 健康 | `.\scripts\windows\check-status.ps1` |
| `logs.ps1` | 实时查看容器日志 | `.\scripts\windows\logs.ps1` |
| `setup-backup-task.ps1` | 注册 Windows 计划任务 | `.\scripts\windows\setup-backup-task.ps1` |

### Linux（`scripts/`）

| 脚本 | 说明 |
|------|------|
| `remote-deploy.sh` | 由 `deploy-to-181.ps1` 上传后在远端自动执行 |
| `backup-entrypoint.sh` | 备份容器启动入口 |
| `cron-entrypoint.sh` | 容器内 cron 定时任务入口 |
| `nas-sync-linux.sh` | 备份文件同步至 NAS |

---

## 安全特性

- JWT 身份验证，Token 存于 `localStorage`，`services/api.ts` 请求拦截器自动注入 `Authorization` 头
- `express-rate-limit` 请求限流
- `helmet` 安全响应头
- CORS 跨域白名单保护
- `express-validator` 参数校验
- MySQL 参数化查询（防 SQL 注入）

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [doc/PRODUCTION.md](doc/PRODUCTION.md) | 生产环境运维手册 |
| [doc/DOCKER_DEPLOYMENT.md](doc/DOCKER_DEPLOYMENT.md) | Docker 部署全流程 |
| [doc/DOCKER_HOT_UPDATE.md](doc/DOCKER_HOT_UPDATE.md) | 不停服热更新方法 |
| [doc/BACKUP_GUIDE.md](doc/BACKUP_GUIDE.md) | 数据库备份方案 |
| [doc/OSS_INTEGRATION.md](doc/OSS_INTEGRATION.md) | 阿里云 OSS 集成说明 |
| [doc/OSS_STORAGE_STRUCTURE.md](doc/OSS_STORAGE_STRUCTURE.md) | OSS 目录结构规范 |