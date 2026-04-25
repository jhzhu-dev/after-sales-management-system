## 1. 基础设施 - Mock 飞书服务器

- [ ] 1.1 新建 server/routes/mock-feishu.js
- [ ] 1.2 新建 server/routes/mock-feishu-inbox.js
- [ ] 1.3 server/index.js 条件挂载 Mock 路由

## 2. 数据库

- [ ] 2.1 server/database.js 新增 feishu_config、feishu_users 建表 SQL
- [ ] 2.2 server/database.js 新增 ALTER TABLE issues ADD COLUMN assignee_open_id

## 3. 飞书服务层

- [ ] 3.1 新建 server/services/feishu-service.js

## 4. 飞书管理路由

- [ ] 4.1 新建 server/routes/feishu.js
- [ ] 4.2 server/index.js 注册 /api/feishu 路由

## 5. 通知触发钩子

- [ ] 5.1 server/routes/issues.js — POST 钩子（assignee_open_id + notify_assignee）
- [ ] 5.2 server/routes/issues.js — PUT 钩子（状态/分配变更通知）
- [ ] 5.3 server/routes/devices.js — POST 钩子（notify_open_id + send_notify）
- [ ] 5.4 server/routes/device-upgrades.js — POST 钩子（operator_open_id + notify_operator）

## 6. 前端类型与服务

- [ ] 6.1 client/src/types/index.ts 新增 FeishuUser 类型及各表单新字段
- [ ] 6.2 client/src/services/api.ts 新增 feishuApi 方法组

## 7. 通用飞书用户选择组件

- [ ] 7.1 新建 client/src/components/FeishuUserPicker.tsx

## 8. 前端表单改造

- [ ] 8.1 client/src/components/IssueForm.tsx — assignee 改造 + 通知勾选
- [ ] 8.2 client/src/components/DeviceForm.tsx — 新增通知负责人字段 + 通知勾选
- [ ] 8.3 client/src/components/UpgradeForm.tsx — operator_id 改造 + 通知勾选

## 9. 飞书配置管理页

- [ ] 9.1 新建 client/src/pages/FeishuSettings.tsx
- [ ] 9.2 client/src/App.tsx 新增路由 /feishu-settings
- [ ] 9.3 client/src/components/Layout.tsx 侧边栏新增「飞书设置」入口

## 10. 环境配置

- [ ] 10.1 env.example 新增飞书相关变量

## 11. 验证

- [ ] 11.1 Mock 模式启动，访问 /mock-feishu-inbox 确认页面正常
- [ ] 11.2 同步员工，确认 feishu_users 写入4条记录
- [ ] 11.3 创建问题并选 assignee，收件箱出现问题卡片
- [ ] 11.4 取消勾选通知，提交后收件箱无新消息
- [ ] 11.5 修改问题状态，收件箱出现状态变更卡片
- [ ] 11.6 创建设备并选通知人，收件箱出现设备通知卡片
- [ ] 11.7 登记升级记录并选执行人，收件箱出现升级任务卡片
- [ ] 11.8 feishu_users 为空时三处表单降级为原文本框
- [ ] 11.9 npm run build 构建无报错
