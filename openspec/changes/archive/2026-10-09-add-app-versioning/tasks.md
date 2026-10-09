## 1. Version source and injection

- [x] 1.1 根 `package.json` 新增 `"version": "2.0.0"`
- [x] 1.2 `packages/frontend/vite.config.ts` 读取根版本与 `git rev-parse --short HEAD`（失败为 `unknown`），通过 `define` 注入 `__APP_VERSION__`、`__GIT_HASH__`；`src/env.d.ts` 声明类型

## 2. Footer

- [x] 2.1 新增 `components/AppVersion.vue`：`Paperland v<version> · <hash>`，hash 链接 GitHub commit（`unknown` 时无链接）
- [x] 2.2 `AppPage.vue` normal / fill 两种模式底部显示 `AppVersion`
- [x] 2.3 `App.vue` 移动端抽屉底部显示 `AppVersion`

## 3. Rules and docs

- [x] 3.1 `AGENTS.md` 增加版本号规则，并在归档流程中加入「归档时更新版本号、提交包含 `package.json`」
- [x] 3.2 更新 `docs/frontend-architecture.md`、`docs/tech-stack.md`（`docs/external-api.md` 无 API 变化，确认无需修改）

## 4. Verify

- [x] 4.1 前端类型检查、构建通过，构建产物中含当前版本与 hash；浏览器确认 normal / fill 页面与移动端抽屉显示正确
