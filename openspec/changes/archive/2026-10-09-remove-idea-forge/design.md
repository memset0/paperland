## Context

Idea Forge 横跨后端（`api/idea-forge.ts`、`idea-forge/utils.ts`、`idea-forge/frontmatter.ts`，`index.ts` 中的路由注册与 `ensureIdeaForgeRoot()`）、前端（两个路由、侧边栏入口、`views/idea-forge/`、`components/idea-forge/`、两个 store、`lib/idea-categories.ts`）、共享类型、依赖、已跟踪的 demo 数据与多份文档/规格。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**
- 代码库中不再存在任何 Idea Forge 的运行时代码、类型、路由、依赖与文档描述；构建与类型检查通过。

**Non-Goals:**
- 不删除服务器本地未被 git 跟踪的 `data/idea-forge/*` 用户数据（它们不在 git 历史中，删除不可恢复）。
- 不修改其他活跃变更（如 `add-staged-paper-ingest`）的产物。
- 不做其他功能的简化（后续步骤另起变更）。

## Decisions

- **直接删除，不做兼容层**：前端旧链接 `/idea-forge*` 交由路由的兜底行为处理（不新增重定向），后端接口自然 404。功能已弃用，无需迁移路径。
- **`.gitignore` 保留 `data/idea-forge/` 忽略规则**：将原来的 `data/idea-forge/*` + `!data/idea-forge/demo-project/` 两行合并为单条 `data/idea-forge/`。备选是彻底删除规则，但那会让服务器上残留的本地项目数据出现在 `git status` 中，存在被误提交的风险。
- **依赖清理**：`gray-matter` 仅由 `idea-forge/frontmatter.ts` 使用，`vuedraggable` 仅由 `KanbanView.vue` 使用，均通过 `bun remove` 移除并更新 `bun.lock`。`js-yaml` 仍被 `config.ts` 使用，保留。
- **三个整体废弃的主规格**（`idea-crud`、`idea-forge-frontend`、`workspace-management`）：delta 以 REMOVED 列出全部需求；归档同步后若主规格仅剩空壳，则删除这些目录，避免留下空 spec。
- **page-layout 的 "Detail pages keep their own layout"**：OpenSpec 不允许 MODIFIED 丢弃场景，因此以 REMOVED + ADDED（"Paper detail keeps its own layout"）的方式改写，仅保留论文详情部分。

## Risks / Trade-offs

- [遗漏引用导致构建失败] → 删除后全仓 grep `idea-forge|IdeaForge|idea_forge|Idea Forge`，并运行前端 `vue-tsc`/build 与后端类型检查。
- [`frontend_hosting.test.ts` 使用 `/idea-forge/project` 作为 SPA 深链样例] → 改为其他仍存在的深链路径，保持测试意图（SPA fallback）不变。
- [工作区中有其他 agent 的未提交改动，部分文件（`index.ts`、`types.ts`、docs）是共享文件] → 只做最小删除编辑，提交时按路径精确暂存并在报告中列出共享文件。
