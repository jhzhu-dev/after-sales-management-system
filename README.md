# 设备管理系统

一个完整的设备管理系统，支持多类型设备管理、版本追踪、售后问题记录等功能。

## 🎯 系统特性

- **多类型设备管理**：支持机械、电气、上位机、服务器、视觉等设备类型
- **模块化版本追踪**：每个设备包含多个模块，支持出厂版本和更新版本管理
- **售后问题记录**：完整的问题追踪系统，支持状态流转和进度管理
- **数据持久化存储**：基于MySQL数据库的可靠数据存储
- **可视化展示**：现代化的仪表盘、图表和统计信息
- **响应式设计**：支持桌面和移动设备访问

## 📦 核心功能模块

### 1. 设备管理
- 设备基本信息管理（编号、型号、类别、位置、状态）
- 每台设备包含多个模块：
  - 机械结构
  - 电气（硬件/软件）
  - 上位机（硬件/软件）
  - 服务器（硬件/软件）
  - 视觉（硬件/软件）

### 2. 版本管理
- 出厂配置版本记录
- 后期维护更新记录
- 版本号、更新时间、更新人、备注等信息
- 按设备/模块查询版本历史

### 3. 售后问题管理
- 问题记录和状态追踪
- 严重性分级（低/中/高）
- 状态流转（待处理/处理中/已解决）
- 责任人分配和进度备注

### 4. 报表与统计
- 仪表盘统计信息
- 设备状态分布图
- 问题严重性分布
- 版本更新趋势
- 月度活动统计

## 🛠️ 技术栈

### 后端
- **Node.js** + **Express** - 服务器框架
- **MySQL** - 数据库
- **JWT** - 身份验证
- **Express Validator** - 数据验证
- **CORS** - 跨域支持
- **Helmet** - 安全中间件

### 前端
- **React 18** + **TypeScript** - 前端框架
- **Tailwind CSS** - 样式框架
- **React Router** - 路由管理
- **Axios** - HTTP客户端
- **Recharts** - 图表库
- **Heroicons** - 图标库

## 🚀 快速开始

### 环境要求
- Node.js 16+
- MySQL 8.0+
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd device-management-system
```

2. **一键启动（推荐）**
```bash
# Windows用户 - 解决中文乱码问题
start-utf8.bat

# 或使用PowerShell版本（推荐）
start.ps1
```

3. **完整设置（包含模拟数据）**
```bash
# 完整设置：安装依赖 + 初始化数据库 + 插入模拟数据
npm run setup

# 启动开发模式
npm run dev
```

4. **手动启动**
```bash
# 安装依赖
npm run install-all

# 初始化数据库
npm run init-db

# 插入模拟数据（可选）
npm run seed

