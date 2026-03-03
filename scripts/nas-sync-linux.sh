#!/bin/bash
# =============================================================================
# nas-sync-linux.sh — 备份文件同步到 NAS（Linux 版，使用 smbclient）
# NAS: //elsvision/jhzhu/After-sales-service
# 由 cron 每日 02:00 执行，也可手动触发：
#   docker exec device-manager-db-backup /bin/bash /nas-sync.sh
# =============================================================================

set -euo pipefail

# ─── 配置（从环境变量读取，默认值作兜底）────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/backups}"
NAS_HOST="${NAS_HOST:-elsvision}"
NAS_SHARE="${NAS_SHARE:-jhzhu}"
NAS_DIR="${NAS_DIR:-After-sales-service}"
NAS_USER="${NAS_USER:-jhzhu}"
NAS_PASS="${NAS_PASS}"
NAS_RETAIN_DAYS="${NAS_RETAIN_DAYS:-14}"

TS() { date '+%Y-%m-%d %H:%M:%S'; }

echo "[$(TS)] ===== NAS sync started ====="
echo "[$(TS)] Source : ${BACKUP_DIR}/*.sql.gz"
echo "[$(TS)] Target : //${NAS_HOST}/${NAS_SHARE}/${NAS_DIR}"

# ─── 检查是否有备份文件 ────────────────────────────────────────────────────────
shopt -s nullglob
BACKUP_FILES=( "${BACKUP_DIR}"/*.sql.gz )
shopt -u nullglob

if [ ${#BACKUP_FILES[@]} -eq 0 ]; then
  echo "[$(TS)] No backup files found in ${BACKUP_DIR}. Skipping sync."
  exit 0
fi

# ─── 确保 NAS 目标目录存在 ────────────────────────────────────────────────────
smbclient "//${NAS_HOST}/${NAS_SHARE}" \
  -U "${NAS_USER}%${NAS_PASS}" \
  -c "mkdir \"${NAS_DIR}\"" 2>/dev/null || true

# ─── 上传所有备份文件 ─────────────────────────────────────────────────────────
UPLOADED=0
FAILED=0

for BACKUP_FILE in "${BACKUP_FILES[@]}"; do
  FILENAME=$(basename "${BACKUP_FILE}")
  echo "[$(TS)] Uploading: ${FILENAME} ..."

  if smbclient "//${NAS_HOST}/${NAS_SHARE}" \
    -U "${NAS_USER}%${NAS_PASS}" \
    -c "cd \"${NAS_DIR}\"; put \"${BACKUP_FILE}\" \"${FILENAME}\"" 2>/dev/null; then
    echo "[$(TS)]   ✓ OK: ${FILENAME}"
    UPLOADED=$((UPLOADED + 1))
  else
    echo "[$(TS)]   ✗ FAILED: ${FILENAME}"
    FAILED=$((FAILED + 1))
  fi
done

echo "[$(TS)] Upload: ${UPLOADED} succeeded, ${FAILED} failed."

# ─── 清理 NAS 上超过 NAS_RETAIN_DAYS 天的旧备份 ──────────────────────────────
echo "[$(TS)] Cleaning NAS backups older than ${NAS_RETAIN_DAYS} days..."

CUTOFF_EPOCH=$(date -d "-${NAS_RETAIN_DAYS} days" +%s)
DELETED=0

# 获取 NAS 上的文件列表（筛选 .sql.gz 文件行）
NAS_LIST=$(smbclient "//${NAS_HOST}/${NAS_SHARE}" \
  -U "${NAS_USER}%${NAS_PASS}" \
  -c "cd \"${NAS_DIR}\"; ls" 2>/dev/null | grep '\.sql\.gz' || true)

while IFS= read -r LINE; do
  [ -z "${LINE}" ] && continue

  # smbclient ls 输出示例:
  #   device_management_2026-03-01_0100.sql.gz   A   5632  Mon Mar  1 01:00:00 2026
  FNAME=$(echo "${LINE}" | awk '{print $1}')
  FDATE_STR=$(echo "${LINE}" | grep -oP '[A-Z][a-z]{2} [A-Z][a-z]{2} +\d+ \d{2}:\d{2}:\d{2} \d{4}' || true)

  [ -z "${FNAME}" ] || [ -z "${FDATE_STR}" ] && continue

  FILE_EPOCH=$(date -d "${FDATE_STR}" +%s 2>/dev/null || true)
  [ -z "${FILE_EPOCH}" ] && continue

  if [ "${FILE_EPOCH}" -lt "${CUTOFF_EPOCH}" ]; then
    echo "[$(TS)] Deleting expired NAS file: ${FNAME}"
    smbclient "//${NAS_HOST}/${NAS_SHARE}" \
      -U "${NAS_USER}%${NAS_PASS}" \
      -c "cd \"${NAS_DIR}\"; del \"${FNAME}\"" 2>/dev/null && DELETED=$((DELETED + 1)) || true
  fi
done <<< "${NAS_LIST}"

echo "[$(TS)] Deleted ${DELETED} expired file(s) from NAS."
echo "[$(TS)] ===== NAS sync finished ====="
