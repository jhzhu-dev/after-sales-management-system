## 1. 数据库

- [ ] 1.1 `server/database.js` — `createTables()` 新增 `users` 建表 SQL（含唯一键、真实姓名、状态）
- [ ] 1.2 `server/database.js` — `createTables()` 新增 `sms_codes` 建表 SQL（含过期、使用标记、attempts 索引）

## 2. 短信服务层

- [ ] 2.1 新建 `server/services/sms-service.js`（provider=mock|aliyun 抽象）
- [ ] 2.2 Mock 模式：生成验证码、写日志、可回写 mock 收件箱/响应
- [ ] 2.3 阿里云模式：接入短信 SDK 发送

## 3. 认证路由

- [ ] 3.1 `server/routes/auth.js` — `POST /api/auth/sms/send`（限流 + 60s 冷却）
- [ ] 3.2 `server/routes/auth.js` — `POST /api/auth/register`（验证码校验 + 实名 + bcrypt 密码）
- [ ] 3.3 `server/routes/auth.js` — `POST /api/auth/login`（手机号+密码，保留用户名+密码兼容）
- [ ] 3.4 `server/routes/auth.js` — `POST /api/auth/sms/login`（验证码快捷登录）
- [ ] 3.5 `server/routes/auth.js` — 管理员用户管理接口（列表/审核/启用/禁用）
- [ ] 3.6 `server/middleware/authenticate.js` — 读取扩展 payload（user_id/phone/real_name/role）
- [ ] 3.7 `server/index.js` — `/api/auth` 保持公开，管理员接口挂载鉴权

## 4. 配置

- [ ] 4.1 `env.example` 新增短信与认证相关变量

## 5. 前端类型与 API

- [ ] 5.1 `client/src/types/index.ts` 新增 `User`、`RegisterPayload`、`SmsSendPayload`、`SmsLoginPayload`
- [ ] 5.2 `client/src/services/api.ts` 新增 `authApi`（smsSend/register/smsLogin）

## 6. 前端认证上下文

- [ ] 6.1 `client/src/context/AuthContext.tsx` — 用户信息扩展（id/phone/real_name），新增 `register`/`smsLogin`

## 7. 前端页面

- [ ] 7.1 新建 `client/src/pages/Register.tsx`（手机号 + 验证码倒计时 + 实名 + 密码）
- [ ] 7.2 改造 `client/src/pages/Login.tsx`（账号/手机 切换 + 验证码/密码 模式）
- [ ] 7.3 `client/src/App.tsx` 新增 `/register` 路由
- [ ] 7.4 （可选）`client/src/pages/Account.tsx` 账号/实名绑定展示页

## 8. 验证

- [ ] 8.1 Mock 模式：发送验证码，确认 `sms_codes` 落库、验证码可查
- [ ] 8.2 注册：手机号+验证码+实名+密码 → `users` 写入，验证码失效
- [ ] 8.3 登录：手机号+密码 成功；错误密码失败且限流
- [ ] 8.4 验证码登录：手机号+验证码 成功，且验证码单次失效
- [ ] 8.5 原「用户名+密码」admin 登录仍可用（兼容）
- [ ] 8.6 `pending` 用户登录被拦截（方案 A）或直接可用（方案 B）
- [ ] 8.7 `npm run build` 前端构建无报错
- [ ] 8.8 管理员审核通过后，用户可正常登录
