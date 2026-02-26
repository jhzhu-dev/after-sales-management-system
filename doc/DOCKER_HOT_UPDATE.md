# Docker容器热更新部署指南

本文档总结了在Docker容器化部署环境中，如何将代码修改快速部署到生产环境的完整流程。

---

## 📋 背景说明

本项目使用Docker Compose进行容器化部署，包含两个主要服务：
- **MySQL数据库容器**：`device-manager-db`
- **Node.js应用容器**：`device-manager-app`

应用容器包含前端构建文件（React）和后端服务（Express），通过端口5000对外提供服务。

---

## 🔄 完整部署流程

### 方案一：完整重新构建（标准流程）

适用场景：首次部署、依赖更新、Dockerfile修改

#### 步骤 1：修改源代码

```bash
# 修改 client/src 下的前端代码
# 修改 server 下的后端代码
```

#### 步骤 2：前端构建

```powershell
cd client
npm run build
cd ..
```

构建产物位于：`client/build/`

#### 步骤 3：停止现有容器

```powershell
docker-compose down
```

#### 步骤 4：清理Docker缓存（可选）

```powershell
# 清理构建缓存，确保使用最新代码
docker system prune -f
```

#### 步骤 5：重新构建并启动

```powershell
# 使用 --build 参数强制重新构建镜像
docker-compose up -d --build
```

或使用项目提供的部署脚本：

```powershell
.\deploy.ps1
```

#### 步骤 6：验证部署

```powershell
# 查看容器状态
docker-compose ps

# 查看应用日志
docker-compose logs -f app
```

访问 http://localhost:5000 验证更新是否生效。

---

### 方案二：热更新（快速部署）

适用场景：
- 仅修改前端代码
- Docker网络问题导致无法重新构建镜像
- 需要快速更新不想等待完整构建

#### 步骤 1：修改源代码并构建前端

```powershell
cd client
npm run build
cd ..
```

#### 步骤 2：复制构建文件到容器

```powershell
# 将本地构建文件复制到运行中的容器内
docker cp client/build/. device-manager-app:/app/client/build/
```

#### 步骤 3：重启应用容器

```powershell
# 仅重启应用容器，不影响数据库
docker-compose restart app
```

#### 步骤 4：验证更新

```powershell
docker-compose ps
```

访问 http://localhost:5000 并清除浏览器缓存验证更新。

---

## 🚨 常见问题与解决方案

### 问题 1：更新后浏览器仍显示旧内容

**原因：** 浏览器缓存了旧的静态文件（JS/CSS）

**解决方案：**

```
方法1：强制刷新（推荐）
- Windows: Ctrl + Shift + R 或 Ctrl + F5
- Mac: Cmd + Shift + R

方法2：清除浏览器缓存
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

方法3：无痕模式
- 使用浏览器的无痕/隐私模式访问
```

---

### 问题 2：Docker镜像构建失败

**错误信息：**
```
failed to resolve source metadata for docker.io/library/node:18-alpine
```

**原因：** 
- Docker网络连接问题
- 镜像下载损坏

**解决方案：**

```powershell
# 方法1：清理Docker缓存后重试
docker system prune -a -f
docker-compose up -d --build

# 方法2：重启Docker Desktop
# 右键任务栏Docker图标 -> Restart

# 方法3：使用热更新方案（见方案二）
# 无需重新构建镜像，直接复制文件到容器
```

---

### 问题 3：如何确认容器使用的是最新代码

**检查镜像创建时间：**

```powershell
docker images | Select-String "manger"
```

输出示例：
```
manger-app    latest    1a37bb0c81fc   11 days ago    271MB
                                        ↑ 镜像创建时间
```

如果镜像时间较旧，说明容器运行的是旧代码，需要重新构建或使用热更新。

**检查构建文件时间：**

```powershell
Get-ChildItem -Path "client\build\static\js\main.*.js" | Select-Object Name, LastWriteTime
```

---

### 问题 4：Docker容器无法访问

**检查容器状态：**

```powershell
docker-compose ps
```

正常状态应显示：
```
device-manager-app   Up X seconds
device-manager-db    Up X seconds (healthy)
```

**查看错误日志：**

