## Context

Paperland 的 Zotero 插件通过嵌入浏览器在侧边栏中加载论文详情页 (`/papers/:id`)。当前页面以完整 UI 呈现（包含桌面侧边栏、移动端导航栏、论文标题 header），在狭窄的 Zotero 面板中显得冗余且浪费空间。同时，Zotero 原生 UI 使用 `#f2f2f2` 背景色，而 Paperland 默认白色背景导致视觉不统一。

当前前端使用 Vue 3 + Vue Router + Tailwind CSS，没有现成的 embed/iframe 模式支持。

## Goals / Non-Goals

**Goals:**
- 通过 URL 查询参数 `embed=1` 激活嵌入模式，隐藏不必要的 UI chrome
- 通过 URL 查询参数 `bg=<hex>` 允许自定义背景色
- 在嵌入模式下提供紧凑的刷新按钮
- 纯前端实现，无后端变更

**Non-Goals:**
- 不修改 Zotero 插件代码（插件侧只需在 URL 上追加参数）
- 不创建独立的嵌入路由或页面组件
- 不改变非嵌入模式下的任何现有行为

## Decisions

### 1. 使用 Vue composable 管理嵌入状态

**决定**：创建 `useEmbedMode()` composable，在应用级别解析 URL 查询参数并提供响应式状态。

**理由**：多个组件（App.vue、PaperDetail.vue）需要读取嵌入状态，composable 提供单一数据源，避免各组件重复解析 URL。

**替代方案**：
- Pinia store：过于重量级，embed 状态是只读的且来自 URL
- 直接在各组件中读 `route.query`：重复逻辑，且 App.vue 在 router-view 外部

### 2. URL 参数格式

**决定**：
- `embed=1` 激活嵌入模式（任何 truthy 值均可）
- `bg=f2f2f2` 指定背景色（6位 hex，不带 `#`）

**理由**：简洁、业界标准。`bg` 不带 `#` 是因为 `#` 在 URL 中是 fragment 标识符，需要编码才能传递。

### 3. 背景色应用方式

**决定**：通过 composable 直接设置 `document.documentElement.style.backgroundColor`，同时设置主内容区的背景色。

**理由**：确保整个页面（包括滚动区域外的空白）都使用统一背景色。CSS 变量方案需要改动太多组件。

### 4. 刷新按钮实现

**决定**：在 embed 模式下，于 PaperDetail.vue 页面顶部添加一个固定的紧凑工具栏（包含刷新按钮），替代被隐藏的论文标题 header。

**理由**：刷新按钮需要始终可见且易于触达。放在原 header 位置最自然，且不占用额外空间。

## Risks / Trade-offs

- **[风险] URL 参数在 Vue Router 导航时可能丢失** → composable 在初始化时从 `window.location.search` 读取并缓存，不依赖路由变化
- **[风险] 背景色参数注入不安全值** → 严格校验 hex 格式（`/^[0-9a-fA-F]{6}$/`），不合法值直接忽略
- **[权衡] 直接操作 DOM style vs CSS 变量** → 选择直接操作，更简单直接，embed 模式下不需要动态切换
