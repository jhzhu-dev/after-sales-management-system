## Context
生产服务器：局域网内一台 Windows 主机，运行 Docker Desktop。
MySQL 8.0 数据以 Docker named volume（mysql_data）持久化。
NAS 地址：\\elsvision\jhzhu\After-sales-service，SMB 协议，账号 jhzhu。
Windows 主机可通过 UNC 路径直接访问，无需映射驱动器盘符。

## Goals / Non-Goals
- Goals:
  - MySQL 容器在崩溃/OOM 后自动恢复，数据不丢失
  - 每日全量备份，本地保留 7 天，NAS 保留 14 天
  - 支持手动触发备份和从备份恢复
  - NAS 凭据安全存储，不出现在代码/脚本文件中
  - 备份失败时日志可查
- Non-Goals:
  - 增量/binlog 备份（当前数据量级不需要）
  - 跨机房/云端容灾
  - 数据库读写分离

## Decisions

### 决策1：备份执行方式 → Docker 备份容器 + Windows 计划任务同步
- **选用**：`db-backup` 容器内用 busybox crond 定时执行 mysqldump，
  输出到 bind mount `./backups/` 本地目录；
  Windows 计划任务每日运行 `backup.ps1`，用 robocopy 同步到 NAS。
- 放弃方案（直接 mount NAS 路径到 Docker）：Docker Desktop for Windows
  不稳定支持 SMB 网络路径作为 bind mount，NAS 断网会导致容器挂起。
- 放弃方案（纯 Windows 计划任务 docker exec）：依赖 Docker 服务状态，
  缺乏独立日志，容错能力弱。

### 决策2：备份镜像 → mysql:8.0（与主库同版本）
与主库相同版本，避免 mysqldump 客户端/服务端版本不兼容。

### 决策3：NAS 同步工具 → robocopy
Windows 内置，无需安装额外软件，支持镜像同步（/MIR 自动清理过期文件）、
断点续传，适合局域网大文件传输。

### 决策4：NAS 凭据管理 → Windows 凭据管理器（cmdkey）
`setup-backup-task.ps1` 首次运行时执行：
  cmdkey /add:elsvision /user:jhzhu /pass:Zhujiahao123
凭据写入操作系统凭据保险库，之后 backup.ps1 通过 UNC 路径直接访问 NAS，
无需再次提供密码，且密码不出现在任何脚本文件中。

### 决策5：MySQL 稳定性加固参数
| 参数 | 值 | 原因 |
|------|----|------|
| innodb_buffer_pool_size | 256M | 减少磁盘 I/O，适合小型 LAN 服务器 |
| max_connections | 50 | 防止连接耗尽 |
| slow_query_log | ON | 定位慢查询 |
| long_query_time | 2 | 超过 2 秒记录慢查询日志 |
| mem_limit (Docker) | 512m | 防止 OOM 冲击宿主机 |

### 决策6：备份保留策略
- 本地（`./backups/`）：7 天（备份容器脚本自动清理）
- NAS：14 天（robocopy /MIR + 时间过滤 /MINAGE:14）

## Risks / Trade-offs
- NAS 断网期间 robocopy 同步失败 → 本地仍有 7 天副本，降低数据丢失窗口
- setup-backup-task.ps1 需以管理员权限运行（注册计划任务需要）
- mysqldump 期间数据库高负载 → 选择凌晨 01:00 低峰时段执行

## Migration Plan
1. 以管理员身份运行 setup-backup-task.ps1（一次性，写入凭据 + 注册计划任务）
2. 更新 docker-compose.yml（不影响现有数据）
3. `docker-compose up -d` 重启，验证 mysql 以新参数运行
4. 手动触发备份：`docker exec device-manager-db-backup /backup.sh`
5. 手动运行 backup.ps1，确认文件出现在 NAS 目标路径
6. 检查 Windows 任务计划程序中两个任务已注册

## Open Questions
- 无（NAS 路径、账号、密码已全部确认）
