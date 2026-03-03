#!/bin/bash
# remote-deploy.sh — 在 192.168.0.181 上执行的部署脚本（由 deploy-to-181.ps1 上传后调用）
set -e

DEPLOY_DIR="/home/els/manger"
TAR_FILE="$1"           # 第一个参数：镜像包文件名
IMG_NAME="device-manager-app"

echo "========================================"
echo " 售后登记系统 - 远程部署"
echo "========================================"

cd $DEPLOY_DIR

echo "[1/4] 加载镜像: $TAR_FILE"
LOADED_TAG=$(docker load -i "$TAR_FILE" | grep -oP '(?<=Loaded image: ).*')
echo "  已加载: $LOADED_TAG"

# 将加载进来的版本镜像重新打上 :latest 标签（确保 compose 引用正确）
docker tag "$LOADED_TAG" "$IMG_NAME:latest"
echo "  重打标签: $LOADED_TAG → $IMG_NAME:latest"

echo "[2/4] 停止并清除旧容器"
# 先尝试 compose down（处理同项目名的情况）
docker compose down --remove-orphans 2>/dev/null || true
# 再按容器名强制删除（处理项目名不一致的残留容器）
for name in device-manager-app device-manager-db device-manager-db-backup; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
        echo "  强制删除容器: $name"
        docker rm -f "$name" 2>/dev/null || true
    fi
done

echo "[3/4] 启动新容器（不重新 build）"
docker compose up -d --no-build

echo "[4/4] 等待健康检查..."
sleep 15
docker compose ps

# 健康检查
if curl -sf http://localhost:5000/api/health > /dev/null; then
    echo ""
    echo "✓ API 响应正常"
    curl -s http://localhost:5000/api/health
    echo ""
else
    echo "[WARN] API 尚未响应，查看日志："
    docker compose logs app --tail=20
fi

echo ""
echo "清理镜像包..."
rm -f "$DEPLOY_DIR/$TAR_FILE"

echo "========================================"
echo " 部署完成！访问: http://192.168.0.181:5000"
echo "========================================"
