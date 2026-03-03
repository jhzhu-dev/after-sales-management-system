## ADDED Requirements

### Requirement: MySQL 性能调优与资源限制
数据库容器 SHALL 以优化参数运行，并设置内存资源上限，防止 OOM 影响宿主机稳定性。

#### Scenario: 容器以调优参数启动
- **WHEN** 执行 docker-compose up
- **THEN** MySQL 容器以 innodb_buffer_pool_size=256M、max_connections=50、slow_query_log=ON 运行，Docker 内存限制为 512m

#### Scenario: 容器崩溃后自动重启
- **WHEN** MySQL 容器因任意原因退出
- **THEN** Docker 自动重启容器（restart: unless-stopped），mysql_data 卷数据不丢失

### Requirement: 定时全量数据库备份
系统 SHALL 每日凌晨 01:00 自动执行 mysqldump 全量备份，备份文件以日期时间命名并 gzip 压缩，存储于宿主机 ./backups/ 目录，本地保留最近 7 天。

#### Scenario: 定时备份成功
- **WHEN** 每日凌晨 01:00 crond 触发备份
- **THEN** 在 ./backups/ 生成形如 device_management_2026-03-03_0100.sql.gz 的压缩文件，容器日志记录 "Backup completed successfully"

#### Scenario: 备份失败
- **WHEN** mysqldump 执行失败（如数据库不可达）
- **THEN** 容器日志记录错误信息，不产生损坏的备份文件，下次执行时重试

#### Scenario: 本地备份自动清理
- **WHEN** ./backups/ 中存在超过 7 天的备份文件
- **THEN** 备份脚本自动删除过期文件，保留最新 7 天

### Requirement: 备份文件同步到局域网 NAS
系统 SHALL 每日凌晨 02:00 将本地备份文件同步到 \\elsvision\jhzhu\After-sales-service，NAS 上保留最近 14 天的备份。

#### Scenario: NAS 同步成功
- **WHEN** backup.ps1 执行（计划任务每日 02:00 触发）
- **THEN** ./backups/ 中所有文件被 robocopy 镜像同步到 NAS 目标路径，同步日志写入 ./backups/sync.log

#### Scenario: NAS 不可达时的降级
- **WHEN** backup.ps1 执行时 NAS 主机 elsvision 不可达
- **THEN** robocopy 退出并记录错误到 sync.log，本地 ./backups/ 文件不受影响

### Requirement: NAS 凭据安全存储
系统 SHALL 通过 Windows 凭据管理器存储 NAS 访问凭据，不将密码硬编码到任何脚本或配置文件中。

#### Scenario: 首次配置写入凭据
- **WHEN** 管理员以管理员权限运行 setup-backup-task.ps1
- **THEN** NAS 凭据（用户 jhzhu）写入 Windows 凭据管理器，backup.ps1 后续访问 UNC 路径无需提供密码

### Requirement: 数据库一键恢复
系统 SHALL 提供 restore.ps1 脚本，支持从 ./backups/ 中指定备份文件恢复数据库，执行前须人工确认。

#### Scenario: 从本地备份恢复成功
- **WHEN** 执行 restore.ps1 并选择指定备份文件，输入 yes 确认
- **THEN** 备份文件通过 docker exec 导入到运行中的 MySQL 容器，完成后输出 "Restore completed"

#### Scenario: 用户取消恢复
- **WHEN** restore.ps1 显示警告后用户输入非 yes 内容
- **THEN** 脚本中止，数据库不做任何变更
