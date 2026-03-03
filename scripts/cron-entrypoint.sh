#!/bin/bash
# =============================================================================
# cron-entrypoint.sh — 备份容器启动入口（Linux 版）
# 功能：
#   1. 将 Docker 环境变量导出到文件（cron 子进程无法继承 Docker 环境变量）
#   2. 注册定时任务（01:00 备份 / 02:00 NAS 同步）
#   3. 前台运行 cron，保持容器存活
# =============================================================================

set -e

echo "=== Device Manager Backup Container Starting ==="

# ─── 设置时区 ─────────────────────────────────────────────────────────────────
if [ -n "${TZ:-}" ]; then
  ln -snf /usr/share/zoneinfo/${TZ} /etc/localtime
  echo "${TZ}" > /etc/timezone
  echo "Timezone set to: ${TZ}"
fi

# ─── 将环境变量持久化到文件供 cron 子进程读取 ────────────────────────────────
# cron 以独立进程运行，不继承 docker run 的环境变量
ENV_FILE="/etc/backup-env"
printenv | grep -E "^(MYSQL_|BACKUP_|NAS_|TZ)" > "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
echo "Environment exported to ${ENV_FILE}"

# ─── 注册 cron 任务 ──────────────────────────────────────────────────────────
CRON_FILE="/etc/cron.d/db-backup"
cat > "${CRON_FILE}" << 'CRONEOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# 每日 01:00 执行数据库全量备份
0 1 * * * root set -a && . /etc/backup-env && set +a && /bin/bash /backup.sh >> /backups/backup.log 2>&1

# 每日 02:00 同步备份到 NAS
0 2 * * * root set -a && . /etc/backup-env && set +a && /bin/bash /nas-sync.sh >> /backups/sync.log 2>&1
CRONEOF

chmod 0644 "${CRON_FILE}"

echo "=== Cron jobs registered ==="
echo "  01:00 daily → /backup.sh    (mysqldump → /backups/)"
echo "  02:00 daily → /nas-sync.sh  (smbclient → NAS)"
echo "=== Container ready. Running cron in foreground... ==="

# 前台运行 cron，容器保持活跃
exec cron -f
