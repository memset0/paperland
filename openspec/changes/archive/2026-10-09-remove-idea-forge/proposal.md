## Why

Idea Forge（研究想法管理：项目列表、Inbox/Kanban/List 视图、论文 dump 到文件系统）已不再使用，却仍占据侧边栏入口、后端路由、共享类型、依赖（`gray-matter`、`vuedraggable`）和大量文档/规格。作为项目瘦身的第一步，将其从代码库中完整移除，仅保留在 git 历史中。

## What Changes

- **BREAKING** 删除全部 `/api/idea-forge/*` 后端接口（项目列表/创建/配置、想法列表/详情/更新/移动、paper dump），以及后端启动时创建 `data/idea-forge/` 与 demo 项目初始化。
- 删除后端 `src/api/idea-forge.ts`、`src/idea-forge/`（`utils.ts`、`frontmatter.ts`）。
- 删除前端 `/idea-forge`、`/idea-forge/:projectName` 路由、侧边栏 Idea Forge 入口、`views/idea-forge/`、`components/idea-forge/`、`stores/idea-forge.ts`、`stores/ideas.ts`、`lib/idea-categories.ts`。
- 删除 `@paperland/shared` 中 Idea Forge 相关类型（`IdeaCategory`、`IdeaFrontmatter`、`Idea`、`IdeaDetail`、`ProjectConfig`、`IdeaForgeProject`、`DumpPapersRequest`、`DumpPapersResponse` 等）。
- 移除仅被 Idea Forge 使用的依赖：后端 `gray-matter`、前端 `vuedraggable`。
- 从 git 中删除已跟踪的 `data/idea-forge/demo-project/` 示例数据，`.gitignore` 中两条规则合并为单条 `data/idea-forge/` 以继续忽略本地残留数据。
- 清理文档（`docs/frontend-architecture.md`、`docs/tech-stack.md`）、`AGENTS.md` 以及其余代码注释/测试中对 Idea Forge 的引用。
- 顺带清理：删除从未被引用的 shadcn 组件 `components/ui/command/` 与 `components/ui/scroll-area/`（非 Idea Forge 专用，属同一轮瘦身，无运行时行为变化）。
- 删除 `idea-crud`、`idea-forge-frontend`、`workspace-management` 三个主规格；从其他规格中删去 Idea Forge 相关条目。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `idea-crud`: 全部需求移除（想法 CRUD 不再存在）。
- `idea-forge-frontend`: 全部需求移除（Idea Forge 前端页面不再存在）。
- `workspace-management`: 全部需求移除（项目管理、paper dump、目录自动创建、demo 项目不再存在）。
- `responsive-nav`: 侧边栏按钮列表与需登录项中去掉 Idea Forge。
- `page-layout`: 管理页列表与详情页列表中去掉 Idea Forge 项目列表 / Idea 工作区。
- `auth`: 需登录接口列表中去掉 `/api/idea-forge/*`。
- `session-login`: 受限路由列表中去掉 `/idea-forge`、`/idea-forge/:projectName`。
- `page-title`: 去掉 Idea Forge 静态标题与项目名动态标题需求；动态页面仅剩论文详情。
- `tailwind-ui`: 移除 "Idea-forge category mapping centralized" 需求。

## Impact

- **API**：`/api/idea-forge/*` 全部返回 404（破坏性，但功能已弃用、无外部消费者）。External API 不受影响。
- **数据**：服务器本地 `data/idea-forge/` 下未被 git 跟踪的用户项目目录不会被代码删除，也不再被读取；如需清理由用户手动处理。
- **依赖**：`bun.lock` 更新（移除 `gray-matter`、`vuedraggable`）。
- **其他活跃变更**：`add-staged-paper-ingest` 中提及 idea-forge dump 的 `listed` 过滤，该部分随本变更自然失效，不修改那个变更的产物。
