## ADDED Requirements

### Requirement: 版本与产品型号的多对多关联
系统 SHALL 支持一条版本发布记录关联零个或多个产品型号，关联关系通过 `version_release_products` 中间表持久化。

#### Scenario: 创建版本时关联多个产品型号
- **WHEN** 用户在发布新版本表单中选择产品线并勾选多个产品型号后提交
- **THEN** `version_release_products` 中为该版本写入对应数量的关联记录

#### Scenario: 版本无关联产品型号时正常显示
- **WHEN** 某条版本记录的 product_ids 为空（未选型号）
- **THEN** 该版本仍正常出现在产品线分类筛选结果中，products 字段返回空数组

### Requirement: 产品型号多选表单
系统 SHALL 在版本发布表单的分类选择器下方，当选中的分类对应一条已知产品线时，展示该产品线下所有产品型号的多选 checkbox 列表。

#### Scenario: 新建版本时选择产品型号
- **WHEN** 用户在新建表单中选择产品线分类后
- **THEN** 表单加载该产品线下所有产品型号，以 checkbox 列表形式展示，用户可多选

#### Scenario: 编辑版本时预选已关联型号
- **WHEN** 用户打开已有产品型号关联的版本进行编辑
- **THEN** 对应产品型号的 checkbox 预先勾选，用户可调整

#### Scenario: 编辑版本时补填产品型号
- **WHEN** 用户打开尚未关联产品型号但已有产品线分类的版本进行编辑
- **THEN** 加载该产品线产品列表，所有 checkbox 未勾选，供用户补填

#### Scenario: 切换产品线时清空已选型号
- **WHEN** 用户在表单中切换产品线分类
- **THEN** 已勾选的产品型号全部清空，重新加载新产品线的型号列表

### Requirement: 按产品型号筛选版本列表
系统 SHALL 在版本发布页面的产品线分类 pills 下方，展示当前产品线下所有有关联版本的产品型号 pills，用户点击某型号 pill 后只显示关联该型号的版本。

#### Scenario: 产品型号 pills 显示
- **WHEN** 用户选中一个产品线分类（activeCategory 已设置）且该分类下存在有产品型号关联的版本
- **THEN** 页面显示产品型号 pills 行，每个 pill 对应一个去重后的产品型号

#### Scenario: 点击产品型号 pill 过滤
- **WHEN** 用户点击某个产品型号 pill
- **THEN** 版本列表只显示 products 数组中包含该型号 id 的版本

#### Scenario: 切换产品线时重置型号筛选
- **WHEN** 用户切换到不同的产品线分类 pill
- **THEN** 产品型号筛选重置（activeProductId = null），显示该产品线全部版本
