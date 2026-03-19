## Why

当论文有大量 QA 条目（模板问题 + 自由提问）时，用户在 PaperDetail 页面的右侧面板中难以快速定位到特定问题。需要一个类似 Notion 的右侧悬浮快速导航，让用户一目了然地看到所有问题并快速跳转。

## What Changes

- 新增右侧悬浮导航组件，仅在 PaperDetail 页面显示
- 未展开时显示为一列小灰点（每个点对应一个 QA 条目），当前可见条目的点颜色更深
- 鼠标 hover 时向左展开为 ~260px 宽的面板，显示每个 QA 条目的问题标题（单行截断）
- 点击导航项平滑滚动到对应 QA panel 并自动展开折叠
- 半透明设计，未展开时不影响底层文字阅读和选中
- 宽屏和窄屏模式均支持；移动端通过点击触发展开

## Capabilities

### New Capabilities
- `qa-panel-nav`: 右侧悬浮 QA 快速导航组件，提供可视化 minimap 风格的面板定位和跳转功能

### Modified Capabilities

（无需修改现有 spec 的行为要求）

## Impact

- `packages/frontend/src/views/PaperDetail.vue` — 集成导航组件
- `packages/frontend/src/components/QAList.vue` — 需暴露 QA 条目数据和 DOM 引用供导航使用
- 新增 `packages/frontend/src/components/QAPanelNav.vue` 组件
- 可能新增 composable（如 `useScrollSpy`）用于监听滚动位置
- 无后端改动，无 API 变更，纯前端功能
