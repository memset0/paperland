## Why

论文详情页目前只展示标签（点击跳转筛选），但用户无法在详情页直接管理论文的标签。每次想给论文添加或移除标签都需要通过其他方式操作，体验不佳。应在详情页提供内联的标签编辑功能。

## What Changes

- **详情页标签区域增加编辑模式**：在标签展示区域旁添加编辑按钮，点击后切换为 TagSelector 组件，允许用户添加/移除/创建标签
- **保存后自动刷新**：编辑完成后调用 `PUT /api/papers/:id/tags` 保存，自动刷新论文详情和标签缓存
- **两处标签展示均支持编辑**：PaperDetail.vue 有两处标签展示（宽屏 split view 和窄屏 single column），两处都支持编辑

## Capabilities

### New Capabilities
- `paper-detail-tag-edit`: 论文详情页内联标签编辑（添加/移除/创建标签）

### Modified Capabilities

## Impact

- **Frontend**: 修改 `PaperDetail.vue`（增加标签编辑模式），复用现有 `TagSelector.vue` 组件和 `/api/papers/:id/tags` API
