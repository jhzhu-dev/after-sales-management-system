#!/bin/bash
# =============================================================================
# 数据库全量备份脚本
# 由 db-backup 容器内的 crond 每日凌晨 01:00 调用
# 输出目录：/backups（宿主机 ./backups/ 的 bind mount）
# =============================================================================

set -euo pipefail

# ─── 配置 ─────────────────────────────────────────────────────────────────────
BACKUP_DIR="/backups"
DB_HOST="${MYSQL_HOST:-mysql}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_USER="${MYSQL_USER:-device_user}"
DB_PASSWORD="${MYSQL_PASSWORD}"
DB_NAME="${MYSQL_DATABASE:-device_management}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# ─── 创建备份目录 ──────────────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup: ${BACKUP_FILE}"

# ─── 等待数据库就绪 ────────────────────────────────────────────────────────────
MAX_WAIT=60
WAITED=0
until mysqladmin ping -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" --silent 2>/dev/null; do
  if [ ${WAITED} -ge ${MAX_WAIT} ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Database not reachable after ${MAX_WAIT}s. Aborting."
    exit 1
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for database... (${WAITED}s)"
  sleep 5
  WAITED=$((WAITED + 5))
done

# ─── 执行备份 ─────────────────────────────────────────────────────────────────
# --single-transaction: InnoDB 一致性快照，不锁表
# --routines --events: 导出存储过程和事件
# --set-gtid-purged=OFF: 避免 GTID 相关警告
if mysqldump \
    -h"${DB_HOST}" \
    -P"${DB_PORT}" \
    -u"${DB_USER}" \
    -p"${DB_PASSWORD}" \
    --single-transaction \
    --routines \
    --events \
    --no-tablespaces \
    --set-gtid-purged=OFF \
    --databases "${DB_NAME}" \
  | gzip -9 > "${BACKUP_FILE}.tmp"; then

  # 原子性重命名：备份成功后才生成最终文件
  mv "${BACKUP_FILE}.tmp" "${BACKUP_FILE}"
  FILESIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully: ${BACKUP_FILE} (${FILESIZE})"
else
  # 备份失败，清理临时文件
  rm -f "${BACKUP_FILE}.tmp"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: mysqldump failed. No backup file created."
  exit 1
fi

# ─── 清理过期备份（本地保留 RETAIN_DAYS 天）────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up backups older than ${RETAIN_DAYS} days..."
find "${BACKUP_DIR}" -maxdepth 1 -name "${DB_NAME}_*.sql.gz" -mtime +${RETAIN_DAYS} -print -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup complete."

# ─── 列出当前备份文件 ──────────────────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current backups:"
ls -lh "${BACKUP_DIR}"/${DB_NAME}_*.sql.gz 2>/dev/null || echo "  (none)"
