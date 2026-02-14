# Design: 设备-客户-订单三方关联 (Device-Customer-Order Association)

## 1. 数据库概要设计

### `devices` 表更新
| 字段名 | 类型 | 描述 | 备注 |
| :--- | :--- | :--- | :--- |
| `customer_id` | VARCHAR(50) | 关联客户ID | 外键指向 `customers.id`, SET NULL |
| `order_id` | VARCHAR(50) | 关联订单ID | 外键指向 `orders.id`, SET NULL |

**迁移逻辑**:
1. 检查 `devices` 表是否存在 `customer_id`。若否，则添加该列及外键。
2. 检查 `devices` 表是否存在 `order_id`。若否，则添加该列及外键。

## 2. 后端 API 设计

### `deviceApi` 增强
- **GET /api/devices**:
  - `LEFT JOIN customers c ON d.customer_id = c.id`
  - `LEFT JOIN orders o ON d.order_id = o.id`
  - 响应包含: `customer_name`, `order_name`。
  - 过滤项添加: `customer_id`, `order_id`。
- **POST /api/devices**: 接收 `customer_id`, `order_id`。
- **PUT /api/devices/:id**: 接收 `customer_id`, `order_id`。

## 3. 前端 UI 设计

### 3.1 客户维度 (Customer Detail)
- **路径**: `/customers/:id`
- **组件**: `CustomerDetail.tsx`
- **逻辑**: 获取客户详情 + 获取该客户名下所有设备 (`GET /api/devices?customer_id=...`)。

### 3.2 订单维度 (Order Detail - Device Tab)
- **逻辑**: 展示两个清单。
  1. **合同清单**: 订单内规定的产品及数量（来源于 `order_devices`）。
  2. **物理清单**: 实际已生产并绑定的物理设备（来源于 `devices`）。
- **绑定功能**: 通过输入序列号，执行 `PUT /api/devices/:sn` 将其 `order_id` 和 `customer_id` (从当前订单获取) 更新。

### 3.3 设备列表与详情
- **设备列表**: 增加搜索条件 "所属客户"。
- **设备详情**: 增加基本信息展示，通过 `Link` 跳转至关联的客户或订单页。

## 4. 类型定义 (TypeScript)
更新 `Device`, `DeviceFormData`, `FilterOptions` 接口，包含可选的关联 ID 和显示名称。
