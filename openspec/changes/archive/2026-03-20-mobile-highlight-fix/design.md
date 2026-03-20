## Context

MarkdownContent.vue 的高亮功能当前完全依赖鼠标事件：

| 功能 | 当前事件 | 移动端问题 |
|------|---------|-----------|
| 选择检测 | `@mouseup` | Android 文本选择时 `mouseup` 可能在选择完成前触发或不触发 |
| Tooltip 显示 | `@mouseover` / `@mouseout` | 触屏无 hover，事件永远不会触发 |
| 高亮菜单 | `@click` | 部分可用，但与原生选择菜单冲突 |
| 弹窗关闭 | `document mousedown` | 触屏上不可靠 |

核心问题：Android 浏览器在用户进行文本选择时，会接管触摸事件流（显示原生选择手柄），导致标准 mouse 事件序列被打断。

## Goals / Non-Goals

**Goals:**
- 文本选择 + 高亮创建在移动端（iOS Safari、Android Chrome）正常工作
- 已有高亮的查看笔记（tooltip）在移动端可用
- 已有高亮的编辑/删除（click menu）在移动端可用
- 桌面端行为完全不变
- 工具栏/菜单的触摸区域符合移动端可用性标准

**Non-Goals:**
- 不重写高亮的 DOM 操作逻辑（useHighlight.ts 的 offset/segment 系统已经稳定）
- 不改动后端 API 或数据模型
- 不实现移动端专属 UI（如底部 action sheet），复用现有浮动工具栏
- 不处理极端旧版浏览器兼容性

## Decisions

### 1. 选择检测：selectionchange 事件替代 mouseup

**选择**: 使用 `document.addEventListener('selectionchange')` 配合防抖，替代 `@mouseup`

**理由**:
- `selectionchange` 是 W3C 标准事件，在桌面和移动端均可靠触发
- Android 文本选择（拖动手柄调整范围）过程中会持续触发 `selectionchange`，用户松手后最终选择稳定时也会触发
- 比 `mouseup` + `touchend` 双绑定方案更简洁，不需要处理事件去重

**替代方案考虑**:
- `mouseup` + `touchend` 双绑定：需处理两个事件可能同时触发的去重问题，且 Android 选择手柄操作期间 `touchend` 也不一定可靠
- Pointer Events (`pointerup`)：抽象层更高但在选择流程中行为与 `mouseup` 类似，不解决根本问题

**实现要点**:
- 防抖 300ms（移动端选择操作较慢，需要等待稳定）
- 仅在 `containerRef` 内有效选择时响应
- 组件卸载时移除监听器

### 2. 触摸设备检测

**选择**: 运行时检测 `'ontouchstart' in window || navigator.maxTouchPoints > 0`

**理由**: 项目中 QAPanelNav.vue 已使用相同检测方式，保持一致。用于决定：
- Tooltip 触发方式（hover vs tap）
- 事件监听器注册（是否需要 touchstart 用于关闭弹窗）

### 3. Tooltip 触摸适配：tap 触发替代 hover

**选择**: 触摸设备上，tap（短按）高亮标记显示 tooltip，再次 tap 或 tap 其他区域关闭

**理由**:
- 触屏无 hover 概念，长按通常被系统占用（选择文本/上下文菜单）
- tap 是触屏上最自然的"查看"操作
- 桌面端保持 hover 行为不变

**实现**: 触摸设备上 `@click` 同时处理 tooltip 显示和 menu 显示逻辑，第一次 tap 显示 tooltip（如果有 note），第二次 tap 显示编辑 menu。或者简化为：tap 直接显示 menu（menu 中已包含 note 信息）。

**最终决定**: 触摸设备上 tap 高亮标记直接显示 click menu（包含 note 编辑功能），跳过独立 tooltip。理由：减少交互步骤，menu 已包含全部功能。

### 4. 弹窗关闭：双事件监听

**选择**: `mousedown` + `touchstart` 同时监听 document

**理由**: 确保桌面端和触摸设备都能通过点击/触摸空白区域关闭弹窗。两个事件不会在同一设备上同时有意义地触发（mousedown 在纯触摸操作中虽然也触发但不影响逻辑幂等性）。

### 5. 工具栏定位适配

**选择**: 选择工具栏定位增加视口边界检测，确保不超出屏幕

**理由**: 移动端屏幕窄，工具栏居中于选择区域可能超出左右边缘。添加 clamp 逻辑确保工具栏完全可见。

## Risks / Trade-offs

- **selectionchange 防抖延迟** → 工具栏弹出比桌面端 mouseup 方案慢约 300ms。可接受，因为移动端用户对选择操作的响应时间预期本身就更宽容。桌面端可以用更短的防抖（50ms）。
- **Android 原生选择菜单冲突** → Android 文本选择时会显示系统级 "复制/全选" 菜单。我们的工具栏会在选择稳定后出现在不同位置，两者可以共存。如果用户通过系统菜单操作导致选择消失，`selectionchange` 会检测到并隐藏工具栏。
- **CSS `-webkit-user-select` 风险** → 不应使用 `user-select: none` 在内容区域，否则会禁用文本选择。只在工具栏/菜单元素上使用。
- **iOS Safari 选择 API 差异** → iOS Safari 的 `selectionchange` 支持良好（iOS 14+），但选择完成后可能多触发一次事件。防抖机制可以处理。
