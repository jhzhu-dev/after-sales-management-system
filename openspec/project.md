# Project Context

## Purpose
设备管理系统 - 一个完整的企业级设备全生命周期管理平台，专注于：
- 多类型设备的信息管理和状态追踪
- 全流程订单管理与生产进度追踪 (SOP)
- 模块化的版本管理系统（出厂配置和后期更新）
- 统一的售后服务中心（故障报修、版本演进与看板）
- 数据可视化和统计报表
- 为工业设备、机械设备、电气系统等提供统一的管理入口

**核心目标**：帮助企业实现设备资产数字化管理，提升设备维护效率，建立完整的设备生命周期档案。

## Tech Stack

### 后端技术栈
- **Node.js 16+** - JavaScript运行时环境
- **Express 4.18** - Web应用框架
- **MySQL 8.0** - 关系型数据库（使用 mysql2/promise）
- **JWT (jsonwebtoken)** - 身份认证和授权
- **Express Validator** - 请求参数验证
- **Helmet** - 安全中间件（HTTP头安全）
- **Express Rate Limit** - API限流保护
- **CORS** - 跨域资源共享
- **Multer** - 文件上传处理
- **XLSX** - Excel文件导入导出
- **Moment.js** - 日期时间处理
- **bcryptjs** - 密码加密

### 前端技术栈
- **React 18** - 前端UI框架
- **TypeScript 4.9** - 类型安全的JavaScript超集
- **React Router DOM 6** - 客户端路由
- **Tailwind CSS 3** - 实用优先的CSS框架
- **Axios** - HTTP客户端
- **Recharts** - 数据可视化图表库
- **React Hook Form** - 表单管理
- **React Query** - 服务端状态管理
- **Heroicons** - SVG图标库
- **Lucide React** - 图标组件
- **date-fns** - 日期处理工具
- **@headlessui/react** - 无样式UI组件

### 开发工具
- **Nodemon** - 服务器自动重启
- **Concurrently** - 并行运行多个命令
- **PostCSS** - CSS转换工具
- **Autoprefixer** - CSS自动添加浏览器前缀

## Project Conventions

### Code Style
**TypeScript/JavaScript**:
- 使用 ES6+ 语法特性
- 前端组件使用函数式组件和 React Hooks
- 接口和类型定义使用 TypeScript interfaces
- 异步操作使用 async/await 模式
- 箭头函数优先于传统函数声明

**命名约定**:
- 文件名：组件使用 PascalCase（如 `DeviceForm.tsx`），工具类使用 camelCase
- 组件名：PascalCase（如 `DataTable`, `StatsCard`）
- 函数/变量：camelCase（如 `initializeDatabase`, `deviceRoutes`）
- 常量：UPPER_SNAKE_CASE（如 `DB_HOST`, `PORT`）
- 数据库表名：snake_case（如 `device_types`, `submodule_versions`）
- 接口命名：使用 PascalCase（如 `Device`, `Module`, `Issue`）

**代码组织**:
- 前端按功能模块组织：`components/`, `pages/`, `services/`, `types/`, `utils/`
- 后端按路由模块组织：`routes/` 目录包含各个业务模块
- 使用懒加载优化首屏性能（React.lazy）
- 保持组件单一职责原则

### Architecture Patterns

**前端架构**:
- **组件化设计**：UI拆分为可复用组件（Layout, DataTable, StatsCard等）
- **页面路由分离**：使用 React Router 实现 SPA 应用
- **API服务层**：统一的 `services/api.ts` 处理所有HTTP请求
- **类型安全**：使用 TypeScript 确保编译时类型检查
- **响应式设计**：基于 Tailwind CSS 的移动优先设计

**后端架构**:
- **RESTful API**：遵循REST设计原则
- **中间件模式**：安全、限流、CORS等通过中间件实现
- **数据库连接池**：使用 mysql2 连接池管理数据库连接
- **模块化路由**：每个业务模块独立路由文件
- **错误处理**：统一的错误响应格式 `{ success, data/error }`
- **安全防护**：Helmet 安全头、JWT 认证、限流保护

**数据库设计**:
- 核心表（设备）：`devices`（设备 - 关联客户与订单）、`modules`（模块）、`submodules`（子模块）、`submodule_versions`（版本）、`issues`（问题）、`device_upgrades`（升级记录）
- 核心表（订单）：`orders`（订单）、`order_payments`（付款）、`order_devices`（订单预期设备清单）、`order_progress`（进度）、`order_shipping_info`（出货）
- 基础数据表：`product_lines`（产品线）、`products`（产品）、`customers`（客户）、`product_documents`（产品资料）
- 类型表：`device_types`（设备类型）、`module_types`（模块类型）
- 配置表：`order_hardware_configs`、`order_software_configs`
- 字符集：utf8mb4 支持完整的Unicode字符
- 时区：+08:00（东八区）

### Testing Strategy
**当前状态**：项目处于初期开发阶段，暂未实施完整的测试策略

**建议测试方向**：
- 单元测试：使用 Jest 测试工具函数和业务逻辑
- 集成测试：测试 API 端点和数据库交互
- 前端测试：使用 React Testing Library 测试组件
- E2E测试：使用 Cypress 或 Playwright 测试完整用户流程

### Git Workflow
**推荐工作流**：
- 使用 Git Flow 或 GitHub Flow
- 主分支：`main` 或 `master` 保持稳定
- 开发分支：`develop` 用于日常开发
- 功能分支：`feature/功能名称`
- 修复分支：`fix/问题描述`

