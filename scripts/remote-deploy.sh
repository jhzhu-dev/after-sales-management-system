#!/bin/bash
# remote-deploy.sh — 在 192.168.0.181 上执行的部署脚本（由 deploy-to-181.ps1 上传后调用）
#
# 用法: bash remote-deploy.sh <镜像包.tar> [app|full]
#   app  （默认，推荐）：只重建 app 容器，MySQL/备份容器保持运行 —— 停机窗口最小，
#         数据库连接不中断；数据库迁移由应用启动时的幂等初始化完成
#   full：全量 down + up（仅当 docker-compose 配置本身变更时使用，如新增服务/卷/端口）
#
# 安全措施：部署前自动记录当前运行镜像 ID 到 .rollback_image_id，
# 健康检查失败时可按输出中的一键回滚命令恢复。
set -e

DEPLOY_DIR="/home/els/manger"
TAR_FILE="$1"           # 第一个参数：镜像包文件名
MODE="${2:-app}"        # 第二个参数：部署模式（app | full）
IMG_NAME="device-manager-app"

echo "========================================"
echo " 售后登记系统 - 远程部署 (模式: $MODE)"
echo "========================================"

cd $DEPLOY_DIR

# [0/5] 记录回滚锚点：当前正在运行的镜像 ID
OLD_IMAGE=$(docker inspect "$IMG_NAME" --format '{{.Image}}' 2>/dev/null || true)
if [ -n "$OLD_IMAGE" ]; then
    echo "$OLD_IMAGE" > "$DEPLOY_DIR/.rollback_image_id"
    echo "[0/5] 回滚锚点已记录: ${OLD_IMAGE:0:19} → .rollback_image_id"
fi

echo "[1/5] 加载镜像: $TAR_FILE"
LOADED_TAG=$(docker load -i "$TAR_FILE" | grep -oP '(?<=Loaded image: ).*')
echo "  已加载: $LOADED_TAG"

# 将加载进来的版本镜像重新打上 :latest 标签（确保 compose 引用正确）
docker tag "$LOADED_TAG" "$IMG_NAME:latest"
echo "  重打标签: $LOADED_TAG → $IMG_NAME:latest"

if [ "$MODE" = "full" ]; then
    echo "[2/5] 全量重启：停止并清除旧容器"
    # 先尝试 compose down（处理同项目名的情况）
    docker compose down --remove-orphans 2>/dev/null || true
    # 再按容器名强制删除（处理项目名不一致的残留容器）
    for name in device-manager-app device-manager-db device-manager-db-backup; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
            echo "  强制删除容器: $name"
            docker rm -f "$name" 2>/dev/null || true
        fi
    done
    echo "[3/5] 启动全部服务（不重新 build）"
    docker compose up -d --no-build
else
    echo "[2/5] 仅重建 app 容器（MySQL / 备份容器保持运行）"
    # 镜像 :latest 已指向新版本，compose 检测到镜像变化会自动重建 app 容器
    docker compose up -d --no-deps --no-build app
fi

echo "[4/5] 等待健康检查..."
sleep 10
docker compose ps app

HEALTH_OK=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if curl -sf http://localhost:5000/api/health > /dev/null; then HEALTH_OK=1; break; fi
    sleep 5
done

if [ "$HEALTH_OK" = "1" ]; then
    echo ""
    echo "✓ API 响应正常"
    curl -s http://localhost:5000/api/health
    echo ""
else
    echo "[ERROR] 健康检查未通过（60s），最近日志："
    docker compose logs app --tail=30
    echo ""
    echo "一键回滚："
    echo "  docker tag \$(cat $DEPLOY_DIR/.rollback_image_id) $IMG_NAME:latest"
    echo "  cd $DEPLOY_DIR && docker compose up -d --no-deps --no-build app"
    exit 1
fi

echo ""
echo "清理镜像包..."
rm -f "$DEPLOY_DIR/$TAR_FILE"

echo "========================================"
echo " 部署完成！访问: http://192.168.0.181:5000"
echo "========================================"
