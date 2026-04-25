## Why
系统缺乏主动通知能力，用户创建售后问题或设备、登记升级记录后，相关负责人只能靠人工告知或主动查询。
引入飞书机器人卡片消息，在关键事件发生时自动 @到对应员工，提升响应速度。
同时提供 Mock 模拟环境，无需真实飞书账号即可完整测试通知链路，上生产只需替换4个环境变量。

## What Changes
**后端**
- 新建 Mock 飞书服务器路由（mock-feishu.js）+ 消息收件箱页（mock-feishu-inbox.js）
- 新建飞书服务层（feishu-service.js），通过 FEISHU_BASE_URL 统一调用 Mock 或真实飞书
- 数据库新增两张表：feishu_config（配置）、feishu_users（通讯录员工缓存）
  issues 表新增 assignee_open_id 列（向后兼容）
- 新建飞书管理路由（feishu.js）：配置读写、同步员工、测试消息
- 改造 issues.js / devices.js / device-upgrades.js：
  接收 notify 布尔字段，在创建/更新后异步触发飞书通知

**前端**
- 新建通用组件 FeishuUserPicker.tsx（下拉选人 + 是否通知勾选框）
- 改造 IssueForm.tsx：assignee 改为飞书用户选择器 + 通知勾选，降级支持原文本框
- 改造 DeviceForm.tsx：新增「通知负责人」字段 + 通知勾选
- 改造 UpgradeForm.tsx：operator_id 改为飞书用户选择器 + 通知勾选
- 新建飞书设置页 FeishuSettings.tsx，集成到 Settings 页面
- client/src/services/api.ts 新增 feishuApi 方法组
- client/src/types/index.ts 新增 FeishuUser 类型及各表单新字段

## UI 交互设计（三处表单一致）
选人下拉 → 勾选框自动勾上（默认通知）→ 用户可手动取消
未选员工时勾选框禁用；飞书未配置时整块区域不显示（降级原文本框）

## Impact
- Affected specs: 新建 feishu-notification spec
- Affected code:
    server/database.js, server/index.js
    server/routes/issues.js, server/routes/devices.js, server/routes/device-upgrades.js（新增通知钩子）
    server/services/feishu-service.js（新建）
    server/routes/feishu.js, server/routes/mock-feishu.js, server/routes/mock-feishu-inbox.js（新建）
    client/src/types/index.ts, client/src/services/api.ts
    client/src/components/FeishuUserPicker.tsx（新建）
    client/src/components/IssueForm.tsx, DeviceForm.tsx, UpgradeForm.tsx（改造）
    client/src/pages/FeishuSettings.tsx（新建）
    client/src/App.tsx, env.example
- 数据库：新增2张表，issues 表新增1列，不修改其他现有表（零破坏性）
- 无 API 破坏性变更：所有新字段均为可选，现有调用方不受影响
