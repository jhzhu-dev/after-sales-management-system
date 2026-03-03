## 1. MySQL 稳定性加固
- [x] 1.1 修改 docker-compose.yml：mysql 服务添加 command 参数（innodb_buffer_pool_size、max_connections、slow_query_log）
- [x] 1.2 修改 docker-compose.yml：mysql 服务添加 deploy.resources.limits.memory: 512m
- [x] 1.3 修改 docker-compose.yml：增强 mysql healthcheck（retries: 10, start_period: 60s）
- [x] 1.4 修改 docker-compose.yml：app 服务确认 restart: unless-stopped 已设置

## 2. 备份容器
- [x] 2.1 创建 scripts/backup-entrypoint.sh：mysqldump + gzip 压缩 + 文件命名 + 7 天本地清理
- [x] 2.2 修改 docker-compose.yml：新增 db-backup 服务（mysql:8.0、crond、bind mount ./backups）

## 3. NAS 同步脚本
- [x] 3.1 创建 backup.ps1：robocopy 同步 ./backups → \\elsvision\jhzhu\After-sales-service，含日志输出

## 4. 首次部署配置脚本
- [x] 4.1 创建 setup-backup-task.ps1：写入 NAS 凭据到 Windows 凭据管理器 + 注册两个计划任务

## 5. 数据库恢复脚本
- [x] 5.1 创建 restore.ps1：列出可用备份 → 用户选择 → 确认警告 → docker exec 导入 MySQL

## 6. 文档
- [x] 6.1 创建 doc/BACKUP_GUIDE.md：首次部署步骤、日常运维命令、NAS 配置说明、恢复流程
