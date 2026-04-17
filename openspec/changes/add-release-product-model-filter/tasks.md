## 1. 数据库
- [x] 1.1 创建 version_release_products 中间表（含 UNIQUE 约束和 ON DELETE CASCADE）

## 2. 后端
- [x] 2.1 GET /version-releases：子查询附加 products 数组，支持 product_id 过滤参数
- [x] 2.2 POST /version-releases：接收 product_ids[]，批量写入中间表
- [x] 2.3 PUT /version-releases/:id：接收 product_ids[]，delete + re-insert 中间表

## 3. 前端类型与服务
- [x] 3.1 client/src/types/index.ts：VersionRelease 新增 products 字段
- [x] 3.2 client/src/services/api.ts：versionReleaseApi.getReleases 参数类型加入 product_id

## 4. 前端组件
- [x] 4.1 VersionReleaseForm：product_ids 多选 checkbox，监听 category 加载产品，编辑/补填预选
- [x] 4.2 ReleaseLibrary：activeProductId 状态，产品型号 pills，客户端过滤

## 5. 构建与部署
- [x] 5.1 执行 npm run build 构建前端
- [x] 5.2 重启本地服务验证功能
