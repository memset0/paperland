## Context

论文详情页（`packages/frontend/src/views/PaperDetail.vue`）当前把提问框 `QAInput` 常驻渲染在两处：

- 宽屏（split-view，`window.innerWidth >= 900`）：`QAInput`（`:sticky="false"`）以 `absolute bottom-0 left-0 right-0 z-10` 钉在左侧 PDF 栏底部。
- 窄屏：`QAInput`（`:sticky="true"`）渲染为 `fixed bottom-0`（移动端）/ `md:sticky`（桌面窄屏）。

`QAInput.vue` 自身是一个 `Card`，第一行是"模型"标签 + 模型选择按钮（flex-wrap），第二行是 `Textarea`（flex-1）+ 仅图标的发送按钮（`size="icon"`），提交按钮在右下角。

参照系是"笔记"浮窗：`notes/FloatingNoteWindow.vue` + `stores/windows.ts`。它用 PointerEvent 实现标题栏拖动（`onHeaderDown/Move/Up`，桌面端 `x/y` 自由移动）与右下角缩放，`isMobile` 时切换为 `inset-0` 全屏；`windows` store 维护 `windows[]`（含 `x/y/w/h/z`）、`topZ` 栈序，并把最后一次缩放尺寸写入 localStorage（`paperland_note_window_size`），新窗口以记忆尺寸打开。

本次改造要把提问框从"常驻钉底"改为"按需弹出的浮动窗口"，并新增一个可扩展的功能入口（电脑端右上角平铺、移动端圆形 FAB）。约束：提问框**内容本身**（模型选择 + 输入框 + 提交逻辑）不重新设计，仅调整表单内布局；浮窗每次打开都回默认几何尺寸、不记忆（与笔记窗口相反）。

## Goals / Non-Goals

**Goals:**
- 提问框不再常驻遮挡视野；点击功能入口后才弹出浮动窗口。
- 浮窗参照笔记浮窗：浮于内容之上、带标题栏与关闭按钮、桌面端可拖动、移动端全屏。
- 浮窗默认几何尺寸**每次打开重算、不持久化**：双栏贴左下角且宽=左侧 PDF 栏宽，单栏占下方全宽。
- 新增功能入口：电脑端右上角直接平铺功能按钮（非菜单）、移动端圆形 FAB 点开功能列表；可扩展、按页面功能顺序排列，当前仅"提问"。
- 表单布局微调：提交按钮移到模型选择同一行（右端），输入框占满整行；提交按钮加 "Submit" 文字。

**Non-Goals:**
- 不改 `QAPanelNav`（右侧滚动导航点条）、`QAList`（答案展示）及任何后端 API / 提问业务逻辑。
- 不把"笔记""引用"真正接入新入口（本次入口仅暴露"提问"，只保留可扩展结构与顺序约定）。
- 不让提问浮窗记忆上次位置/尺寸（与笔记窗口刻意不同）。
- 不引入新依赖（继续用 PointerEvent + `@vueuse/core` 的 `useMediaQuery`）。

## Decisions

### 决策 1：浮动面板 = QAInput 卡片本身（单层），不再套独立窗口外壳
最初实现把 `QAInput`（本身是一个 `Card`）塞进一个带标题栏的 `QAFloatingWindow` 窗口里，结果是"窗口边框套卡片边框"的双层结构。按用户反馈，**取消独立窗口组件**，让 QAInput 卡片自己就是浮动面板（外圈即卡片自身边框，保持原有大小），把关闭/拖动等控件直接整合进卡片，避免"一个套一个"。

