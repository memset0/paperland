## Why

Paperland 已在 GitHub 开源，项目包含一个 Zotero 插件（`packages/zotero-plugin/`）。目前插件的构建完全依赖本地手动执行 `bun run build`，没有自动化的 CI 流程。用户如果想安装最新版插件，需要开发者手动构建并上传 `.xpi` 文件。通过 GitHub Actions 实现自动构建，可以让每次推送后自动产出可下载的插件包，降低发布摩擦。

## What Changes

- 新增 `.github/workflows/build-zotero-plugin.yml` GitHub Actions 工作流
- 工作流在 `packages/zotero-plugin/` 或 `.github/workflows/build-zotero-plugin.yml` 有变更时自动触发
- 使用 Bun 安装依赖并构建 Zotero 插件，产出 `.xpi` 文件作为 workflow artifact
- 支持手动触发（workflow_dispatch）

## Capabilities

### New Capabilities
- `zotero-ci-build`: GitHub Actions 自动构建 Zotero 插件，条件触发、产物上传

### Modified Capabilities
<!-- 无需修改已有 spec -->

## Impact

- 新增文件：`.github/workflows/build-zotero-plugin.yml`
- 依赖：GitHub Actions 环境需要 Bun runtime
- 不影响现有代码、API 或数据库
