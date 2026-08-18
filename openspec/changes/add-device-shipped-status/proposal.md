## Why

设备出厂后到客户安装之间存在"在途"阶段，当前状态机（生产中 → 使用中）无法表达，导致无法区分"未发货"与"已发货未安装"的设备。需要新增「已发货」状态并记录发货时间，方便售后跟进。

## What Changes

- 设备状态新增「已发货」（生产中 → 已发货 → 使用中）
- 设备出厂资料标记为已完善（factory_docs_complete = true）且状态为「生产中」时，自动将设备置为「已发货」（保留「发货」按钮作为兜底）
- 发货时记录 `shipped_at` 并展示在设备详情页
- 已发货 状态允许退回「生产中」（取消发货），允许通过编辑表单改为「使用中(正常)/使用中(异常)/已停用」
- 多合一设备支持「已发货」：bundle_status 派生逻辑加入已发货；多合一详情页提供「发货」按钮，将全部成员设备置为已发货
- 多合一设备状态整合：当多合一设备的出厂资料被标记为已完善（factory_docs_complete = true）时，自动将其下处于「生产中」的成员设备同步为已发货（与单台设备发货逻辑一致）
- 设备/多合一列表筛选、表单、打印、导出均支持新状态

## Impact

- Affected specs: device-management（新增能力 spec）
- Affected code:
  - `server/database.js`（devices 表新增 shipped_at 列迁移）
  - `server/routes/devices.js`（状态白名单 + POST /api/devices/:id/ship）
  - `server/routes/device-bundles.js`（bundle_status 派生逻辑 + POST /api/device-bundles/:id/ship）
  - `client/src/types/index.ts`、`client/src/utils/index.ts`
  - `client/src/pages/DeviceDetail.tsx`、`client/src/pages/BundleDetail.tsx`、`client/src/pages/Devices.tsx`
  - `client/src/components/DeviceForm.tsx`、`client/src/components/BundleForm.tsx`
  - `client/src/services/api.ts`
- 数据库变更：`ALTER TABLE devices ADD COLUMN shipped_at TIMESTAMP NULL`（非破坏性，需备份后执行）