- 新增 `composables/useQAWindow.ts`：模块级单例，暴露 `open(geometry)` / `close()` / `isOpen` 及底部锚定的几何 `left/bottom/width`。`open` 接收调用方算好的默认几何并直接覆盖（不读 localStorage）。拖动只更新内存中的 `left/bottom`，关闭即丢弃。
- `components/QAInput.vue` 改造为浮动面板：根元素即 `Card`，`v-if="isOpen"`；桌面端 `position: fixed` + `left/bottom/width`（底部锚定、高度随内容自适应，保持卡片自然大小），移动端 `inset-0` 全屏。拖动逻辑（PointerEvent）就地实现在卡片右下角手柄上。
- **不共用笔记 `windows` store**：笔记是"多窗口、按 note 键、记忆尺寸"，提问是"单实例、每次默认几何、不记忆"，语义相反；亦不做通用 `FloatingWindow` 抽象（收益有限、且会牵动已稳定的笔记代码）。

### 决策 2：默认几何由 `PaperDetail` 计算后传入（top-left 锚定，可缩放）
面板可缩放，故采用标准的 top-left 锚定 `{left, top, width, height}`（同笔记窗口模型）。只有 `PaperDetail` 知道当前是双栏还是单栏、左侧栏宽度（`leftWidth%`、`collapsed`）、`#split-container` / `narrowScrollRef` 的位置，因此**由 `PaperDetail` 在打开时计算默认几何并传给 `open()`**；默认高度 `QA_DEFAULT_HEIGHT`（约 2 行输入框）。

- 双栏：由 `#split-container` 的 `getBoundingClientRect()` × `leftWidth/100` 得左栏宽；`width = 左栏宽`，`left = 容器左边缘`，`top = 容器底 − height`（贴左下角）。
- 单栏：由 `narrowScrollRef` 的 rect 得 `left/width`（内容区完整横向宽度），`top` 同上。
- 移动端：忽略以上，走全屏（inset-0）分支。
- **备选**：面板内部自己读 DOM 算。否决——会与 `PaperDetail` 的 `showSplitView`/`leftWidth` 逻辑重复且易不同步。

### 决策 3：功能入口（launcher）单独成组件，内部维护"功能项"数组
新增 `components/PaperActionLauncher.vue`，挂在 `PaperDetail` 内。内部用一个有序"功能项"数组（`{ key, label, icon, onSelect }`）驱动渲染，当前仅 `[{ key:'ask', label:'提问', icon:Send, onSelect: openQA }]`，顺序约定为页面功能区块顺序（引用 → 笔记 → 提问），后续新增项按序插入。

- 桌面端（`!isMobile`）：在论文详情页右上角以 `fixed`/`absolute` 直接平铺渲染功能按钮（图标 + 文字），无下拉/展开动作。位置避开右侧 `QAPanelNav`（垂直居中于右缘）——launcher 贴顶部右角。
- 移动端（`isMobile`）：渲染一个圆形 FAB（`fixed` 于右下角，圆形、带阴影，参照 `PdfViewer` 已有的浮动按钮样式约定）。点击切换展开一个竖直功能列表（speed-dial 式），点功能项触发并收起。
- **备选**：桌面端也用 FAB/菜单。否决——用户明确"右上角没有菜单一说，而是直接列出所有"。

### 决策 4：面板内控件布局与拖动/缩放分工
顶部一行自左至右为：**提交按钮**（`<Send/> Submit`，常规 `size="sm"`）→ 占据中间的"模型"标签与模型选择按钮（`flex-1 min-w-0 flex-wrap`）→ **关闭按钮**（`ghost` 图标按钮，位于面板右上角，即原提交按钮的位置，点击 `close()`）。其下为占满整行的 `Textarea`，`rows="2"` 默认两行、`flex-1 min-h-0` 随面板增高填充、`resize-none` 去掉自身缩放手柄。

拖动/缩放分工（桌面端）：
- **缩放**：面板**右下角**的缩放手柄（对角线 SVG），`@pointerdown.stop` 调 `onResizeDown`，更新 `width/height`（受最小尺寸约束）。
- **移动**：在**卡片任意空白处**（非 textarea / 非按钮 / 非缩放手柄）按下拖动即可移动面板（更新 `left/top`）。`onCardDown` 用 `e.target.closest('button, textarea, a, input, label, [data-qa-resize]')` 判断是否落在交互元素上：是则不触发移动（保证点击按钮、选中文本正常）。卡片根加 `cursor-move` 暗示可拖。
- 移动端全屏，既不显示缩放手柄也不拖动。

