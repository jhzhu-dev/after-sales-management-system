## Why

当前系统登录依赖写死在环境变量中的单个账号（`LOGIN_USERNAME` / `LOGIN_PASSWORD`），既无法区分操作人，也无法追溯"这条记录是谁创建/修改的"。售后问题、客户需求登记、测试任务等记录中的 `operator` / `uploaded_by` / `created_by` 字段只是文本，无法与真实人员绑定。

需要引入"**手机号 + 验证码**"的注册登录体系，并把**手机号与真实姓名强绑定**，作为操作人的唯一身份标识，支撑责任绑定与审计追踪。

## What Changes

**后端**
- 新建 `server/services/sms-service.js`：统一短信服务层，支持**阿里云短信**（生产）与 **Mock 短信**（本地/无签名调试），抽象风格与现有 `feishu-service.js` 保持一致。
- 数据库新增两张表：
  - `users`：手机号（唯一）、真实姓名、密码哈希、角色、账号状态。
  - `sms_codes`：短信验证码（手机号、验证码、用途、有效期、使用标记）。
- 扩展 `server/routes/auth.js`：
  - `POST /api/auth/sms/send` — 发送注册/登录验证码（频率限制 + 60s 冷却）。
  - `POST /api/auth/register` — 手机号 + 验证码 + 真实姓名 + 密码 注册。
  - `POST /api/auth/login` — 支持"手机号+密码"登录，同时保留原"用户名+密码"兼容。
  - `POST /api/auth/sms/login` — 手机号 + 验证码快捷登录（可选，默认提供）。
  - `GET /api/auth/verify` — 保持不变。
  - 管理员用户管理接口（列表 / 审核 / 启用 / 禁用）。
- JWT payload 扩展为 `{ user_id, phone, real_name, role, username }`；`middleware/authenticate.js` 直接读取 `req.user`。
- `server/index.js` 中 `/api/auth` 仍为公开路由，管理员子接口单独挂载鉴权。

**前端**
- 新建 `client/src/pages/Register.tsx` 注册页（手机号 → 发送验证码 → 验证码 + 真实姓名 + 密码）。
- 改造 `client/src/pages/Login.tsx`：支持「账号登录 / 手机登录」切换。
- 改造 `client/src/context/AuthContext.tsx`：用户信息扩展为 `{ id, phone, real_name, role, username }`。
- `client/src/services/api.ts` 新增 `authApi`（`smsSend`、`register`、`smsLogin` 等）。
- `client/src/App.tsx` 新增 `/register` 路由；`client/src/types/index.ts`、`client/src/utils/index.ts` 同步。
- 可选新增"账号/个人中心"页展示手机号与真实姓名绑定关系。

## Impact

- **Affected specs**：新建 `phone-auth` capability spec。
- **Affected code**：
  - `server/database.js`（`users`、`sms_codes` 建表 SQL）
  - `server/services/sms-service.js`（新建）
  - `server/routes/auth.js`（扩展）
  - `server/middleware/authenticate.js`（读取扩展 payload）
  - `server/index.js`（注册路由、管理员接口挂载）
  - `client/src/pages/Register.tsx`（新建）、`client/src/pages/Login.tsx`、`client/src/context/AuthContext.tsx`、`client/src/services/api.ts`、`client/src/types/index.ts`、`client/src/App.tsx`
- **数据库变更**：新增 `users`、`sms_codes` 两张表，不修改任何现有业务表（零破坏性）。
- **无 API 破坏性变更**：原 `/api/auth/login`、`/api/auth/verify` 继续保持可用。
