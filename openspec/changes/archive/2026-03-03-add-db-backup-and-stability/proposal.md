## Why
系统已进入生产环境，MySQL 数据库运行在单个 Docker 容器中，
目前缺乏性能调优、资源限制和数据备份机制。
一旦主机宕机或容器崩溃，存在数据丢失和长时间停机风险。
需要建立数据库稳定性加固方案，并将定期备份自动同步到局域网 NAS（\\elsvision\jhzhu\After-sales-service）。

## What Changes
- 在 docker-compose.yml 中为 MySQL 添加性能调优参数、资源限制（512M）和增强健康检查
- 新增 `db-backup` 专用备份容器，每日凌晨 01:00 执行 mysqldump，本地保留 7 天
- 新增 `backup.ps1`：每日 02:00 通过 robocopy 将备份同步到 NAS，NAS 保留 14 天
- 新增 `setup-backup-task.ps1`：首次运行时将 NAS 凭据写入 Windows 凭据管理器，并注册计划任务
- 新增 `restore.ps1`：列出可用备份，用户选择后一键恢复数据库
- 新增 `scripts/backup-entrypoint.sh`：备份容器内实际执行 mysqldump 的脚本

## Impact
- Affected specs: db-backup
- Affected code: docker-compose.yml（新增 db-backup 服务、mysql 参数调优）
- 新增文件: backup.ps1, setup-backup-task.ps1, restore.ps1, scripts/backup-entrypoint.sh, doc/BACKUP_GUIDE.md
- 外部依赖：NAS \\elsvision\jhzhu\After-sales-service（SMB，用户 jhzhu）
- 无 API 破坏性变更，对前端零影响
