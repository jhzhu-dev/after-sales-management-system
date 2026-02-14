# 阿里云OSS集成 - 快速开始

## 🚀 快速配置步骤

### 1. 配置环境变量

在项目根目录的 `.env` 文件中添加OSS配置：

```env
# 阿里云OSS配置
USE_OSS_STORAGE=true
OSS_ACCESS_KEY_ID=LTAI5tBExxxxxxxsYHmGJY1w
OSS_ACCESS_KEY_SECRET=UC3xINxxxxxxxjOLRWpFljWlKiog
OSS_BUCKET=els-pub-04
OSS_REGION=oss-cn-shanghai
OSS_BASE_PATH=static/After-sales management system
```

### 2. 测试OSS连接

```bash
npm run test-oss
```

成功输出示例：
```
✅ OSS配置测试通过！
🎉 系统可以正常使用阿里云OSS存储功能
```

### 3. 启动系统

```bash
npm run dev
```

系统启动后会显示：
```
✅ 阿里云OSS服务已启用
📦 Bucket: els-pub-04
📂 基础路径: static/After-sales management system
```

### 4. (可选) 迁移现有文件

如果需要将本地文件迁移到OSS：

```bash
npm run migrate-to-oss
```

## 📁 文件存储结构

```
oss://els-pub-04/static/After-sales management system/
├── ELS12000/               # 按产品线存储
│   ├── 文档1.pdf
│   └── 文档2.docx
├── ELS24000/
│   └── 规格书.pdf
└── productions/            # 生产资料
    └── prod-xxx.pdf
```

## ✅ 功能验证

1. **上传测试**
   - 打开产品详情页
   - 上传一个文档
   - 检查上传成功提示

2. **下载测试**
   - 点击文档下载按钮
   - 验证文件正常下载

3. **删除测试**
   - 删除刚上传的文档
   - 验证删除成功

## 🔧 故障排查

### OSS连接失败

```bash
# 测试OSS配置
npm run test-oss
```

常见问题：
- AccessKey 错误 → 检查 `.env` 中的配置
- 网络问题 → 检查网络连接
- 权限不足 → 确认RAM权限

### 切换回本地存储

如果需要临时禁用OSS：

```env
USE_OSS_STORAGE=false
```

重启服务即可切换到本地存储模式。

## 📚 更多文档

详细文档请查看：[OSS_INTEGRATION.md](./OSS_INTEGRATION.md)

## 🆘 常用命令

```bash
# 测试OSS连接
npm run test-oss

# 迁移本地文件到OSS
npm run migrate-to-oss

# 启动开发服务器
npm run dev

# 仅启动后端服务器
npm run server
```

---

**提示**: 请妥善保管 AccessKey，不要提交到版本控制系统！
