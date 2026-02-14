# OSS 文件存储路径结构说明

## 概述
系统使用阿里云OSS存储文件，采用层级化的目录结构组织文件。

## 路径结构

### 基础路径
```
oss://els-pub-04/static/After-sales management system/
```

### 1. 产品文档 (Product Documents)

**路径格式：**
```
oss://els-pub-04/static/After-sales management system/{产品线名称}/{产品型号}/文件名
```

**示例：**
- 产品线：龙门
- 产品型号：ELS-DM-2024-V1
- 文件：用户手册.pdf

**完整路径：**
```
oss://els-pub-04/static/After-sales management system/龙门/ELS-DM-2024-V1/用户手册.pdf
```

**说明：**
- 产品文档按 **产品线 → 产品型号** 两级目录组织
- 产品型号为空时，文件直接存储在产品线目录下
- 特殊字符会被自动转换为安全字符（空格→下划线）

### 2. 生产留底资料 (Production Materials)

**路径格式：**
```
oss://els-pub-04/static/After-sales management system/productions/文件名
```

**示例：**
```
oss://els-pub-04/static/After-sales management system/productions/prod-1707896543210-123456789.pdf
```

**说明：**
- 生产留底资料统一存储在 `productions` 目录下
- 不按产品线分类，便于批量管理

## 路径规范化规则

### 产品线名称规范化
```javascript
// 原始名称: "龙门 系统"
// 规范化后: "龙门_系统"

// 规则:
// 1. 移除文件系统不允许的字符: < > : " / \ | ? *
// 2. 空格替换为下划线: ' ' → '_'
// 3. 去除首尾空白
```

### 产品型号规范化
```javascript
// 原始型号: "ELS-DM 2024-V1"
// 规范化后: "ELS-DM_2024-V1"

// 规则同产品线名称规范化
```

## 代码实现

### OSS 服务方法

#### uploadFile()
```javascript
/**
 * 上传文件到OSS
 * @param {Object} file - Multer上传的文件对象
 * @param {string} productLineName - 产品线名称
 * @param {string} productModel - 产品型号（可选）
 * @param {string} category - 文件类别 ('product-documents' | 'productions')
 * @returns {Promise<Object>} { ossPath, url, name }
 */
await ossService.uploadFile(file, '龙门', 'ELS-DM-2024-V1', 'product-documents');
```

#### buildOSSPath()
```javascript
/**
 * 构建OSS完整路径
 * @param {string} productLineName - 产品线名称
 * @param {string} productModel - 产品型号（可选）
 * @param {string} fileName - 文件名
 * @param {string} category - 文件类别
 * @returns {string} OSS路径
 */
const path = ossService.buildOSSPath('龙门', 'ELS-DM-2024-V1', 'manual.pdf', 'product-documents');
// 返回: "static/After-sales management system/龙门/ELS-DM-2024-V1/manual.pdf"
```

## 使用场景

### 1. 产品资料上传
当用户上传产品文档时：
1. 系统查询产品信息（包括产品线名称和产品型号）
2. 调用 `ossService.uploadFile(file, productLineName, productModel, 'product-documents')`
3. 文件自动上传到对应的产品线/产品型号目录
4. 返回OSS路径保存到数据库

### 2. 生产资料上传
当上传生产留底材料时：
1. 直接调用 `ossService.uploadFile(file, 'productions', null, 'productions')`
2. 文件统一存储在 productions 目录
3. 返回OSS路径保存到数据库

### 3. 文件下载
当用户下载文件时：
1. 从数据库读取OSS路径
2. 调用 `ossService.getSignedUrl(ossPath, expiresInSeconds)`
3. 生成带签名的临时下载链接（有效期1小时）
4. 重定向到签名URL或返回给前端

## 优势

### 1. 清晰的层级结构
- 产品线 → 产品型号 → 文件
- 便于管理和查找
- 符合业务逻辑

### 2. 灵活的存储策略
- 产品文档按产品分类存储
- 生产资料统一集中管理
- 可根据需求扩展目录结构

### 3. 自动路径规范化
- 自动处理特殊字符
- 保证路径合法性
- 避免存储冲突

### 4. 兼容本地存储
- OSS未启用时自动降级到本地存储
- 接口保持一致
- 平滑迁移

## 配置

### 环境变量 (.env)
```env
# 启用OSS存储
USE_OSS_STORAGE=true

# OSS配置
OSS_REGION=oss-cn-shanghai
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=els-pub-04
OSS_BASE_PATH=static/After-sales management system
```

### 禁用OSS（使用本地存储）
```env
USE_OSS_STORAGE=false
```

## 测试示例

### 测试上传产品文档
```bash
curl -X POST http://localhost:5000/api/product-documents/upload \
  -F "file=@/path/to/manual.pdf" \
  -F "product_id=1" \
  -F "doc_type=manual" \
  -F "title=产品使用手册"
```

### 测试上传生产资料
```bash
curl -X POST http://localhost:5000/api/uploads/productions \
  -F "file=@/path/to/production-record.pdf"
```

### 测试下载文件
```bash
curl http://localhost:5000/api/product-documents/1/download
# 自动重定向到OSS签名URL
```

## 注意事项

1. **产品型号的重要性**
   - 建议为每个产品设置清晰的型号
   - 型号将作为OSS路径的一部分
   - 修改型号不会自动迁移OSS文件

2. **文件名冲突**
   - 同名文件会被覆盖
   - 建议使用时间戳生成唯一文件名
   - 系统已自动处理文件名唯一性

3. **权限控制**
   - OSS Bucket 建议配置为私有
   - 使用签名URL控制访问权限
   - 签名URL默认有效期1小时

4. **迁移策略**
   - 旧文件路径格式: `产品线/文件名`
   - 新文件路径格式: `产品线/产品型号/文件名`
   - 系统向后兼容，支持两种路径格式
