## Why
版本发布中心目前只支持按模块类型和产品线分类筛选版本，无法进一步细化到具体产品型号。用户需要在选择产品线分类时，能同时为版本关联一个或多个具体产品型号（如 DIA-PV-C、DIA-PV-D），并在页面上按产品型号筛选版本记录。同时，已有的版本记录也需要支持补填产品型号。

## What Changes
- 新建中间表 `version_release_products (release_id, product_id)`，实现版本与产品型号的多对多关联
- 后端 GET 接口在每条 release 中附加 `products: [{id, name, model}]` 数组；POST/PUT 接口接收 `product_ids[]`
- 前端表单（VersionReleaseForm）：选择产品线后在分类选择器下方显示该产品线的产品型号 checkbox 多选列表；编辑模式预选已关联型号，支持补填
- 前端页面（ReleaseLibrary）：产品线分类 pills 下方增加产品型号 pills，点击后筛选包含该型号的版本

## Impact
- Affected specs: release-library（新建）
- Affected code: server/routes/version-releases.js, client/src/types/index.ts, client/src/services/api.ts, client/src/components/VersionReleaseForm.tsx, client/src/pages/ReleaseLibrary.tsx
- 数据库：新建 `version_release_products` 表，不修改 `version_releases` 主表（零破坏性）
- 无 API 破坏性变更：product_ids 为可选字段，现有调用方不受影响