```powershell
# 查看应用日志
docker-compose logs app

# 实时查看日志
docker-compose logs -f app
```

---

## 🌐 局域网访问配置

### 1. 获取本机IP

```powershell
ipconfig
```

找到IPv4地址，例如：`192.168.1.100`

### 2. 配置防火墙

**允许5000端口入站（需管理员权限）：**

```powershell
New-NetFirewallRule -DisplayName "Device Manager" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

### 3. 局域网访问

在其他设备浏览器中访问：
```
http://192.168.1.100:5000
```

---

## 📝 完整部署示例

### 场景：修改前端代码并部署

```powershell
# 1. 确认当前在项目根目录
cd D:\py_project\manger

# 2. 修改代码后，构建前端
cd client
npm run build
cd ..

# 3. 复制到容器（快速方案）
docker cp client/build/. device-manager-app:/app/client/build/

# 4. 重启应用容器
docker-compose restart app

# 5. 验证状态
docker-compose ps

# 6. 查看日志（可选）
docker-compose logs -f app
```

---

## 🛠 常用管理命令

### 容器管理

```powershell
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart app
docker-compose restart mysql

# 查看容器状态
docker-compose ps

# 查看容器资源占用
docker stats
```

### 日志管理

```powershell
# 查看所有日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看应用日志
docker-compose logs -f app

# 查看最近100行
docker-compose logs --tail=100 app
```

### 数据管理

```powershell
# 进入应用容器
docker exec -it device-manager-app sh

# 进入数据库容器
docker exec -it device-manager-db bash

# 连接MySQL数据库
docker exec -it device-manager-db mysql -u device_user -pdevice_pass_123 device_management

# 备份数据库
docker exec device-manager-db mysqldump -u device_user -pdevice_pass_123 device_management > backup.sql

# 恢复数据库
docker exec -i device-manager-db mysql -u device_user -pdevice_pass_123 device_management < backup.sql
```

### 清理命令

```powershell
# 停止并删除容器（保留数据）
docker-compose down

# 停止并删除容器和卷（⚠️删除所有数据）
docker-compose down -v

# 删除未使用的镜像
docker image prune -a

# 清理所有未使用的资源
docker system prune -a -f
```

---

## 🔍 故障排查清单

### 更新后页面没有变化

- [ ] 前端是否已重新构建？（检查 `client/build` 目录修改时间）
- [ ] 构建文件是否已复制到容器？
- [ ] 应用容器是否已重启？
- [ ] 浏览器缓存是否已清除？（强制刷新：Ctrl+Shift+R）

### 容器无法启动

- [ ] Docker Desktop是否正在运行？
- [ ] 端口5000是否被占用？
- [ ] 查看容器日志找到错误信息
- [ ] 检查 `.env` 配置文件是否正确

### 局域网无法访问

- [ ] 防火墙是否允许5000端口？
- [ ] 设备是否在同一局域网？
- [ ] IP地址是否正确？
- [ ] 容器端口映射是否正确？（0.0.0.0:5000）

---

## 📚 相关文档

- [完整Docker部署指南](./DOCKER_DEPLOYMENT.md) - 详细的Docker部署文档
- [项目README](../README.md) - 项目概述和功能说明
- [docker-compose.yml](../docker-compose.yml) - 容器编排配置
- [Dockerfile](../Dockerfile) - 镜像构建配置

---

## 💡 最佳实践

1. **开发环境测试**：在本地测试无误后再构建部署
2. **定期备份数据**：部署前备份数据库
3. **查看日志**：部署后检查容器日志确认无错误
4. **使用热更新**：仅前端修改时使用热更新节省时间
5. **完整重建**：依赖更新或重大改动时使用完整重建流程
6. **版本控制**：重要部署前打tag标记版本

---

## 📅 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-02-26 | 1.0 | 创建文档，记录热更新部署流程 |

---

**总结**

本文档提供了两种部署方案：
- **完整重建**：适合首次部署或重大更新，更可靠但耗时较长
- **热更新**：适合快速迭代和前端修改，快速但需要注意浏览器缓存

根据实际情况选择合适的部署方案，确保及时、安全地将代码更新部署到生产环境。
