## Context

PaperDetail.vue 使用双栏布局，左侧为 PDF/翻译面板，右侧为论文详情和 QA。中间有一个可拖动的分隔条用来调整两侧宽度。

当前问题：
1. 拖动逻辑使用 `document.addEventListener('mousemove', onDrag)`，快速拖动时光标离开分隔条区域后浏览器可能不会稳定地触发事件，导致不跟手
2. 分隔条宽度 `w-1.5`（6px）视觉上偏粗
3. 无法快速折叠左侧面板

## Goals / Non-Goals

**Goals:**
- 拖动时光标始终被捕获，快速拖动也能跟手
- 分隔条视觉更细（2px），同时保持足够的点击热区
- 提供一键折叠/展开左侧面板的按钮
- 折叠/展开有平滑动画过渡

**Non-Goals:**
- 不改变窄屏（<900px）的单栏布局逻辑
- 不修改右侧面板内容
- 不持久化面板宽度或折叠状态（可后续考虑）

## Decisions

### 1. Pointer Capture 替代 mousemove

**选择**: 使用 `pointerdown` + `Element.setPointerCapture()` + `pointermove` + `pointerup`

**原因**: `setPointerCapture` 会将所有后续 pointer 事件路由到捕获元素上，即使光标移出元素甚至移出浏览器窗口。这从根本上解决快速拖动丢失跟踪的问题。

**替代方案**: 保留 mousemove 但增加 `user-select: none` + `pointer-events: none` overlay — 仍然可能在极端情况下丢失，且实现更复杂。

### 2. 分隔条视觉宽度

**选择**: 可见条 2px（`w-0.5`），不可见热区通过 padding 或伪元素扩展到 12px

**原因**: 视觉上更精致，同时 12px 热区保证可操作性。热区使用透明 padding 而非额外的 div。

### 3. 折叠按钮位置与交互

**选择**: 在分隔条垂直中间放置一个小型 icon button（使用 lucide `PanelLeftClose` / `PanelLeftOpen` 图标），白色背景圆形按钮悬浮在分隔条上

**行为**:
- 点击 → 左面板宽度过渡到 0%，分隔条移至最左侧
- 折叠后按钮保持在屏幕左侧垂直居中位置
- 再次点击 → 左面板恢复到之前的宽度
- 折叠状态下拖动条不可拖动

**动画**: 使用 CSS `transition: width 300ms ease` 在左面板上，拖动过程中禁用 transition

### 4. 状态管理

**选择**: 新增 `collapsed` ref 和 `savedWidth` ref

- `collapsed = ref(false)` — 是否折叠
- `savedWidth = ref(45)` — 折叠前的宽度，用于恢复
- 折叠时 `leftWidth = 0`，展开时 `leftWidth = savedWidth`
- 拖动时自动解除折叠状态

## Risks / Trade-offs

- **[Pointer Events 兼容性]** → 所有现代浏览器均支持 Pointer Events API，无风险
- **[折叠动画与拖动冲突]** → 拖动开始时移除 transition class，拖动结束后恢复，确保拖动不受动画延迟影响
- **[折叠按钮遮挡内容]** → 按钮使用小尺寸（24px）+ 半透明背景 + hover 时完全显示，静止时略微透明以减少视觉干扰
