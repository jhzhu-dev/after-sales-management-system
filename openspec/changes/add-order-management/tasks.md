# Tasks: 订单管理核心 (Order Management Core)

## Phase 2.1: 数据库与实体层
- [x] 2.1 创建 `orders` 表
- [x] 2.2 创建 `order_payments` 表
- [x] 2.3 创建 `order_devices` 表
- [x] 2.4 创建 `order_hardware_configs` 表
- [x] 2.5 创建 `order_software_configs` 表
- [x] 2.6 创建 `order_shipping_info` 表
- [x] 2.7 创建 `order_progress` 表

## Phase 2.2: 后端 API 实现
- [x] 2.8 实现订单基础 CRUD API (`orders.js`)
- [x] 2.9 实现订单设备配置 API (集成在 orders 逻辑中)
- [x] 2.10 实现订单进度与 SOP 审核 API (`order-progress.js`)
- [x] 在 `server/index.js` 中完成路由中心注册

## Phase 2.3: 流程与验证
- [x] 确立订单流转逻辑 (生产 -> 调试 -> 打包 -> 物流 -> 完成)
- [x] 编写并运行初始化脚本 `seed-phase2.js`
- [x] 完成多级嵌套数据创建事务测试

## Phase 2.4: 前端实现 (已完成)
- [x] 2.11 创建订单列表页面 (`Orders.tsx`)
- [x] 2.12 创建订单详情页面 (`OrderDetail.tsx`)
- [x] 2.18 创建/优化订单创建页面 (`OrderCreate.tsx`)
  - [x] 动态产品清单选择逻辑 (产品线 -> 具体产品)
  - [x] 订单创建日期自动填充
- [x] 2.13 创建硬件配置表单组件
- [x] 2.14 创建软件配置表单组件
- [x] 2.15 创建订单进度时间线组件 (`ProgressTimeline.tsx`)
- [x] 2.16 创建 SOP 检查清单组件 (`SOPChecklist.tsx`)
- [x] 2.17 创建审核对话框组件 (`ReviewDialog.tsx`)

## Phase 2.5: 增强与修复 (已完成)
- [x] 2.19 统一阶段命名为“装配”，流程调整为 装配 -> 部署 -> 调试 -> 打包 -> 物流 -> 完成
- [x] 2.20 订单设备按台拆分并生成 SN，补齐历史数据迁移脚本
- [x] 2.21 订单概述与数量由设备列表自动汇总
- [x] 2.22 付款记录支持创建与状态/备注编辑
- [x] 2.23 生产中心按设备进度驱动“完成阶段”与时间线展示
- [x] 2.24 订单详情编辑体验优化（日期格式、概述同步）
- [x] 2.25 设备配置表单移除版本字段（版本归属到设备层）
