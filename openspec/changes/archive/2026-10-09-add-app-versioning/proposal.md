## Why

Paperland 目前没有可用的版本号（各 package 都停在 `0.1.0`，无 tag、无 CHANGELOG），线上跑的是哪一版只能靠猜——例如前端产物没重新构建时，页面和代码不一致却无从察觉。需要一个轻量、由 agent 在归档时维护的版本号，并在页面上同时显示版本号和 git hash。

## What Changes

- 根目录 `package.json` 新增 `version`，作为 Paperland 版本号的唯一来源，初始为 `2.0.0`（大版本号当前为 V2）。
- 版本号规则（`MAJOR.MINOR.PATCH`，没有严格语义，只用于辨认更新）：
  - **大版本号**：只有开发者明确要求时才更新。
  - **中版本号**：数据库表发生不兼容变更时必须更新；否则用户要求时也可以更新。更新中版本号时小版本号归零。
  - **小版本号**：每推进至少一个 OpenSpec 归档就更新；由 agent 在归档时更新，开发过程中不同步修改。
- 前端在构建 / 启动 dev server 时注入版本号与当前 `git rev-parse --short HEAD`（取不到时显示 `unknown`）。
- 管理页（`AppPage`）底部新增一行小号 footer：`Paperland v<version> · <hash>`，hash 链接到 GitHub 上对应 commit；移动端抽屉底部同样显示。论文详情等不使用 `AppPage` 的页面不显示。
- `AGENTS.md` 增加「版本号」规则，并把「归档时更新小版本号」加入归档流程；归档提交包含 `package.json`。

## Capabilities

### New Capabilities
- `app-versioning`: Paperland 版本号的来源、更新规则，以及前端 footer 显示版本号和 git hash。

### Modified Capabilities
（无）

## Impact

- `package.json`（根）：新增 `version`。
- `packages/frontend/vite.config.ts`：`define` 注入 `__APP_VERSION__`、`__GIT_HASH__`；`src/env.d.ts`（或等价声明文件）声明全局常量。
- `packages/frontend/src/components/AppPage.vue`、`App.vue`（移动端抽屉）：footer 显示。
- `AGENTS.md`：版本号规则与归档流程。
- `docs/frontend-architecture.md`、`docs/tech-stack.md`：记录版本号来源与注入方式。
- 无后端、数据库、API 变更。
