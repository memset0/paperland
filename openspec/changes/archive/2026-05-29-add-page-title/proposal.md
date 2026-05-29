## Why

目前所有页面的浏览器标签标题都固定为 `Paperland`（写死在 `index.html` 的 `<title>`），无法区分。当用户同时打开多个标签页（如论文列表、某篇论文详情、Q&A、设置）时，无法从标签标题判断哪个是哪个，切换体验差。希望每个页面根据其内容显示不同的标题。

## What Changes

- 为前端每个路由定义页面标题，并在路由切换时自动更新浏览器 `document.title`，统一格式为 `{页面标题} · Paperland`（无具体标题时回退为 `Paperland`）。
- 静态页面按导航语义命名（与侧边栏标签一致）：论文管理 / 标签管理 / Q&A / Idea Forge / 服务管理 / 设置。
- **动态页面**根据内容生成标题：
  - 论文详情页（`/papers/:id`）使用论文标题，论文未加载完成时先显示占位（如 `论文详情`），数据到达后更新。
  - Idea Forge 项目页（`/idea-forge/:projectName`）使用项目名。
- `index.html` 的初始 `<title>` 保留为 `Paperland`，作为首屏加载与回退默认值。

## Capabilities

### New Capabilities
- `page-title`: 定义每个前端页面的浏览器标签标题规则——静态路由的固定标题、动态路由（论文详情、Idea Forge 项目）的内容驱动标题、统一的 `{标题} · Paperland` 格式与回退行为，以及路由切换时自动更新 `document.title` 的机制。

### Modified Capabilities
<!-- 无既有 capability 的 spec 级行为发生变化 -->

## Impact

- **Frontend**:
  - `router/index.ts`：为各路由的 `meta` 增加 `title` 字段，并新增 `router.afterEach` 守卫，根据 `to.meta.title` 设置 `document.title`。
  - `views/PaperDetail.vue`：论文数据加载后用论文标题更新页面标题（借助已有依赖 `@vueuse/core` 的 `useTitle`，或直接写 `document.title`）。
  - `views/idea-forge/IdeaManager.vue`：用 `projectName` 设置页面标题。
  - 可选新增轻量 composable（如 `composables/usePageTitle.ts`）统一标题格式化与回退逻辑，避免各处重复拼接 ` · Paperland`。
- **无后端 / API / config / DB 改动**，纯前端展示层变更，无新增依赖（复用已有 `vue-router` 与 `@vueuse/core`）。
- **Docs**: 更新 `docs/frontend-architecture.md`，补充路由 `meta.title` 约定与页面标题规则。