提交/模型/登录态逻辑保持不变。

### 决策 5：从 `PaperDetail` 移除两处常驻 `QAInput`
删除宽屏左栏底部的 `<div class="absolute bottom-0 …"><QAInput/></div>` 与窄屏底部的 `<QAInput sticky/>`，以及为避让它们而加的内容底部 padding（如有冗余）。改为挂载 `<PaperActionLauncher/>` + `<QAFloatingWindow/>`。

## Risks / Trade-offs

- **[双栏默认几何计算依赖 DOM 测量]** 左栏宽度随用户拖动分隔条变化；打开浮窗时需取当时的实测宽度。→ 在 `open()` 时即时 `getBoundingClientRect()` 读取，不缓存；`leftWidth`/`collapsed` 变化不需要同步已开窗口（窗口一旦打开就独立，符合"不记忆/每次重算"语义）。
- **[launcher 与 `QAPanelNav` 在右侧重叠]** 两者都靠右。→ launcher 固定在右上角，`QAPanelNav` 垂直居中靠右缘，z-index 与垂直位置错开；必要时给 launcher 更高 z-index。
- **[移动端 FAB 与全屏浮窗层级]** 笔记全屏窗口 `zIndex: 200`。→ 提问全屏浮窗取同量级或更高 z-index，确保盖住 FAB 与页面；关闭后 FAB 恢复可见。
- **[失去常驻入口的可发现性]** 提问框不再常驻，用户可能找不到。→ 桌面右上角直接平铺带文字的"提问"按钮、移动端显眼 FAB，保证可发现。
- **[行为回归]** 提交/模型选择/匿名登录提示逻辑不应受位置改动影响。→ `QAInput` 业务逻辑零改动，仅调模板布局；按 `qa-input-floating` 现存"Responsive behavior consistency"要求自测移动/桌面提交均正常。

## Migration Plan

1. 新增 `composables/useQAWindow.ts`（开关 + 底部锚定几何 `left/bottom/width`，不读写 localStorage）。
2. 改造 `components/QAInput.vue` 为浮动面板：根 `Card` `v-if="isOpen"`，桌面 `fixed` + 几何、移动端 `inset-0` 全屏；顶行（提交左 / 模型 / 关闭右上）+ 全宽 `Textarea`（`resize-none`）+ 右下角拖动手柄。
3. 新增 `components/PaperActionLauncher.vue`（桌面右上角平铺 + 移动 FAB，功能项数组当前仅"提问"）。
4. 改 `PaperDetail.vue`：移除两处常驻 `QAInput`；header 右侧挂 launcher、页面挂 `<QAInput>`（自身按 `isOpen` 显隐）；在 `openQA` 中按双栏/单栏计算默认 `left/bottom/width` 传入；切换论文/卸载时 `qaWin.close()`。
5. （回退早期方案）删除中途引入的独立窗口组件 `components/QAFloatingWindow.vue`。
6. 更新 `docs/frontend-architecture.md`。
7. 自测：宽屏双栏（默认左下角、宽=左栏、右下手柄可拖动、关闭后重开回默认）、窄屏单栏（下方全宽）、移动端（FAB → 全屏面板）、提交/模型选择正常。

回滚：以上均为前端新增/改动，无数据迁移；如需回滚可还原 `PaperDetail.vue` 与 `QAInput.vue` 并移除新增 composable / launcher。

## Open Questions

- 桌面右上角功能列表是横向一排还是纵向堆叠？（实现时取其一；纵向更利于未来多功能堆叠，横向更省竖直空间。默认按实现观感选择，不影响 spec。）
- 浮窗默认高度的具体取值（双栏/单栏）取一个固定比例还是固定像素？实现时定一个观感合适的默认值即可，spec 不约束具体数值。
