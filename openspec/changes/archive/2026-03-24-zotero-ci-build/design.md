## Context

Paperland 包含一个 Zotero 7 插件（`packages/zotero-plugin/`），使用 `zotero-plugin-scaffold` 构建，输出 `.xpi` 文件。目前构建完全依赖本地手动执行，没有 CI/CD 流程。项目已开源在 GitHub，可以利用 GitHub Actions 实现自动化构建。

当前构建方式：
- `cd packages/zotero-plugin && bun run build` → 产出 `.scaffold/build/paperland-for-zotero.xpi`
- 依赖 Bun runtime 和 node_modules

## Goals / Non-Goals

**Goals:**
- 在 push 到 main 分支时，如果 Zotero 插件相关文件或 CI 配置有变更，自动构建 `.xpi`
- 构建产物作为 GitHub Actions artifact 可供下载
- 支持手动触发构建（workflow_dispatch）

**Non-Goals:**
- 不涉及自动发布 GitHub Release（后续可扩展）
- 不涉及插件自动更新机制（update.json 分发）
- 不涉及版本号自动递增
- 不涉及其他包（backend/frontend）的 CI

## Decisions

### 1. 触发条件：path filter + workflow_dispatch

使用 `on.push.paths` 过滤，仅在以下路径有变更时触发：
- `packages/zotero-plugin/**`
- `.github/workflows/build-zotero-plugin.yml`

同时支持 `workflow_dispatch` 手动触发。

**理由**：避免无关提交触发构建，节省 CI 资源。

### 2. 运行环境：ubuntu-latest + oven-sh/setup-bun

使用官方 `oven-sh/setup-bun` action 安装 Bun。

**替代方案**：手动 `curl` 安装 Bun — 不够稳定，版本管理不便。

### 3. 依赖安装：项目根目录 `bun install`

因为是 Bun workspace monorepo，需要从项目根目录安装依赖。构建命令在 `packages/zotero-plugin` 下执行。

### 4. 产物上传：actions/upload-artifact

将 `.xpi` 文件作为 workflow artifact 上传，保留默认 90 天。用户可从 Actions 页面下载。

**理由**：最简单直接的方式，无需额外配置。

## Risks / Trade-offs

- **[Bun 版本兼容]** → 使用 `oven-sh/setup-bun` 并可指定版本，默认 latest 即可
- **[构建产物体积]** → `.xpi` 文件通常很小（< 1MB），不会有存储压力
- **[monorepo 依赖安装慢]** → 可通过 Bun 缓存加速（`oven-sh/setup-bun` 自带缓存支持）