# 启动开发模式
npm run dev
```

## 📋 环境启动

### 简化启动方式

项目已简化为2个核心启动脚本：

#### 开发环境
```bash
# 启动开发环境（前端+后端，支持热重载）
dev.bat
```
- 自动安装依赖
- 启动后端开发服务器（端口5000）
- 启动前端开发服务器（端口3000）
- 支持代码热重载和自动重启

#### 生产环境
```bash
# 启动生产环境（优化构建，静态文件）
prod.bat
```
- 自动安装依赖
- 智能检测前端文件变化
- 仅在需要时重新构建前端
- 启动生产服务器（端口5000/5001）

### 使用建议

1. **开发阶段**：使用 `dev.bat`，支持实时调试和热重载
2. **生产部署**：使用 `prod.bat`，自动优化和构建

### 为什么需要构建前端？

- **开发环境**：前端代码实时编译，支持热重载
- **生产环境**：前端代码需要构建成静态文件，优化性能和安全性
- **构建过程**：将React代码编译、压缩、打包成浏览器可直接运行的文件

5. **访问应用**
- 前端应用：http://localhost:3000
- 后端API：http://localhost:5000
- API文档：http://localhost:5000

### 🔧 解决中文乱码问题

如果遇到命令行中文乱码问题，请使用以下解决方案：

1. **使用UTF-8启动脚本**（推荐）
   ```bash
   start-utf8.bat
   ```

2. **使用PowerShell版本**
   ```bash
   start.ps1
   ```

3. **手动修复编码**
   ```bash
   fix-encoding.bat
   ```

4. **设置控制台编码**
   ```bash
   chcp 65001
   ```

## 📊 数据库设计

### 主要数据表

#### devices（设备表）
- `id` - 设备编号（主键）
- `name` - 设备名称
- `type` - 设备类型
- `location` - 位置
- `status` - 状态
- `created_at` - 创建时间
- `updated_at` - 更新时间

#### modules（模块表）
- `id` - 模块ID（主键）
- `device_id` - 设备ID（外键）
- `category` - 模块类别
- `factory_version` - 出厂版本
- `created_at` - 创建时间
- `updated_at` - 更新时间

#### module_versions（模块版本表）
- `id` - 版本ID（主键）
- `module_id` - 模块ID（外键）
- `version_number` - 版本号
- `version_type` - 版本类型（出厂/更新）
- `release_date` - 发布日期
- `description` - 描述
- `updated_by` - 更新人
- `created_at` - 创建时间

#### issues（问题表）
- `id` - 问题ID（主键）
- `device_id` - 设备ID（外键）
- `module_id` - 模块ID（外键，可选）
- `description` - 问题描述
- `severity` - 严重性
- `status` - 状态
- `assignee` - 责任人
- `created_at` - 创建时间
- `updated_at` - 更新时间

## 🔧 API接口

### 设备管理
- `GET /api/devices` - 获取设备列表
- `GET /api/devices/:id` - 获取设备详情
- `POST /api/devices` - 创建设备
- `PUT /api/devices/:id` - 更新设备
- `DELETE /api/devices/:id` - 删除设备

### 模块管理
- `GET /api/modules` - 获取模块列表
- `GET /api/modules/:id` - 获取模块详情
- `POST /api/modules` - 创建模块
- `PUT /api/modules/:id` - 更新模块
- `DELETE /api/modules/:id` - 删除模块

### 版本管理
- `GET /api/versions` - 获取版本列表
- `POST /api/versions` - 创建版本记录
- `PUT /api/versions/:id` - 更新版本记录
- `DELETE /api/versions/:id` - 删除版本记录

### 问题管理
- `GET /api/issues` - 获取问题列表
- `POST /api/issues` - 创建问题
- `PUT /api/issues/:id` - 更新问题
- `DELETE /api/issues/:id` - 删除问题
- `PATCH /api/issues/batch/status` - 批量更新问题状态

### 仪表盘
- `GET /api/dashboard/stats` - 获取统计信息
- `GET /api/dashboard/devices/overview` - 获取设备概览
- `GET /api/dashboard/issues/overview` - 获取问题概览
- `GET /api/dashboard/versions/overview` - 获取版本概览

## 📱 页面功能

### 仪表盘
- 统计卡片（设备数、模块数、问题数、版本种类数）
- 设备状态分布图
- 问题严重性分布图
- 月度趋势图
- 最近活动列表

### 设备管理
- 设备列表展示
- 设备筛选和搜索
- 设备详情查看
- 设备新增/编辑/删除
- 设备统计信息

### 问题管理
- 问题列表展示
- 问题筛选和搜索
- 批量状态更新
- 问题详情查看
- 问题新增/编辑/删除

## 🔒 安全特性

- JWT身份验证
- 请求限流
- CORS跨域保护
- Helmet安全头
- 输入数据验证
- SQL注入防护

## 📈 性能优化

- 数据库连接池
- 分页查询
- 响应式设计
- 图片懒加载
- 代码分割
- 缓存策略

## 🧪 测试

```bash
# 运行前端测试
cd client
npm test

# 运行后端测试
npm test
```

## 📦 部署

### Docker部署
```bash
# 构建镜像
docker build -t device-management .

# 运行容器
docker run -p 3000:3000 -p 5000:5000 device-management
```

### 生产环境部署
1. 构建前端应用
```bash
cd client
npm run build
```

2. 配置生产环境变量
3. 启动后端服务
```bash
npm start
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 项目Issues：[GitHub Issues](https://github.com/your-repo/issues)
- 邮箱：your-email@example.com

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！
