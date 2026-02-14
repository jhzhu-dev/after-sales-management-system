# Tasks: 设备-客户-订单三方关联 (Device-Customer-Order Association)

## Phase 3.1: 数据库与实体层
- [x] 扩展 `devices` 表，增加 `customer_id` 及其外键约束
- [x] 扩展 `devices` 表，增加 `order_id` 及其外键约束
- [x] 更新 `database.js` 自动迁移逻辑
- [x] 更新前端 `types/index.ts` 中的 `Device` 相关接口

## Phase 3.2: 后端 API 实现
- [x] 修改 `GET /api/devices` 支持客户名称与订单名称 Join 查询
- [x] 修改 `GET /api/devices` 支持 `customer_id` 过滤项
- [x] 修改 `GET /api/devices` 支持 `order_id` 过滤项
- [x] 修改 `POST / PUT` 接口支持关联 ID 的存取与校验

## Phase 3.3: 客户管理页面
- [x] 创建 `CustomerDetail.tsx` 页面
- [x] 在 App.tsx 中配置 `/customers/:id` 路由
- [x] 实现客户详情页中的设备列表展示
- [x] 在 `Customers.tsx` 列表页增加跳转详情的链接图标

## Phase 3.4: 设备管理页面
- [x] 在设备列表增加 "所属客户" 列
- [x] 在设备过滤区增加 "所属客户" 下拉菜单
- [x] 在 `DeviceDetail.tsx` 增加关联客户与订单的显示与链接
- [x] 更新 `DeviceForm.tsx` 支持在创建/编辑时选择所属客户和关联订单

## Phase 3.5: 订单绑定功能
- [x] 在 `OrderDetail.tsx` 设备选项卡增加 "物理设备绑定" 区块
- [x] 实现根据序列号绑定订单功能
- [x] 实现并展示已绑定的物理设备实时清单
