## Context

前端是 Vue 3 + Vue Router 的单页应用，`index.html` 写死 `<title>Paperland</title>`，路由切换时不更新，因此所有页面标签标题都一样。路由定义集中在 `router/index.ts`（命名路由，含两个动态路由 `/papers/:id` 与 `/idea-forge/:projectName`）。项目已依赖 `@vueuse/core`，其 `useTitle` 可响应式管理 `document.title`。本次为纯前端展示层改动，不涉及后端、API、配置或数据库。

## Goals / Non-Goals

**Goals:**
- 每个页面在浏览器标签上显示可区分的标题。
- 静态页面标题与侧边栏导航语义一致。
- 动态页面（论文详情、Idea Forge 项目）标题由内容（论文标题 / 项目名）驱动，并在数据加载后更新。
- 统一标题格式与回退规则，避免散落拼接。

**Non-Goals:**
- 不做 i18n / 多语言标题框架（沿用现有中文 + 既有英文标签如 `Q&A`、`Idea Forge`）。
- 不引入服务端渲染或预渲染来优化首屏标题。
- 不为 Q&A、设置等页面内的局部 tab / 状态生成更细粒度标题（仅到路由页面级）。
- 不新增第三方依赖。

## Decisions

### 决策 1：静态标题用 `route.meta.title` + 全局 `afterEach` 守卫
在 `router/index.ts` 为每个路由的 `meta` 增加 `title` 字段，并注册 `router.afterEach((to) => { document.title = formatTitle(to.meta.title) })`。
- **为何 `afterEach` 而非 `beforeEach`**：标题应反映「已经导航到」的页面，`afterEach` 无需处理 `next()`，最简单且不阻塞导航。
- **为何放在 router 层而非每个组件**：静态标题集中声明，路由即真相来源，新增页面只需加一行 `meta.title`。

### 决策 2：动态标题在视图组件内用响应式 `useTitle`
论文详情、Idea Forge 项目页的标题依赖异步数据，由组件自身用 `@vueuse/core` 的 `useTitle` 绑定一个响应式来源：
- `PaperDetail.vue`：`useTitle(computed(() => store.paper?.title ?? '论文详情'), { titleTemplate: '%s · Paperland' })`，论文加载后标题自动从占位 `论文详情` 切换为真实标题；论文标题被编辑后也会自动同步。
- `IdeaManager.vue`：`useTitle(computed(() => projectName.value), { titleTemplate: '%s · Paperland' })`。
- **为何用 `useTitle` 而非手写 `document.title`**：响应式、随数据变化自动更新，且组件作用域销毁时停止 watcher，无需手动清理。
- **守卫与组件的配合**：导航进入动态路由时，`afterEach` 先用 `meta.title` 占位（论文详情页 meta 设为 `论文详情`，项目页可不设、回退 `Paperland`），组件挂载后 `useTitle` 接管为内容标题；离开该路由时下一页的 `afterEach` 重置标题，组件 watcher 同时停止，不会残留上一页内容标题。

### 决策 3：统一格式 `{标题} · Paperland`
集中一个 `formatTitle(name?: string)` 工具（或 `useTitle` 的 `titleTemplate: '%s · Paperland'`）：有标题输出 `{name} · Paperland`，无标题输出 `Paperland`。守卫与组件共用同一格式来源，保证一致。分隔符选用 `·`（间隔号），比 `-`/`|` 更克制清晰。

### 决策 4：保留 `index.html` 的静态 `<title>Paperland</title>`
作为 JS 执行前的首屏标题与所有回退场景的兜底，不删除。

### 可选：抽取 `composables/usePageTitle.ts`
若 `formatTitle` 在守卫与多个组件间复用，抽成一个小 composable / 纯函数集中管理格式与回退，避免重复字面量 ` · Paperland`。

## Risks / Trade-offs

- [守卫占位标题与组件内容标题之间存在短暂闪烁（先 `论文详情` 后真实标题）] → 占位本身可读且符合预期；通过组件内 `computed` 的 `?? '论文详情'` 回退避免出现裸 `Paperland` 闪现。
- [动态页面 `useTitle` 与全局守卫都会写 `document.title`，存在写入顺序耦合] → 约定：守卫只负责静态/占位，组件 `useTitle` 在挂载后接管；离开路由由目标页守卫统一重置，VueUse 在作用域销毁时停止旧 watcher，避免互相覆盖。
- [新增页面忘记设置 `meta.title`] → 此时回退为 `Paperland`，与现状一致，不会报错；可在 docs 约定中提示新增路由需补 `meta.title`。

## Migration Plan

纯增量前端改动，无数据 / 接口迁移。部署即生效；回滚直接 revert 本次改动，`index.html` 的静态 `<title>` 保证回滚后仍有合理默认标题。

## Open Questions

- 分隔符与品牌词大小写（`· Paperland`）是否需要后续统一为可配置项——当前先硬编码，暂不引入配置。
