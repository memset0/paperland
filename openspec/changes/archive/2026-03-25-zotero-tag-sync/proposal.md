## Why

paper-tags 功能已在后端和前端实现完成，External API 也已支持标签的增量同步（`PATCH /external-api/v1/papers/:id/tags`）。但 Zotero 插件目前仅是一个只读的侧边栏查看器，不会将 Zotero 中的标签同步到 Paperland。用户在 Zotero 中为论文打的标签无法自动同步到 Paperland，需要手动在 Paperland 中重新添加。

## What Changes

- **标签同步逻辑**：在 Zotero 插件解析论文并获取 Paperland paper ID 后，自动读取 Zotero item 的标签（`item.getTags()`），调用 `PATCH /external-api/v1/papers/:id/tags` 将标签增量同步到 Paperland（仅 add，不 remove，避免误删 Paperland 中用户手动添加的标签）
- **同步时机**：每次侧边栏面板渲染时（即用户选中论文时）自动同步标签
- **面板状态展示**：在侧边栏面板的状态行显示标签同步结果（如 "已同步 3 个标签"）
- **API 模块扩展**：在 `modules/api.ts` 中新增 `syncTags(paperId, tagNames)` 函数

## Capabilities

### New Capabilities
- `zotero-tag-sync`: Zotero 插件自动同步 Zotero item 标签到 Paperland（增量添加模式）

### Modified Capabilities

## Impact

- **Zotero Plugin**: 修改 `packages/zotero-plugin/src/modules/api.ts`（新增 syncTags 函数）、`modules/panel.ts`（在 onAsyncRender 中调用标签同步并显示状态）
- **Backend**: 无需修改，现有 External API 已完全支持
