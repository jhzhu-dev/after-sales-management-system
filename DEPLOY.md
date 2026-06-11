# 生产环境部署与测试指南

## 本次修复内容

| 文件 | 变更说明 |
|------|---------|
| `server/database.js` | 新增迁移：自动为 `product_documents` 表补充 `original_name` 字段 |
| `server/routes/product-documents.js` | 修复：OSS 上传成功后若 DB 写入失败，catch 块不再重复删除已清理的临时文件（防止进程崩溃） |
| `client/src/pages/ProductDetail.tsx` | 上传请求超时从 10s 延长至 120s，避免大文件超时失败 |

---

## 生产部署步骤

> 在生产服务器上执行以下命令（需有 Docker 和 docker-compose）

### 1. 拉取最新代码

```bash
cd /path/to/manger     # 替换为实际项目目录
git pull
```

### 2. 重新构建镜像并重启

```bash
# 构建新镜像（包含前端重新编译）
docker-compose build --no-cache app

# 滚动重启（旧容器先停止，新容器启动，数据库不受影响）
docker-compose up -d --no-deps app
```

> **说明**：`--no-deps` 只重启 app 容器，不影响 mysql 和 db-backup 容器，不中断数据库。

### 3. 确认服务启动成功

```bash
# 查看容器状态
docker-compose ps

# 查看启动日志（关注关键行）
docker-compose logs --tail=30 app
```

启动日志中应出现以下两行，确认迁移成功：
```
✅ product_documents.original_name 字段添加成功
🎉 数据库初始化完成!
```

---

## 生产测试（不修改生产数据）

部署完成后，在**本机**或**生产服务器**上运行冒烟测试脚本：

```bash
# 替换 IP 为实际生产地址
node scripts/smoke-test-upload.js http://192.168.0.181:5000
```

### 测试通过预期输出

```
[1] 登录验证
  ✅ 登录成功，用户: elsvision

[2] 获取产品列表（只读）
  ✅ 找到 N 个产品 ...

[3] 上传测试文档（将在步骤6立即删除）
  ✅ 上传成功，文档 ID=...

[4] 验证文件名一致性
  ✅ original_name = "smoke-test-xxx.txt" ✓（与上传文件名一致）
  ✅ OSS 路径文件名 = "smoke-test-xxx.txt" ✓

[5] 验证文档出现在列表中（只读）
  ✅ 文档 ID=... 已出现在文档列表

[6] 清理：删除测试文档
  ✅ 测试文档 ID=... 已删除

[7] 确认测试数据已完全清理（只读）
  ✅ 已确认文档列表中无测试残留

🎉 全部 7 步测试通过！
✅ 生产数据零残留（自清理完成）
```

### 自定义账号（如生产密码不同）

```bash
TEST_USERNAME=youruser TEST_PASSWORD=yourpass \
  node scripts/smoke-test-upload.js http://192.168.0.181:5000
```

---

## 回滚方案

若部署后出现问题，快速回滚：

```bash
# 查看历史镜像
docker images | grep device-manager

# 回滚到上一个镜像（替换 IMAGE_ID）
docker-compose stop app
docker tag <OLD_IMAGE_ID> manger_app:latest
docker-compose up -d --no-deps app
```
