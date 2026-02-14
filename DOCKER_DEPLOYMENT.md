# Docker 部署指南

## 📋 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [详细步骤](#详细步骤)
- [常用命令](#常用命令)
- [配置说明](#配置说明)
- [局域网部署](#局域网部署)
- [故障排查](#故障排查)
- [数据备份](#数据备份)
- [卸载系统](#卸载系统)

---

## 系统要求

### Windows 系统
- Windows 10 64位：专业版、企业版或教育版（版本 1903 或更高）
- Windows 11
- 至少 4GB 内存（推荐 8GB）
- 至少 20GB 可用磁盘空间
- 启用 WSL 2 功能

### 软件要求
- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop) 4.0+
- PowerShell 5.1+（Windows 自带）

---

## 快速开始

### 1️⃣ 安装 Docker Desktop

1. 下载 Docker Desktop：https://www.docker.com/products/docker-desktop
2. 双击安装程序，按提示安装
3. 安装完成后重启电脑
4. 启动 Docker Desktop，等待启动完成

**验证安装：**
```powershell
docker --version
docker-compose --version
```

### 2️⃣ 配置环境变量

在项目根目录（`manger`文件夹）创建 `.env` 文件：

```powershell
# 复制模板文件
Copy-Item .env.docker .env
```

编辑 `.env` 文件：
- 如果只是测试，保持默认配置即可（`USE_OSS_STORAGE=false`）
- 如果需要 OSS 云存储，填写真实的阿里云凭证

### 3️⃣ 一键部署

在项目根目录打开 PowerShell，执行：

```powershell
.\deploy.ps1
```

部署脚本会自动：
- 检查 Docker 环境
- 构建应用镜像
- 启动 MySQL 数据库
- 启动应用服务
- 显示服务状态

### 4️⃣ 访问系统

部署完成后，在浏览器中访问：

```
http://localhost:5000
```

---

## 详细步骤

### 步骤 1：准备项目文件

确保项目目录结构完整：

```
manger/
├── client/           # 前端代码
├── server/           # 后端代码
├── Dockerfile        # Docker 镜像配置
├── docker-compose.yml # Docker 编排配置
├── .dockerignore     # Docker 忽略文件
├── .env.docker       # 环境变量模板
├── deploy.ps1        # 部署脚本
├── stop.ps1          # 停止脚本
├── logs.ps1          # 日志查看脚本
└── restart.ps1       # 重启脚本
```

### 步骤 2：配置环境变量

创建 `.env` 文件并配置：

```env
# 数据库配置（保持默认即可）
DB_HOST=mysql
DB_PORT=3306
DB_USER=device_user
DB_PASSWORD=device_pass_123
DB_NAME=device_management

# OSS 配置（测试环境可以设置为 false）
USE_OSS_STORAGE=false
OSS_REGION=oss-cn-shanghai
OSS_BUCKET=els-pub-04
OSS_ACCESS_KEY_ID=your_key_here
OSS_ACCESS_KEY_SECRET=your_secret_here
OSS_BASE_PATH=static/After-sales management system

# 应用配置
NODE_ENV=production
PORT=5000
```

### 步骤 3：构建和启动

#### 方式 1：使用部署脚本（推荐）

```powershell
.\deploy.ps1
```

#### 方式 2：手动执行命令

```powershell
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 步骤 4：验证部署

1. **检查容器状态**
   ```powershell
   docker-compose ps
   ```
   
   应该看到两个容器都在运行：
   - `device-manager-db` (MySQL)
   - `device-manager-app` (应用)

2. **查看应用日志**
   ```powershell
   docker-compose logs app
   ```
   
   应该看到类似输出：
   ```
   Server running on port 5000
   Database connected successfully
   ```

3. **访问应用**
   - 打开浏览器访问：http://localhost:5000
   - 应该能看到系统登录页面

---

## 常用命令

### 启动系统

```powershell
# 启动所有服务
docker-compose up -d

# 查看启动日志
docker-compose logs -f
```

### 停止系统

```powershell
# 使用脚本
.\stop.ps1

# 或手动执行
docker-compose down
```

### 重启系统

```powershell
# 使用脚本
.\restart.ps1

# 或手动执行
docker-compose restart

# 重启单个服务
docker-compose restart app
docker-compose restart mysql
```

### 查看日志

```powershell
# 使用脚本
.\logs.ps1

# 查看所有日志
docker-compose logs -f

# 查看应用日志
docker-compose logs -f app

# 查看数据库日志
docker-compose logs -f mysql

# 查看最近100行日志
docker-compose logs --tail=100 app
```

### 查看状态

```powershell
# 查看容器状态
docker-compose ps

# 查看容器详细信息
docker ps

# 查看资源使用情况
docker stats
```

### 进入容器

```powershell
# 进入应用容器
docker exec -it device-manager-app sh

# 进入数据库容器
docker exec -it device-manager-db bash

# 连接数据库
docker exec -it device-manager-db mysql -u device_user -pdevice_pass_123 device_management
```

### 清理系统

```powershell
# 停止并删除容器
docker-compose down

# 删除容器和卷（⚠️ 会删除所有数据）
docker-compose down -v

# 删除未使用的镜像
docker image prune

# 清理所有未使用的资源
docker system prune -a
```

---

## 配置说明

### docker-compose.yml 配置

```yaml
services:
  mysql:
    ports:
      - "3307:3306"  # 本地端口:容器端口
    environment:
      MYSQL_ROOT_PASSWORD: root_password_123
      MYSQL_DATABASE: device_management
      MYSQL_USER: device_user
      MYSQL_PASSWORD: device_pass_123
    volumes:
      - mysql_data:/var/lib/mysql  # 数据持久化

  app:
    ports:
      - "5000:5000"  # 应用端口
    volumes:
      - ./uploads:/app/uploads  # 文件上传目录
    depends_on:
      - mysql  # 依赖数据库启动
```

### 端口映射

- **5000**：应用端口（可在 docker-compose.yml 中修改）
- **3307**：MySQL 端口（映射到 3307 避免与本地 MySQL 冲突）

如需修改应用端口，编辑 `docker-compose.yml`：

```yaml
app:
  ports:
    - "8080:5000"  # 改为 8080 端口
```

### 数据持久化

系统使用 Docker 卷存储数据：

- **mysql_data**：数据库数据
- **./uploads**：上传的文件（映射到宿主机）

---

## 局域网部署

### 1. 获取本机 IP

```powershell
# 查看本机 IP
ipconfig

# 找到以太网适配器或 WLAN 的 IPv4 地址
# 例如：192.168.1.100
```

### 2. 配置防火墙

**方式 1：使用 PowerShell（推荐）**

```powershell
# 允许 5000 端口入站（需管理员权限）
New-NetFirewallRule -DisplayName "Device Manager" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

**方式 2：手动配置**

1. 打开 Windows 防火墙设置
2. 点击"高级设置"
3. 选择"入站规则" → "新建规则"
4. 选择"端口" → 下一步
5. 选择"TCP"，特定本地端口：5000
6. 允许连接
7. 应用于所有配置文件
8. 命名规则（如"Device Manager"）

### 3. 局域网访问

在局域网内其他电脑的浏览器中访问：

```
http://192.168.1.100:5000
```

### 4. 测试连接

在其他电脑上测试：

```powershell
# 测试端口是否可访问
Test-NetConnection -ComputerName 192.168.1.100 -Port 5000
```

---

## 故障排查

### 问题 1：Docker Desktop 无法启动

**症状：** Docker Desktop 启动失败或卡在启动界面

**解决方案：**
1. 确保已启用 WSL 2 功能
   ```powershell
   # 管理员权限执行
   wsl --install
   wsl --set-default-version 2
   ```

2. 更新 Windows 到最新版本

3. 重置 Docker Desktop：
   - 右键任务栏 Docker 图标
   - 选择"Troubleshoot" → "Reset to factory defaults"

### 问题 2：端口被占用

**症状：** 提示端口 5000 或 3307 被占用

**解决方案：**
```powershell
# 查看端口占用
netstat -ano | findstr :5000

# 修改 docker-compose.yml 中的端口映射
ports:
  - "8080:5000"  # 改用其他端口
```

### 问题 3：容器无法启动

**症状：** `docker-compose ps` 显示容器状态异常

**解决方案：**
```powershell
# 查看详细日志
docker-compose logs app
docker-compose logs mysql

# 重新构建镜像
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 问题 4：数据库连接失败

**症状：** 应用日志显示数据库连接错误

**解决方案：**
```powershell
# 检查数据库容器是否健康
docker exec device-manager-db mysqladmin ping -h localhost

# 等待更长时间让数据库初始化
Start-Sleep -Seconds 30

# 重启应用容器
docker-compose restart app
```

### 问题 5：前端页面无法访问

**症状：** 访问 http://localhost:5000 显示无法连接

**解决方案：**
1. 检查容器是否运行
   ```powershell
   docker-compose ps
   ```

2. 检查应用日志
   ```powershell
   docker-compose logs app
   ```

3. 检查端口是否正确映射
   ```powershell
   docker port device-manager-app
   ```

### 问题 6：构建镜像失败

**症状：** `docker-compose build` 失败

**解决方案：**
```powershell
# 清理构建缓存
docker builder prune

# 使用 --no-cache 重新构建
docker-compose build --no-cache

# 检查网络连接（npm 安装可能需要代理）
```

---

## 数据备份

### 备份数据库

```powershell
# 备份到 SQL 文件
docker exec device-manager-db mysqldump -u device_user -pdevice_pass_123 device_management > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# 或使用脚本
$backupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
docker exec device-manager-db mysqldump -u device_user -pdevice_pass_123 device_management | Out-File -Encoding UTF8 $backupFile
Write-Host "备份完成: $backupFile"
```

### 恢复数据库

```powershell
# 从 SQL 文件恢复
Get-Content backup.sql | docker exec -i device-manager-db mysql -u device_user -pdevice_pass_123 device_management
```

### 备份上传文件

```powershell
# 备份 uploads 目录
Compress-Archive -Path ./uploads -DestinationPath "uploads_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"
```

### 完整备份脚本

创建 `backup.ps1`：

```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\backups\$timestamp"

Write-Host "开始备份..." -ForegroundColor Cyan

# 创建备份目录
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# 备份数据库
Write-Host "备份数据库..." -ForegroundColor Yellow
docker exec device-manager-db mysqldump -u device_user -pdevice_pass_123 device_management > "$backupDir\database.sql"

# 备份上传文件
Write-Host "备份上传文件..." -ForegroundColor Yellow
Copy-Item -Recurse ./uploads "$backupDir\uploads"

# 打包
Write-Host "压缩备份..." -ForegroundColor Yellow
Compress-Archive -Path $backupDir -DestinationPath "backup_$timestamp.zip"
Remove-Item -Recurse -Force $backupDir

Write-Host "✅ 备份完成: backup_$timestamp.zip" -ForegroundColor Green
```

---

## 卸载系统

### 完全卸载

```powershell
# 1. 停止并删除容器
docker-compose down

# 2. 删除数据卷（⚠️ 会删除所有数据）
docker volume rm manger_mysql_data

# 3. 删除镜像
docker rmi manger_app
docker rmi mysql:8.0

# 4. 清理未使用的资源
docker system prune -a
```

### 保留数据的卸载

```powershell
# 只停止容器，保留数据
docker-compose down
```

后续重新部署时，数据会保留。

---

## 性能优化

### 1. 调整内存限制

编辑 `docker-compose.yml`：

```yaml
services:
  mysql:
    deploy:
      resources:
        limits:
          memory: 1G
  
  app:
    deploy:
      resources:
        limits:
          memory: 512M
```

### 2. 配置 Docker Desktop

1. 打开 Docker Desktop 设置
2. Resources → Advanced
3. 调整分配给 Docker 的 CPU 和内存
   - 推荐：4 CPUs, 4GB Memory

---

## 更新系统

```powershell
# 1. 拉取最新代码
git pull

# 2. 停止旧容器
docker-compose down

# 3. 重新构建镜像
docker-compose build --no-cache

# 4. 启动新容器
docker-compose up -d

# 5. 查看日志确认
docker-compose logs -f
```

---

## 技术支持

### 日志位置

- **应用日志：** `docker-compose logs app`
- **数据库日志：** `docker-compose logs mysql`
- **Docker 日志：** `%LOCALAPPDATA%\Docker\log.txt`

### 常见文档

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [项目 README](./README.md)

### 获取帮助

```powershell
# Docker 帮助
docker --help
docker-compose --help

# 查看容器详情
docker inspect device-manager-app
docker inspect device-manager-db
```

---

## 附录

### A. 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_HOST` | 数据库主机 | mysql |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_USER` | 数据库用户 | device_user |
| `DB_PASSWORD` | 数据库密码 | device_pass_123 |
| `DB_NAME` | 数据库名称 | device_management |
| `USE_OSS_STORAGE` | 是否使用 OSS | false |
| `OSS_REGION` | OSS 区域 | oss-cn-shanghai |
| `OSS_BUCKET` | OSS 存储桶 | els-pub-04 |
| `PORT` | 应用端口 | 5000 |

### B. 目录结构

```
manger/
├── client/build/        # 前端构建产物（容器内）
├── server/              # 后端代码
├── uploads/             # 文件上传目录（持久化）
│   ├── product-documents/
│   └── productions/
├── Dockerfile           # 镜像构建文件
├── docker-compose.yml   # 服务编排文件
├── .env                 # 环境变量（需创建）
├── .env.docker          # 环境变量模板
├── deploy.ps1           # 部署脚本
├── stop.ps1             # 停止脚本
├── logs.ps1             # 日志脚本
└── restart.ps1          # 重启脚本
```

### C. 网络架构

```
外部网络 (localhost:5000)
    │
    ↓
device-manager-app (容器)
    │
    ↓ 内部网络
    │
device-manager-db (容器:3306)
    │
    ↓
mysql_data (数据卷)
```

---

**祝部署顺利！🚀**
