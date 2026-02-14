# 相位 3 设计文档：设备与客户关联 (Phase 3: Device-Customer Association)

## 1. 概述
在相位 3 中，我们通过在 `devices` 表中引入 `customer_id` 和 `order_id` 字段，实现了设备、客户与订单之间的三方关联。这使得系统能够跟踪每台物理设备的归属详情。

## 2. 数据库变更
### `devices` 表更新
- **新增字段**:
  - `customer_id` (VARCHAR(50)): 关联 `customers.id`，外键约束 `ON DELETE SET NULL`。
  - `order_id` (VARCHAR(50)): 关联 `orders.id`，外键约束 `ON DELETE SET NULL`。

## 3. 后端 API 增强
### `devices` 模块
- `GET /api/devices`: 
  - 支持 `customer_id` 和 `order_id` 过滤。
  - 返回结果包含 `customer_name` 和 `order_name`。
- `GET /api/devices/:id`: 返回结果包含关联客户的详细信息（名称、区域）和关联订单。
- `POST /api/devices` & `PUT /api/devices/:id`: 支持设置和更新 `customer_id` 与 `order_id`。

## 4. 前端功能实现
### 客户管理增强
- **客户详情页 (NEW)**: `/customers/:id` 显示客户基本信息及该客户名下所有关联设备的列表。
- **客户列表关联**: 客户卡片增加跳转至详情页的链接。

### 设备管理增强
- **列表过滤**: 设备列表增加 "所属客户" 过滤项。
- **列表显示**: 设备列表增加 "所属客户" 列。
- **设备表单**: 增加 "所属客户" 和 "关联订单" 的下拉选择框。
- **详情展示**: 设备基本信息展示关联客户和关联订单链接。

### 订单管理增强
- **设备绑定 (NEW)**: 订单详情页 "合同设备" 标签页下，支持通过序列号手动绑定物理设备。
- **物理设备清单**: 展示该订单已绑定的物理设备实时列表。

## 5. 验证结果
- 数据库脚本已更新并包含迁移逻辑。
- 所有 API 端点经过验证，支持新增字段的读写。
- 前端各页面交互流畅，关联跳转逻辑正确。
- 解决了一系列类型定义与组件嵌套的 Lint 问题。
