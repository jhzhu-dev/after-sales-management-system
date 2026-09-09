#!/bin/bash
# 预览版验证：登录并逐页检查数据量 + 生产健康检查（不依赖 node/python）
BASE="http://localhost:5010"
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"elsvision","password":"elsvisiongo666"}')
TOKEN=$(echo "$LOGIN" | grep -oP '"token"\s*:\s*"\K[^"]+' | head -1)
if [ -z "$TOKEN" ]; then echo "LOGIN_FAIL: $LOGIN"; exit 1; fi
echo "LOGIN_OK"
check() {
  local name="$1" path="$2"
  local body=$(curl -s "$BASE$path" -H "Authorization: Bearer $TOKEN")
  local total=$(echo "$body" | grep -oP '"total"\s*:\s*\K[0-9]+' | head -1)
  if [ -z "$total" ]; then
    local len=$(echo "$body" | grep -oP '"id"\s*:' | wc -l)
    total="array~$len"
  fi
  printf "%-16s %s\n" "$name" "$total"
}
check 设备 /api/devices?limit=1
check 问题 /api/issues?limit=1
check 客户需求 /api/customer-requirements?limit=1
check 测试任务 /api/test-tasks?limit=1
check 产品 /api/products?limit=1
check 产品线 /api/product-lines?limit=1
check 客户 /api/customers?limit=1
check 知识库 /api/kb-articles?limit=1
check 设备升级 /api/device-upgrades?limit=1
check 版本发布 /api/version-releases?limit=100
check 多合一组合 /api/device-bundles
check 模块类型 /api/module-types
echo "--- 生产环境健康 (5000) ---"
curl -s http://localhost:5000/api/health | head -c 200; echo
echo "--- 相关容器状态 ---"
docker ps --format '{{.Names}}|{{.Status}}' | grep -E 'device-manager|els-production' | sort
echo "--- 预览库 feishu_config 行数（应为0）---"
docker exec device-manager-preview-db mysql -N -uroot -ppreview_root_2026 -e "SELECT COUNT(*) FROM device_management.feishu_config;" 2>/dev/null
