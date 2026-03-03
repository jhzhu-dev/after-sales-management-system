# 数据库备份与恢复指南

> **适用环境：** 生产服务器（局域网 Windows 主机 + Docker Desktop）  
> **NAS 地址：** \\elsvision\jhzhu\After-sales-service  
> **本地备份目录：** `.\backups\`

---

## 快速概览

| 机制 | 时间 | 保留 | 存储位置 |
|------|------|------|----------|
| 容器内 mysqldump | 每日 01:00 | 7 天 | 服务器 `.\backups\` |
| NAS 同步 (robocopy) | 每日 02:00 | 14 天 | NAS `\\elsvision\jhzhu\After-sales-service` |

---

## 一、首次部署步骤（仅需执行一次）

### 1. 以管理员身份打开 PowerShell

```powershell
# 右键开始菜单 → Windows PowerShell（管理员）
cd D:\py_project\manger
```

### 2. 运行初始化脚本

```powershell
.\setup-backup-task.ps1
```

脚本会自动完成：
- ✅ 将 NAS 凭据（jhzhu）写入 Windows 凭据管理器（密码不再出现在任何文件中）
- ✅ 注册计划任务 `DeviceManager-NASBackupSync`（每日 02:00）

### 3. 启动 Docker 服务

```powershell
docker-compose up -d
```

启动后包含三个容器：
- `device-manager-db`：MySQL 主数据库（资源限制 512MB，调优参数已生效）
- `device-manager-app`：Node.js 应用
- `device-manager-db-backup`：备份容器（每日 01:00 自动执行 mysqldump）

### 4. 验证备份环境

```powershell
# 手动触发一次备份（测试）
docker exec device-manager-db-backup /bin/bash /backup.sh

# 检查备份文件是否生成
Get-ChildItem .\backups\*.sql.gz | Select-Object Name, LastWriteTime, Length

# 手动测试 NAS 同步
.\backup.ps1

# 验证文件出现在 NAS
Get-ChildItem "\\elsvision\jhzhu\After-sales-service\*.sql.gz"
```

---

## 二、日常运维命令

### 查看备份日志

```powershell
# 容器内备份日志（最新 50 行）
docker logs device-manager-db-backup --tail 50

# 本地备份日志
Get-Content .\backups\backup.log -Tail 50

# NAS 同步日志
Get-Content .\backups\sync.log -Tail 50

# robocopy 详细日志
Get-Content .\backups\robocopy.log -Tail 100
```

### 手动触发操作

```powershell
# 立即执行数据库备份（无需等待凌晨 01:00）
docker exec device-manager-db-backup /bin/bash /backup.sh

# 立即同步到 NAS（无需等待凌晨 02:00）
.\backup.ps1

# 强制全量同步（无论文件是否已存在于 NAS）
.\backup.ps1 -Force
```

### 查看当前备份文件

```powershell
# 本地备份
Get-ChildItem .\backups\*.sql.gz | Sort-Object LastWriteTime -Descending |
  Select-Object Name, @{N="大小(MB)";E={"{0:N2}"-f($_.Length/1MB)}}, LastWriteTime

# NAS 备份
Get-ChildItem "\\elsvision\jhzhu\After-sales-service\*.sql.gz" |
  Sort-Object LastWriteTime -Descending |
  Select-Object Name, @{N="大小(MB)";E={"{0:N2}"-f($_.Length/1MB)}}, LastWriteTime
```

### 查看计划任务状态

```powershell
Get-ScheduledTask -TaskName "DeviceManager*" |
  Select-Object TaskName, State, @{N="下次运行";E={($_ | Get-ScheduledTaskInfo).NextRunTime}}
```

---

## 三、数据库恢复流程

### ⚠️ 恢复前注意事项
- 恢复操作会**覆盖当前数据库所有数据**，不可撤销
- 建议恢复前先手动执行一次最新备份，保留现场
- 恢复过程中应用会有短暂不可用（约 1-5 分钟，取决于数据量）

### 从本地备份恢复（推荐）

```powershell
.\restore.ps1
```

脚本会：
1. 列出 `.\backups\` 中所有可用备份文件（最新在前）
2. 让您选择要恢复的备份
3. 显示警告并要求输入 `yes` 确认
4. 执行恢复并输出结果

### 从 NAS 备份恢复（本地备份丢失时使用）

**方法一：将 NAS 文件先复制到本地**

```powershell
# 从 NAS 复制所需备份到本地
Copy-Item "\\elsvision\jhzhu\After-sales-service\device_management_2026-03-02_0100.sql.gz" .\backups\

# 再执行恢复
.\restore.ps1
```

**方法二：直接从 NAS 恢复**

```powershell
.\restore.ps1 -FromNas
```

### 指定备份文件恢复（跳过交互选择）

```powershell
.\restore.ps1 -File "device_management_2026-03-02_0100.sql.gz"
```

---

## 四、NAS 配置说明

### NAS 凭据已注册

凭据存储在 Windows 凭据管理器中，无需每次提供密码。

**查看已存储的凭据：**
```powershell
cmdkey /list | Select-String "elsvision"
```

**如需更新凭据（密码变更时）：**
```powershell
# 以管理员身份运行
cmdkey /add:elsvision /user:jhzhu /pass:<新密码>
```

**如需删除凭据：**
```powershell
cmdkey /delete:elsvision
```

### NAS 共享目录要求
- 共享路径：`\\elsvision\jhzhu\After-sales-service`（目录须事先在 NAS 上创建）
- 用户 `jhzhu` 须对该目录有**读写**权限

---

## 五、MySQL 性能调优说明

以下参数已在 `docker-compose.yml` 中配置：

| 参数 | 值 | 说明 |
|------|----|------|
| `innodb_buffer_pool_size` | 256M | InnoDB 内存缓冲，减少磁盘 I/O |
| `max_connections` | 50 | 最大并发连接数 |
| `slow_query_log` | ON | 开启慢查询日志 |
| `long_query_time` | 2 | 超过 2 秒记录为慢查询 |
| Docker `mem_limit` | 512m | 内存上限，防止 OOM 冲击宿主机 |

**查看慢查询日志：**
```powershell
docker exec device-manager-db bash -c "tail -50 /var/lib/mysql/slow.log"
```

---

## 六、故障排查

### 备份容器不执行备份

```powershell
# 查看容器状态
docker ps | Select-String "backup"

# 查看容器日志
docker logs device-manager-db-backup --tail 100

# 手动执行测试
docker exec device-manager-db-backup /bin/bash /backup.sh
```

### NAS 同步失败

```powershell
# 测试 NAS 连通性
Test-Path "\\elsvision\jhzhu\After-sales-service"

# 重新注册 NAS 凭据（管理员身份）
cmdkey /add:elsvision /user:jhzhu /pass:Zhujiahao123

# 手动执行同步并查看输出
.\backup.ps1
```

### 计划任务未执行

```powershell
# 查看任务状态
Get-ScheduledTask "DeviceManager-NASBackupSync" | Get-ScheduledTaskInfo

# 查看任务历史（需开启任务历史记录）
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 20 |
  Where-Object { $_.Message -like "*DeviceManager*" } |
  Select-Object TimeCreated, Message

# 重新注册任务（管理员身份）
.\setup-backup-task.ps1
```

### MySQL 容器 OOM 被杀

```powershell
# 查看容器退出原因
docker inspect device-manager-db --format="{{.State.OOMKilled}}"

# 若返回 true，说明内存不足，可在 docker-compose.yml 中调整 mem_limit
# 调整后重启：
docker-compose up -d mysql
```
