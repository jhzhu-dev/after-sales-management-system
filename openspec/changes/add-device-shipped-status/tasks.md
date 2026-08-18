## 1. Implementation

- [x] 1.1 数据库迁移：devices 表新增 shipped_at 列
- [x] 1.2 后端 devices.js：状态白名单增加「已发货」
- [x] 1.3 后端 devices.js：新增 POST /api/devices/:id/ship（校验出厂资料完善 + 生产中状态）
- [x] 1.4 后端 device-bundles.js：bundle_status 派生逻辑增加「已发货」
- [x] 1.5 后端 device-bundles.js：新增 POST /api/device-bundles/:id/ship（事务更新全部成员设备）
- [x] 1.6 前端类型/工具：Device/DeviceFormData 增加 已发货、shipped_at、STATUS_MAP、getStatusColor
- [x] 1.7 前端 api.ts：deviceApi.shipDevice、bundleApi.shipBundle
- [x] 1.8 前端 DeviceDetail：发货按钮 + 发货时间展示 + 状态徽章/图标
- [x] 1.9 前端 DeviceForm/BundleForm：状态下拉增加「已发货」
- [x] 1.10 前端 Devices：单台/多合一列表状态筛选增加「已发货」
- [x] 1.11 前端 BundleDetail：发货按钮 + 成员表格发货时间列
- [x] 1.12 构建验证 + 本地 API 测试 + 恢复测试数据
- [x] 1.13 多合一出厂资料完善时自动同步成员设备为已发货（后端 PUT 路由 + 前端刷新提示）
- [x] 1.14 单台设备出厂资料完善时自动同步为已发货（后端 PUT 路由 + 前端刷新提示）

## 2. Deployment

- [ ] 2.1 生产环境备份数据库
- [ ] 2.2 走现有部署流程发布
