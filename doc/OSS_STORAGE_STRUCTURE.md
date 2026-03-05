# OSS 文件存储路径结构说明

## 概述

系统使用阿里云 OSS 存储文件，以**设备为核心**组织目录层级，所有与设备相关的文件都归入统一的设备文件夹，便于按设备维度查找和归档。

路径构建统一通过 `ossService.buildPathByType(type, params)` 方法完成，不允许在各路由中内联拼接路径字符串。

## 基础路径

```
oss://els-pub-04/static/After-sales management system/
```

以下路径描述中均省略此前缀，用 `{base}` 表示。

---

## 路径规则

### 1. 产品文档 (product_documents)

产品型号维度的通用技术文档，所有同型号设备共用。

```
{base}/product-docs/{产品线}/{产品型号}/{文件名}
```

示例：
```
product-docs/龙门/ELS-DM-2024-V1/用户手册.pdf
```

代码调用：
```javascript
const ossKey = ossService.buildPathByType('product-docs', {
    productLine : product.product_line_name,
    productModel: product.model,
    fileName    : '用户手册.pdf'
});
```

---

### 2. 版本附件 (version_releases)

版本发布包、固件等，按模块类型和版本号组织。

```
{base}/version-releases/{模块类型}/{分类}/{版本号}/{文件名}
```

示例：
```
version-releases/主控板/firmware/v2.1.0/升级包_v2.1.0.bin
```

---

### 3. 设备出厂资料 (device_documents)

某台具体设备的出厂/维保随机资料（出厂检测报告、接线图、安装说明、生产留底等）。

```
{base}/devices/{设备标识}/device-docs/{分类}/{文件名}
```

代码调用：
```javascript
const ossKey = ossService.buildPathByType('device-docs', {
    device  : deviceInfo,  // 含 customer_short_name, id, name, product_name
    category: '出厂检测报告',
    fileName : '检测报告.pdf'
});
```

---

### 4. 问题附件 (issues.attachments)

客户报障时上传的故障照片/日志，采用**两阶段上传**：

上传阶段（issue 尚未创建，无 issue_id）：
```
{base}/devices/{设备标识}/issues/pending/{timestamp}_{文件名}
```

提交阶段（issue 创建成功后，服务端自动移动）：
```
{base}/devices/{设备标识}/issues/{issue_id}/{timestamp}_{文件名}
```

---

### 5. 问题日志附件 (issue_logs.attachments)

技术员处理问题后上传的维修照片/报告，有明确的 `issue_id`。

```
{base}/devices/{设备标识}/issues/{issue_id}/logs/{timestamp}_{文件名}
```

代码调用：
```javascript
const ossKey = ossService.buildPathByType('issue-log-attachments', {
    device  : deviceInfo,
    issueId : 'ISS1709000000000',
    fileName: `${Date.now()}_维修报告.pdf`
});
```

---

## 设备标识格式

所有设备相关目录使用统一的设备标识作为文件夹名：

```
{客户简称}-{生产序列号}-{订单号}-{产品名}
```

字段来源：
- 客户简称：customers.short_name（无则用 customers.name）
- 生产序列号：devices.id（VARCHAR 主键）
- 订单号：devices.name
- 产品名：products.name

特殊字符会被移除，空格替换为下划线。

---

## 目录树示例

```
oss://els-pub-04/static/After-sales management system/

 product-docs/                          # 产品文档
    龙门/
        ELS-DM-2024-V1/
            用户手册.pdf

 version-releases/                      # 版本附件（路径不变）
    主控板/
        firmware/
            v2.1.0/
                升级包_v2.1.0.bin

 devices/                               # 所有设备相关文件
     某客户-SN001-ORD123-龙门机/
         device-docs/                   # 出厂资料（含生产留底分类）
            出厂检测报告/
               检测报告.pdf
            生产留底/
                生产记录.pdf
         issues/
             pending/                   # 问题附件临时暂存
                1709000000000_故障截图.jpg
             ISS1709000000001/          # 具体问题的附件
                 1709000000001_故障截图.jpg
                 logs/                  # 处理记录附件
                     1709000000002_维修报告.pdf
```

---

## 历史文件迁移

已有旧路径文件可使用 `scripts/oss-migrate.js` 迁移到新路径：

```bash
# 预览（不实际操作，推荐先执行）
node scripts/oss-migrate.js --dry-run

# 仅迁移某一类
node scripts/oss-migrate.js --table=device-docs --dry-run

# 正式迁移
node scripts/oss-migrate.js
```

支持 --table 参数：product-docs | device-docs | issues | issue-logs

---

## 配置

```env
USE_OSS_STORAGE=true
OSS_REGION=oss-cn-shanghai
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=els-pub-04
OSS_BASE_PATH=static/After-sales management system
```

## 注意事项

1. **生产留底资料已归并**：/api/uploads/productions 接口已废弃（返回 410），生产留底资料改通过 /api/device-documents/upload 上传，分类名填「生产留底」。
2. **问题附件两阶段**：前端在 pending/ 中获取的 URL 是临时路径，issue 创建成功后服务端自动移动，前端无需额外处理。
3. **设备标识需要 JOIN**：getDeviceInfo 查询必须 JOIN customers 和 products 表才能获取完整字段，各路由已更新。