**提交规范**（建议）：
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构代码
perf: 性能优化
test: 测试相关
chore: 构建/工具配置
```

## Domain Context

### 订单管理领域
**订单生命周期**:
1. **订单创建**: 录入客户信息、产品需求、交付日期等
2. **生产阶段**: 确认BOM、组装、测试
3. **调试阶段**: 烧录固件、参数校准、老化测试
4. **打包阶段**: 清洁、附件核对、装箱
5. **物流阶段**: 发货、追踪物流
6. **完成/售后**: 订单交付，转入售后维护

**SOP流程控制**:
- 每个阶段都有标准作业程序(SOP)检查清单
- 必须完成SOP检查并提交审核
- 审核通过后自动进入下一阶段

**业务术语**:
- **Order（订单）**: 销售合同对应的交付任务
- **Product Line（产品线）**: 公司的核心产品系列（如龙门、底盘）
- **Product（产品）**: 具体的产品型号和规格
- **Customer（客户）**: 购买产品的企业或个人，也是设备最终的归属方
- **Device-Order Link**: 记录物理设备与来源订单的关联，用于生产溯源
- **Device-Customer Link**: 记录物理设备与持有客户的关联，用于售后归属梳理
- **SOP（标准作业程序）**: 每个生产阶段必须执行的检查项
- **Progress（进度）**: 订单当前所处的阶段和状态

### 设备管理领域
**设备分类体系**：
- 机械设备（Mechanical）
- 电气系统（Electrical）：包含硬件和软件
- 上位机（HMI）：包含硬件和软件
- 服务器（Server）：包含硬件和软件
- 视觉系统（Vision）：包含硬件和软件

**设备生命周期**：
1. **设备录入**：记录设备编号、型号、位置等基本信息
2. **模块管理**：为设备配置各类模块（机械、电气、上位机等）
3. **版本追踪**：记录出厂版本和每次更新的版本信息
4. **运维管理**：设备状态监控（正常/异常/维护中）
5. **售后服务**：统一售后中心管理（故障报修、升级演进、概览看板）
6. **全生命周期溯源**：从订单、到出厂配置、到后期维护升级的全链路追溯

**版本管理策略**：
- 每个子模块有独立的版本号
- 记录出厂版本（factory_version）和当前版本（current_version）
- 版本更新记录包含：版本号、更新时间、更新人、更新说明

**问题管理流程**：
- 严重性等级：低、中、高
- 状态流转：待处理 → 处理中 → 已解决
- 跟进人分配和进度追踪

### 业务术语
- **Device（设备）**：管理的基本单元，如一台机器或一套系统
- **Module（模块）**：设备的组成部分，如机械模块、电气模块
- **Submodule（子模块）**：模块下的具体部件或软件
- **Version（版本）**：子模块的软件或硬件版本信息
- **Issue（问题/故障）**：售后服务中的故障报修单
- **Device Upgrade（设备升级）**：设备的硬件升级、软件更新或系统重装记录
- **After-Sales Center（售后中心）**：整合后的统一售后管理入口
- **Remote Code（远程代码）**：设备远程访问标识
- **Factory Version（出厂版本）**：设备出厂时的初始版本
- **Current Version（当前版本）**：设备当前运行的版本

## Important Constraints

### 技术约束
- **数据库编码**：必须使用 utf8mb4 以支持完整的中文字符和特殊符号
- **时区设置**：数据库时区固定为 +08:00（东八区/北京时间）
- **端口配置**：
  - 开发环境后端：5000（HTTP）、5001（HTTPS）
  - 开发环境前端：3000
- **Node.js版本**：需要 16+ 版本
- **MySQL版本**：需要 8.0+ 版本

### 安全约束
- 所有API请求受限流保护（15分钟内最多1000次请求）
- 使用 JWT 进行身份认证
- 使用 Helmet 中间件设置安全HTTP头
- 密码使用 bcryptjs 加密存储
- HTTPS 支持（生产环境必须）

### 性能约束
- 数据库连接池限制：最多10个并发连接
- 静态资源缓存：1年（开发环境可调整）
- API响应缓存策略：根据资源类型设置不同缓存策略

### 业务约束
- 设备编号必须唯一
- 设备状态仅限：正常、异常、维护中
- 问题严重性仅限：低、中、高
- 问题状态仅限：待处理、处理中、已解决
- 订单ID格式：`ORD-YYYYMMDD-XXX` (自动生成)
- 订单状态流转：草稿 → 进行中 → 已完成/已取消
- 订单进度流转：生产 → 调试 → 打包 → 物流 → 完成 (单向不可逆)

## External Dependencies

### 数据库依赖
- **MySQL 8.0+**：主数据存储
  - 连接配置：通过环境变量配置（DB_HOST, DB_PORT, DB_USER等）
  - 默认数据库名：`device_management`
  - 默认用户：`els` / 密码：`111111`（开发环境）

### SSL证书
- 位置：`ssl/` 目录
- 用途：HTTPS服务（生产环境）
- 配置文件：`openssl.conf`

### 环境变量
项目依赖 `.env` 文件配置（参考 `env.example`）：
- 数据库连接信息
- JWT密钥和过期时间
- 服务器端口和环境模式
- 前端API地址

### 外部服务（可选扩展）
- 文件存储：当前使用本地存储，可扩展至 OSS/S3
- 邮件服务：用于问题通知（待实现）
- 监控服务：应用性能监控（待实现）

### 开发工具依赖
- **npm** 或 **yarn**：包管理器
- **PowerShell**：Windows环境推荐使用（避免中文乱码）
- **Git**：版本控制
