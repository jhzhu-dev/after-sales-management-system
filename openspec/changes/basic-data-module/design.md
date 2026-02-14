# Design: 基础数据模块 (Basic Data Module)

## 1. 数据库设计

### 核心表结构
- **product_lines**: 定义产品线（如：龙门检测、底盘检测）。
- **products**: 属于特定产品线的型号定义，包含 JSON 格式的规格参数。
- **customers**: 记录客户基础信息、区域及联系人，使用 `C-YYYYMMDD-XXX` 格式的唯一 ID。
- **product_documents**: 存储关联各产品的技术文件元数据（PDF/Doc 等）。

## 2. 后端架构
- **路由分离**: 每个模块拥有独立路由文件（`product-lines.js`, `products.js`, `customers.js`, `product-documents.js`）。
- **文件处理**: 使用 `multer` 处理资料上传，存储在按类别划分的本地目录中。
- **校验逻辑**: 对客户 ID 重复性进行逻辑校验，支持重试生成。

## 3. 初始化数据
提供 `seed-phase1.js` 脚本，通过数据库 API 批量注入预设的 5 条产品线和 12 个产品模型，确保系统开箱即用。
