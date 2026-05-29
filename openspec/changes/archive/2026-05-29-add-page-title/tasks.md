## 1. 标题格式工具

- [x] 1.1 新增 `packages/frontend/src/composables/usePageTitle.ts`，导出 `formatTitle(name?)`（有值返回 `` `${name} · Paperland` ``，无值返回 `Paperland`）与 `usePageTitle(source)`（基于 `@vueuse/core` 的 `useTitle`，响应式地把 `document.title` 绑定到内容来源）

## 2. 路由静态标题

- [x] 2.1 在 `packages/frontend/src/router/index.ts` 为各路由 `meta` 合并 `title`（保留已有 `requiresAuth`/`requiresAdmin`）：`papers`→`论文管理`、`conferences`→`会议`、`tags`→`标签管理`、`qa`→`Q&A`、`idea-forge`→`Idea Forge`、`services`→`服务管理`、`settings`→`设置`；占位：`paper-detail`→`论文详情`、`conference-detail`→`会议详情`、`idea-forge-project`→`Idea Forge`
- [x] 2.2 在 `router/index.ts` 注册 `router.afterEach((to) => { document.title = formatTitle(to.meta.title as string | undefined) })`（置于既有 `beforeEach` 之后）

## 3. 动态页面内容标题

- [x] 3.1 `packages/frontend/src/views/PaperDetail.vue`：`usePageTitle(() => store.currentPaper?.title ?? '论文详情')`，使论文加载后标题切换为论文标题、编辑后同步、加载前显示 `论文详情 · Paperland`
- [x] 3.2 `packages/frontend/src/views/idea-forge/IdeaManager.vue`：`usePageTitle(() => projectName.value)`（置于 `projectName` 定义之后），标题显示为项目名

## 4. 文档

- [x] 4.1 更新 `docs/frontend-architecture.md`「全局导航结构」新增「页面标题（浏览器标签）」小节：路由 `meta.title` 约定、`afterEach` 守卫、动态页面用 `usePageTitle`、`{标题} · Paperland` 格式与回退

## 5. 验证

- [x] 5.1 `vite build` 通过（解析全部 import、转译 TS，新 composable 与各视图均成功打包）。逐页标题的实时浏览器点检未在本次后台会话执行——逻辑已审阅（守卫先于视图执行、`useTitle` 响应式覆盖占位、离开页由目标页守卫重置）：静态页面、论文详情（加载前 `论文详情 · Paperland` → 加载后论文标题）、Idea Forge 项目页（项目名）、会议页（`会议` / `会议详情`），以及从动态页离开到其他页时标题正确重置
