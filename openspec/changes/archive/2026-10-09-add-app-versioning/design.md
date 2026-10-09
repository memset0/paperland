## Context

没有现成 footer：桌面端是 52px 图标侧栏 + `<main>`，管理页统一套 `AppPage`（`fill` 模式自管滚动），论文详情不套。前端由 Vite 构建，线上由后端托管 `packages/frontend/dist`，构建通常发生在提交之前。

## Goals / Non-Goals

**Goals:**
- 一个由 agent 在归档时维护的版本号，规则写进 `AGENTS.md`。
- 页面上能同时看到版本号与 git hash，用来辨认线上构建。

**Non-Goals:**
- 不做 git tag、CHANGELOG、发布流程。
- 不在后端 API 暴露版本（`/api/health` 不变）。
- 不同步各 workspace package 的 `version`。

## Decisions

- **版本来源 = 根 `package.json` 的 `version`**：根目录本来就有 `package.json` 且无 `version` 字段；放这里 Vite 配置能直接读取，也不必新增文件。备选：单独 `VERSION` 文件——多一个约定，没有收益。
- **注入方式 = Vite `define`**：`vite.config.ts` 启动时读根 `package.json`，并 `execSync('git rev-parse --short HEAD')`（失败回退 `unknown`），定义 `__APP_VERSION__` / `__GIT_HASH__`；在 `src/env.d.ts` 声明类型。dev server 在启动时取一次。
- **hash 语义 = 构建时的 HEAD**：本仓库常在提交前构建，所以 hash 指向构建时已提交的最近 commit，不加 `-dirty`（多 agent 共用工作区，几乎总是 dirty，标记没有信息量）。
- **显示位置 = `AppPage` 底部 + 移动端抽屉底部**：`AppPage` 是所有管理页的统一外壳，加在这里一处即可覆盖；normal 模式跟在内容之后，`fill` 模式作为固定在底部的一行（`shrink-0`）。侧栏只有 52px 宽放不下文字，所以桌面端不放侧栏。抽取成 `AppVersion.vue` 小组件复用。
- **GitHub 链接**：复用侧栏已有的仓库地址 `https://github.com/mem-research/paperland`，链接 `/commit/<hash>`。
- **归档时更新**：`AGENTS.md` 的归档步骤增加「同步 spec 后、提交前更新根 `package.json` 的小版本号（或按规则更新中版本号），并把 `package.json` 纳入归档提交」。同一次提交归档多个 change 只加一次。

## Risks / Trade-offs

- 构建早于提交 → 线上 hash 落后一个 commit。可接受：版本号本身会在归档提交中变化，hash 只用于粗略定位。
- 并发 agent 同时归档可能都改 `package.json` 造成冲突 → 按现有并发提交规则处理，冲突时以较大值为准再 +1。
- 本 change 自身归档时即按新规则把版本从 `2.0.0` 升到 `2.0.1`。
