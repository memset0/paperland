## 1. Embed Mode Composable

- [x] 1.1 Create `packages/frontend/src/composables/useEmbedMode.ts` — 解析 URL 查询参数 `embed` 和 `bg`，提供 `isEmbed` (boolean) 和 `bgColor` (string | null) 响应式状态。`bg` 参数须校验为合法 6 位 hex。初始化时从 `window.location.search` 读取并缓存。

## 2. 背景色应用

- [x] 2.1 在 `App.vue` 中引入 `useEmbedMode()`，当 `bgColor` 有值时，设置 `document.documentElement.style.backgroundColor` 为对应颜色

## 3. 隐藏导航 Chrome

- [x] 3.1 在 `App.vue` 中，当 `isEmbed` 为 true 时，隐藏桌面端 52px 图标侧边栏
- [x] 3.2 在 `App.vue` 中，当 `isEmbed` 为 true 时，隐藏移动端顶部导航栏和汉堡菜单
- [x] 3.3 在 `PaperDetail.vue` 中，当 `isEmbed` 为 true 时，隐藏论文标题 header（含返回按钮和标题文字的 h-12 bar）

## 4. 缩小内容边距

- [x] 4.1 在 `PaperDetail.vue` 中，当 `isEmbed` 为 true 且为单栏（narrow）布局时，将内容区 padding 从 `p-5 space-y-5 max-w-3xl mx-auto pb-40` 改为 `p-2 space-y-2`，去掉 max-width 限制和大底部 padding

## 5. 刷新按钮

- [x] 5.1 在 `PaperDetail.vue` 中，当 `isEmbed` 为 true 时，在页面顶部渲染一个紧凑的刷新按钮工具栏，点击执行 `window.location.reload()`

## 6. 文档更新

- [x] 6.1 更新 `docs/frontend-architecture.md`，记录 embed 模式的 URL 参数和行为
