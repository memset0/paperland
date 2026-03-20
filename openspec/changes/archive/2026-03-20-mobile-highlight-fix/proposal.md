## Why

Markdown 高亮功能在移动端（尤其是 Android）无法正常使用。当前实现完全依赖鼠标事件（`mouseup`、`mouseover`、`mouseout`、`mousedown`），这些事件在触屏设备上行为不一致或根本不触发。Android 浏览器在文本选择时有自己的原生交互流程，导致 `mouseup` 在选择完成前触发或根本不触发，选择工具栏无法弹出。

## What Changes

- **替换选择检测机制**：从 `@mouseup` 改为 `selectionchange` 事件监听，这是跨平台检测文本选择变化的标准方式，在桌面和移动端均可靠触发
- **添加触摸事件支持**：为关闭弹出菜单添加 `touchstart` 事件监听（与 `mousedown` 并行），确保移动端可以通过点击空白区域关闭所有弹窗
- **触摸设备交互适配**：
  - Hover tooltip 在触摸设备上改为 tap 触发（因为触屏没有 hover）
  - 高亮标记的 click menu 使用 `touchend` + `click` 双重绑定
  - 选择工具栏定位逻辑适配移动端视口
- **增加选择防抖延迟**：移动端选择操作比桌面端慢，增加适当的防抖时间让选择在读取前完全稳定
- **CSS 触摸优化**：确保工具栏按钮在触屏上有足够的点击区域（≥44px touch target）

## Capabilities

### New Capabilities
_无新增能力_

### Modified Capabilities
- `markdown-highlight`: 文本选择检测从 mouseup 改为 selectionchange，交互事件全面支持触摸设备，工具栏和菜单的触发/关闭/定位适配移动端

## Impact

- **前端组件**: `packages/frontend/src/components/MarkdownContent.vue` — 事件绑定和交互逻辑重构
- **前端 composable**: `packages/frontend/src/composables/useHighlight.ts` — 可能需要微调选择偏移量的获取时机
- **无后端改动**: API 和数据模型不变
- **无破坏性变更**: 桌面端行为保持不变，仅新增移动端支持
