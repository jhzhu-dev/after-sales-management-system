#!/bin/bash
# =============================================================================
# remote-deploy-preview.sh — 在 192.168.0.181 上执行的预览版部署脚本
# 由 deploy-to-181-preview.ps1 上传到 /home/els/manger-preview 后调用
#
# 用法: bash remote-deploy-preview.sh <镜像包.tar> [refresh|seed]
#   refresh — 可选：重新从生产最新备份导入数据（覆盖预览库）
#   seed    — 可选：清空预览库数据卷，由应用自建空表后灌入全部虚构演示数据（不导入生产备份）
#
# 与生产 remote-deploy.sh 的本质区别：
#   - 只操作 manger-preview 项目，绝不触碰生产容器/数据卷/网络
#   - 首次部署自动从 /home/els/manger/backups 导入最新生产备份
#   - 导入后清空 feishu_config，阻断预览系统对真实飞书的通知
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/home/els/manger-preview"
PROD_BACKUP_DIR="/home/els/manger/backups"
IMG_NAME="device-manager-app"
TAR_FILE="$1"
REFRESH_DATA="${2:-}"
APP_PORT=5010

# 预览库凭据（与 docker-compose.preview.yml 保持一致）
DB_USER="preview_user"
DB_PASS="preview_pass_2026"
DB_ROOT_PASS="preview_root_2026"
DB_NAME="device_management"

echo "========================================"
echo " 预览展示版部署（不影响生产环境）"
echo "========================================"

cd "$DEPLOY_DIR"

# 镜像包为可选参数：传空则复用远端已有的 device-manager-app:preview（用于仅刷新数据/重启）
if [ -n "$TAR_FILE" ] && [ -f "$TAR_FILE" ]; then
    echo "[1/5] 加载镜像: $TAR_FILE"
    LOADED_TAG=$(docker load -i "$TAR_FILE" | grep -oP '(?<=Loaded image: ).*')
    docker tag "$LOADED_TAG" "$IMG_NAME:preview"
    echo "  已加载: $LOADED_TAG → $IMG_NAME:preview"
else
    echo "[1/5] 未提供镜像包，使用远端现有镜像 $IMG_NAME:preview"
fi

# 端口预检：5010 若被非预览容器占用则中止（预览自身占用属正常，compose down 会先释放）
if ss -ltn 2>/dev/null | grep -q ":${APP_PORT} " && ! docker ps --format '{{.Names}}' | grep -q '^device-manager-preview-app$'; then
    echo "[ERROR] 端口 $APP_PORT 已被其他进程占用，请更换端口后重试"
    exit 1
fi

# seed 模式：先销毁预览栈并删除预览专用数据卷（只影响 manger-preview 项目卷）
SEED_MODE=0
if [ "$REFRESH_DATA" = "seed" ]; then
    SEED_MODE=1
    echo "[seed] 清空预览库数据卷（docker compose down -v，仅 manger-preview）..."
    docker compose down -v
fi

echo "[2/5] 启动预览数据库（独立实例，不触碰生产）"
docker compose up -d mysql
WAITED=0
# 用 root SELECT 1 作为就绪判据：mysqladmin ping 在首次初始化完成前即返回存活，会导致导入竞态失败
until docker exec device-manager-preview-db mysql -uroot -p"$DB_ROOT_PASS" -e "SELECT 1;" > /dev/null 2>&1; do
    if [ "$WAITED" -ge 180 ]; then
        echo "[ERROR] 预览数据库 180s 内未就绪"
        exit 1
    fi
    sleep 5
    WAITED=$((WAITED + 5))
done
echo "  预览数据库已就绪"

echo "[3/5] 数据初始化"
TABLES=$(docker exec device-manager-preview-db mysql -N -u"$DB_USER" -p"$DB_PASS" \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null | tr -d '[:space:]' || true)
if [ -z "$TABLES" ]; then TABLES=0; fi
NEED_IMPORT=0
if [ "$SEED_MODE" -eq 1 ]; then
    echo "  seed 模式：跳过生产备份导入（空库由应用自动建表，稍后灌入虚构数据）"
elif [ "$TABLES" -eq 0 ]; then NEED_IMPORT=1; fi
if [ "$REFRESH_DATA" = "refresh" ]; then NEED_IMPORT=1; fi

if [ "$NEED_IMPORT" -eq 1 ]; then
    # 停掉应用，避免应用建表/迁移与导入并发冲突（首次部署时容器不存在，忽略报错）
    docker compose stop app > /dev/null 2>&1 || true
    LATEST_DUMP=$(ls -1t "$PROD_BACKUP_DIR"/device_management_*.sql.gz 2>/dev/null | head -1 || true)
    if [ -n "$LATEST_DUMP" ]; then
        echo "  导入生产最新备份: $LATEST_DUMP（仅写入预览库）"
        gunzip -c "$LATEST_DUMP" | docker exec -i device-manager-preview-db \
            mysql -u root -p"$DB_ROOT_PASS" --default-character-set=utf8mb4 || echo "  [WARN] 导入过程有告警，请核对日志"
        echo "  导入完成"
    else
        echo "  [WARN] 未找到生产备份（$PROD_BACKUP_DIR），预览库为空库（应用会自动建表）"
    fi
else
    echo "  预览库已有数据（$TABLES 张表），跳过导入。如需刷新数据请追加 refresh 参数"
fi

echo "[4/5] 启动预览应用（端口 $APP_PORT）"
docker compose up -d
sleep 5

echo "[5/5] 健康检查  http://localhost:${APP_PORT}/api/health"
HEALTHY=0
for i in $(seq 1 24); do
    if curl -sf "http://localhost:${APP_PORT}/api/health" > /dev/null 2>&1; then
        HEALTHY=1
        break
    fi
    sleep 5
    echo "  等待应用就绪... ($((i * 5))s)"
done
if [ "$HEALTHY" -ne 1 ]; then
    echo "[ERROR] 预览应用健康检查失败，最近日志："
    docker compose logs app --tail=30
    exit 1
fi
curl -s "http://localhost:${APP_PORT}/api/health"
echo ""

# 清空飞书配置，阻断预览系统向真实飞书用户/群发通知（应用级发送失败会被静默捕获）
docker exec device-manager-preview-db mysql -u root -p"$DB_ROOT_PASS" \
    -e "DELETE FROM ${DB_NAME}.feishu_config;" 2>/dev/null || true

# seed 模式：应用已在空库上自动建好全部表，容器内执行虚构数据生成脚本
if [ "$SEED_MODE" -eq 1 ]; then
    echo "[seed] 容器内执行 scripts/seed-preview-data.js 灌入虚构演示数据 ..."
    docker exec device-manager-preview-app node scripts/seed-preview-data.js
fi

docker compose ps

echo ""
if [ -n "$TAR_FILE" ]; then
    echo "清理镜像包..."
    rm -f "$DEPLOY_DIR/$TAR_FILE"
fi

echo "========================================"
echo " 预览版部署完成！访问: http://192.168.0.181:${APP_PORT}"
echo " 生产环境不受影响: http://192.168.0.181:5000"
echo "========================================"
