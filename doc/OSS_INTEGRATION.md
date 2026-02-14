# 阿里云OSS集成说明文档

## 概述

系统已集成阿里云OSS（对象存储服务）功能，所有上传的文件将存储在阿里云OSS华东2（上海）区域，按产品线分类管理。

## 配置信息

### OSS基本信息
- **区域**: 华东2（上海）/ oss-cn-shanghai
- **Bucket**: els-pub-04
- **基础路径**: `oss://els-pub-04/static/After-sales management system/`

### 文件存储结构
```
oss://els-pub-04/
└── static/
    └── After-sales management system/
        ├── {产品线名称}/          # 产品文档按产品线存储
        │   ├── file1.pdf
        │   ├── file2.docx
        │   └── ...
        └── productions/            # 生产资料统一存储
            ├── prod-xxx.pdf
            └── ...
```

## 环境配置

### 1. 创建 .env 文件

在项目根目录创建 `.env` 文件（如果不存在），添加以下配置：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=els
DB_PASSWORD=111111
DB_NAME=device_management

# JWT配置
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# 服务器配置
PORT=5000
NODE_ENV=development

# 前端配置
REACT_APP_API_URL=http://localhost:5000/api

# 阿里云OSS配置
USE_OSS_STORAGE=true
OSS_ACCESS_KEY_ID=LTAI5tBExxxxxxxsYHmGJY1w
OSS_ACCESS_KEY_SECRET=UC3xINxxxxxxxjOLRWpFljWlKiog
OSS_BUCKET=els-pub-04
OSS_REGION=oss-cn-shanghai
OSS_BASE_PATH=static/After-sales management system
```

**重要提示**: 
- `.env` 文件包含敏感信息，已在 `.gitignore` 中忽略，不应提交到版本控制
- 请妥善保管 AccessKey 信息
- 生产环境建议使用更安全的密钥管理方案（如阿里云RAM角色）

### 2. 安装依赖

如果是首次配置，需要安装 ali-oss 包：

```bash
npm install
```

### 3. 启动服务

```bash
npm run dev
```

服务启动后会显示OSS服务状态：
- ✅ 阿里云OSS服务已启用
- 📦 Bucket: els-pub-04
- 📂 基础路径: static/After-sales management system

## 功能说明

### 1. 自动上传到OSS

**产品文档上传**:
- 上传时自动获取产品所属的产品线
- 文件存储在 `{产品线名称}/` 目录下
- 产品线名称会自动标准化（移除特殊字符、空格转下划线）

**生产资料上传**:
- 所有生产资料统一存储在 `productions/` 目录下

### 2. 下载功能

- OSS文件：生成1小时有效期的签名URL，用户通过重定向下载
- 本地文件：保持原有下载方式（向后兼容）

### 3. 删除功能

- OSS文件：同时删除数据库记录和OSS中的文件
- 本地文件：保持原有删除方式（向后兼容）

### 4. 向后兼容

系统完全向后兼容：
- 现有本地文件可以继续访问和下载
- 通过路径前缀 `oss://` 自动识别文件存储位置
- OSS上传失败时自动降级到本地存储

## 文件迁移

### 将现有文件迁移到OSS

如果需要将已有的本地文件迁移到OSS，运行迁移脚本：

```bash
node server/migrate-files-to-oss.js
```

迁移脚本功能：
1. 扫描数据库中所有本地路径的文件
2. 查询文件所属的产品线信息
3. 按产品线上传到OSS
4. 更新数据库中的文件路径
5. 保留本地文件作为备份（不会自动删除）

**注意**：
- 迁移前请确保 `.env` 配置正确
- 迁移过程会保留本地文件，可手动删除
- 建议先备份数据库

## 开启/关闭OSS功能

### 启用OSS存储
```env
USE_OSS_STORAGE=true
```

### 禁用OSS存储（使用本地存储）
```env
USE_OSS_STORAGE=false
```

禁用后：
- 文件将保存到本地 `uploads/` 目录
- 已存储在OSS的文件仍可正常访问

## API变化

上传接口保持不变，响应中的 `file_path` 字段格式可能为：

**OSS路径**:
```json
{
  "file_path": "oss://els-pub-04/static/After-sales management system/ELS12000/1234567890-123456789.pdf"
}
```

**本地路径**:
```json
{
  "file_path": "d:\\py_project\\manger\\uploads\\product-documents\\1234567890-123456789.pdf"
}
```

前端无需修改，系统会自动处理不同类型的路径。

## 安全建议

1. **AccessKey 安全**
   - 不要将 AccessKey 硬编码在代码中
   - 不要提交 `.env` 文件到版本控制
   - 定期轮换 AccessKey
   - 考虑使用 RAM 角色授权

2. **Bucket 权限**
   - 确保 Bucket 为私有访问
   - 通过签名URL控制文件访问
   - 定期审查 Bucket 权限配置

3. **文件安全**
   - 上传前进行文件类型验证
   - 考虑添加病毒扫描
   - 限制文件大小（当前：产品文档50MB，生产资料10MB）

## 故障排查

### OSS上传失败

1. 检查网络连接
2. 验证 AccessKey 和 Secret 是否正确
3. 确认 Bucket 名称和区域配置
4. 检查 RAM 权限是否足够（需要 PutObject 权限）

### 签名URL无法访问

1. 检查文件是否真实存在于OSS
2. 确认URL未过期（默认1小时）
3. 验证 Bucket 的跨域配置

### 迁移脚本错误

1. 确保数据库连接正常
2. 检查本地文件是否存在
3. 验证产品线信息完整性

## 技术细节

### 涉及的文件

1. **环境配置**: 
   - `env.example` - 环境变量模板
   - `.env` - 实际配置（需创建）

2. **核心服务**:
   - `server/services/oss-service.js` - OSS服务封装

3. **路由修改**:
   - `server/routes/product-documents.js` - 产品文档路由
   - `server/routes/uploads.js` - 生产资料路由

4. **迁移工具**:
   - `server/migrate-files-to-oss.js` - 文件迁移脚本

5. **依赖包**:
   - `ali-oss` ^6.18.0 - 阿里云OSS SDK

### OSS Service API

```javascript
const ossService = require('./services/oss-service');

// 上传文件
const result = await ossService.uploadFile(file, productLineName, 'product-documents');
// 返回: { ossPath, url, name }

// 生成下载URL
const url = await ossService.getSignedUrl(ossPath, 3600);

// 删除文件
await ossService.deleteFile(ossPath);

// 检查是否为OSS路径
const isOSS = ossService.isOSSPath(filePath);

// 列出文件
const files = await ossService.listFiles(productLineName, 'product-documents');
```

## 监控与维护

建议定期检查：
1. OSS存储用量和费用
2. 文件访问日志
3. 签名URL的有效期设置
4. 定期清理无用文件

## 联系支持

如遇到技术问题，请查看：
- 阿里云OSS官方文档: https://help.aliyun.com/product/31815.html
- ali-oss SDK文档: https://github.com/ali-sdk/ali-oss

---

**最后更新**: 2026年2月11日
