# phone-auth Specification

## Purpose
为系统引入「手机号 + 短信验证码」注册登录，并将手机号与真实姓名强绑定作为操作人身份，支持责任绑定与审计追踪。

## Requirements

### Requirement: 手机号验证码注册
系统 SHALL 支持用户通过手机号 + 短信验证码完成注册，注册时必须填写并与手机号绑定真实姓名。

#### Scenario: 发送注册验证码
- **WHEN** 用户提交手机号请求发送注册验证码
- **THEN** 后端校验手机号格式、是否已注册及发送冷却，生成 6 位验证码写入 `sms_codes` 表并通过短信服务发送（Mock 或阿里云）

#### Scenario: 验证码发送频率限制
- **WHEN** 同一手机号在 60 秒内重复请求发送
- **THEN** 后端返回频率限制错误，不重复发送

#### Scenario: 注册成功并绑定实名
- **WHEN** 用户提交手机号 + 验证码 + 真实姓名 + 密码，且验证码有效
- **THEN** 创建 `users` 记录（phone 唯一、real_name 必填、密码 bcrypt 哈希），验证码标记为已使用

#### Scenario: 验证码失效
- **WHEN** 验证码已过期、已使用或验证失败次数超限
- **THEN** 注册接口返回错误，不创建用户

### Requirement: 手机号登录
系统 SHALL 支持手机号 + 密码登录，并保留原用户名 + 密码登录兼容。

#### Scenario: 手机号 + 密码登录成功
- **WHEN** 用户提交已注册手机号与正确密码
- **THEN** 后端校验密码哈希，签发包含 user_id/phone/real_name/role 的 JWT

#### Scenario: 密码错误
- **WHEN** 用户提交错误密码
- **THEN** 返回登录失败并计入失败限流

### Requirement: 手机验证码快捷登录
系统 SHALL 支持手机号 + 验证码快捷登录（一次性验证码）。

#### Scenario: 验证码登录成功
- **WHEN** 用户提交已注册手机号与有效验证码
- **THEN** 签发 JWT，验证码标记为已使用（单次有效）

### Requirement: 真实姓名绑定与展示
系统 SHALL 将手机号与真实姓名绑定，并在认证后的请求上下文与前端用户信息中体现真实姓名。

#### Scenario: JWT 携带实名
- **WHEN** 用户完成登录/注册
- **THEN** JWT 与 `req.user` 包含 `user_id/phone/real_name/role`
