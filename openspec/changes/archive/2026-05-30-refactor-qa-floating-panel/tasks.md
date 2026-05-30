## 1. 提问面板状态（useQAWindow）

- [x] 1.1 新增 `packages/frontend/src/composables/useQAWindow.ts`：暴露 `isOpen`、top-left 锚定几何 `left/top/width/height`（导出 `QA_DEFAULT_HEIGHT`）、`open(geometry)`、`close()`，`open` 直接用传入几何覆盖当前值（不读 localStorage、不记忆上次值）。
- [x] 1.2 提供 `setGeometry(partial)` 供拖动/缩放更新内存中的 `left/top/width/height`；关闭时不持久化。

## 2. 浮动面板（合并进 QAInput，单层卡片）

- [x] 2.1 把 `QAInput.vue` 根元素改为浮动 `Card`（`v-if="isOpen"`），桌面端 `position: fixed` + top-left 锚定 `left/top/width/height`（可缩放，默认高约 2 行）。
- [x] 2.2 用 `useMediaQuery('(max-width: 768px)')` 判断移动端：移动端 `inset-0` 全屏、不显示缩放手柄、不拖动；桌面端使用 `useQAWindow` 几何，z-index 取 200（盖住 FAB 与页面）。
- [x] 2.3 面板右下角放**缩放**手柄（对角线内联 SVG，`@pointerdown.stop`，更新 `width/height`）；**移动**改为在卡片空白处拖动（`onCardDown` 用 `closest('button, textarea, a, input, label, [data-qa-resize]')` 排除交互元素，更新 `left/top`）。
- [x] 2.4 删除中途引入的独立窗口组件 `components/QAFloatingWindow.vue`（改为卡片自身即面板，避免双层边框）。

## 3. 功能入口（PaperActionLauncher）

- [x] 3.1 新增 `packages/frontend/src/components/PaperActionLauncher.vue`，渲染调用方按页面功能顺序（引用 → 笔记 → 提问）注入的有序功能项数组（当前仅 `{ key:'ask', label:'提问', icon: Bot, onSelect: openQA }`）。
- [x] 3.2 桌面端（`!isMobile`）：在论文详情页 header 右侧内联直接平铺功能按钮（图标 + 文字），无下拉/菜单；位置避让右侧 `QAPanelNav`。
- [x] 3.3 移动端（`isMobile`）：渲染右下角圆形 FAB；点击切换展开竖直功能列表，点功能项触发 `onSelect` 并收起列表。
- [x] 3.4 功能项选择"提问"时调用 `PaperDetail` 注入的 `openQA`（含默认几何计算）。

## 4. 面板内控件布局

- [x] 4.1 提交按钮置于顶部行**左端**（与模型选择同行），常规尺寸并显示文字 "<Send/> Submit"。
- [x] 4.2 关闭按钮置于顶部行**右端 / 面板右上角**（即原提交按钮位置），点击调用 `close()`。
- [x] 4.3 输入框置于顶部行下方、占满整行宽度，`rows="2"` 默认两行、`flex-1 min-h-0` 随面板增高填充、`resize-none` 去除自身缩放手柄。
- [x] 4.4 确认提交、模型选择、匿名登录提示（含登录态下的关闭按钮）等逻辑不变。

## 5. 接入论文详情页（PaperDetail）

- [x] 5.1 移除宽屏左侧栏底部的常驻 `QAInput`（`<div class="absolute bottom-0 …"><QAInput/></div>`）。
- [x] 5.2 移除窄屏底部的常驻 `<QAInput sticky/>`；保留内容区 `pb-40`（面板打开时浮于底部、覆盖内容，留白便于把末尾内容滚到面板上方）。
- [x] 5.3 在 header 右侧挂 `<PaperActionLauncher :actions="paperActions"/>`，页面挂 `<QAInput :paper-id/>`（按 `isOpen` 自身显隐）；切换论文 / 卸载时 `qaWin.close()`。
- [x] 5.4 实现 `openQA()`：按当前布局计算默认 `left/top/width/height`（高=`QA_DEFAULT_HEIGHT`）并调用 `qaWin.open()` —— 双栏由 `#split-container` 实测 × `leftWidth` 得左栏宽、`top=容器底−height`（贴左下角）；单栏由 `narrowScrollRef` 得内容区全宽（贴底部）；移动端走全屏分支。

## 6. 文档与自测

- [x] 6.1 更新 `docs/frontend-architecture.md` 中提问框/详情页布局相关描述（常驻 → 按需单层浮动面板 + 功能入口）。
- [x] 6.2 静态校验：`vue-tsc --noEmit` 全前端 0 错误（含本次改动）。
- [x] 6.3 交互自测（用户本地逐轮实时确认）：宽屏双栏（默认左下角、右下手柄缩放、拖空白处移动、关闭后重开回默认）、textarea 默认 2 行、默认尺寸/内边距按反馈微调到位；提交/模型选择/登录提示一致、`QAPanelNav` 与 launcher 不冲突。
