## 1. 后端移除

- [x] 1.1 删除 `packages/backend/src/api/idea-forge.ts` 与 `packages/backend/src/idea-forge/` 目录，并验证文件已不存在
- [x] 1.2 从 `packages/backend/src/index.ts` 移除 `ideaForgeRoutes` 注册、`ensureIdeaForgeRoot()` 调用及其 import，验证文件内无 idea-forge 引用
- [x] 1.3 更新 `packages/backend/src/services/translation_service.ts` 注释与 `packages/backend/src/frontend_hosting.test.ts` 中的 `/idea-forge/project` 深链样例（替换为现存路由），并运行该测试验证通过
- [x] 1.4 `bun remove gray-matter`（backend），验证 `package.json`/`bun.lock` 已更新

## 2. 共享类型

- [x] 2.1 删除 `packages/shared/src/types.ts` 中 Idea Forge 段（`IdeaCategory` … `DumpPapersResponse`），验证全仓无这些类型的引用

## 3. 前端移除

- [x] 3.1 删除 `views/idea-forge/`、`components/idea-forge/`、`stores/idea-forge.ts`、`stores/ideas.ts`、`lib/idea-categories.ts`，验证文件已不存在
- [x] 3.2 从 `router/index.ts` 删除两个 idea-forge 路由及 `Lightbulb` import、更新相关注释；从 `App.vue` 删除侧边栏条目与 `Lightbulb` import；更新 `composables/usePageTitle.ts` 注释
- [x] 3.3 `bun remove vuedraggable`（frontend），验证 `package.json`/`bun.lock` 已更新
- [x] 3.4 运行前端类型检查与构建（`vue-tsc` / `vite build`），验证通过
- [x] 3.5 删除未被引用的 `components/ui/command/` 与 `components/ui/scroll-area/`，同步 `docs/frontend-architecture.md` 组件清单，并重新运行 `vue-tsc` 与 `vite build` 验证通过

## 4. 数据与仓库配置

- [x] 4.1 `git rm -r data/idea-forge/demo-project`，并将 `.gitignore` 中两条 idea-forge 规则合并为 `data/idea-forge/`，验证 `git status` 不出现本地 idea-forge 数据
- [x] 4.2 更新 `AGENTS.md`（`CLAUDE.md` 为其软链）中 detail 页面列表，去掉 `/idea-forge/:projectName`

## 5. 文档

- [x] 5.1 更新 `docs/frontend-architecture.md`：删除 "Idea Forge (研究想法管理)" 章节及导航、标题、布局、权限、响应式、列表过滤、类别映射中的 Idea Forge 提及
- [x] 5.2 更新 `docs/tech-stack.md`：删除目录树中的 idea-forge 条目与 `vuedraggable` 依赖行；确认 `docs/external-api.md` 无需变更

## 6. 全局验证

- [x] 6.1 全仓 grep（排除 `openspec/changes/archive`、node_modules、本变更与其他活跃变更）`idea-forge|IdeaForge|idea_forge|Idea Forge|idea-categories`，验证仅剩预期的 OpenSpec 历史引用
- [x] 6.2 启动后端做冒烟验证：`/api/health` 正常、`/api/idea-forge/projects` 返回 404，且未创建 `packages/backend/data/`
