## Why

多用户共享上线后，Q&A、笔记、高亮、参考链接的列表里会显示条目作者，目前显示的是登录用的 `username`。用户希望每个人另外设置一个对外展示的昵称（nickname）：别人在列表里看到的是昵称，登录名不变；昵称允许重复。

## What Changes

- `users` 表新增可空的 `nickname` 列（Drizzle migration）。
- `PATCH /api/auth/me` 支持 `nickname`：去掉首尾空格，最长 32 个字符，传空字符串表示清除。昵称不要求唯一。
- `GET /api/users` 返回 `nickname`；管理员通过 `PATCH /api/users/:id` 可以修改他人的昵称。
- `/api/auth/me`、登录响应等返回的 `SessionUser` 带 `nickname`。
- 所有带作者信息的返回行（free Q&A、笔记、他人笔记、高亮、参考链接）在 `username` 之外新增 `display_name` = `nickname`，没有昵称时用 `username`。
- 前端凡是显示作者的地方一律改为显示 `display_name`：`/notes`、`/qa` feed、User Q&A、参考链接、高亮 tooltip、他人笔记。侧边栏账户菜单也显示自己的 `display_name`。
- AccountDialog 新增“昵称”输入框；Settings 用户管理表格增加昵称列和编辑入口。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities
- `user-accounts`: 数据模型增加 `nickname`；自助更新和管理员 API 支持昵称。
- `data-sharing-preferences`: 作者信息从 `username` 扩展为 `username` + `display_name`，UI 显示 `display_name`。

## Impact

- 后端：`db/schema.ts` 及新 migration、`api/auth.ts`、`api/users.ts`、`auth/session_auth.ts`、`api/qa.ts`、`api/notes.ts`、`api/highlights.ts`、`api/reference_links.ts`，以及相应测试。
- shared：`User`、`SessionUser` 及各类带作者信息的类型。
- 前端：`AccountDialog.vue`、`Settings.vue`、`App.vue`、`NotesPage.vue`、`QAList.vue`、`QAFeedPanel.vue`、`ReferenceLinksSection.vue`、`notes/PublicNotesPanel.vue`、`composables/useHighlight.ts`、`stores/qa.ts`、`api/client.ts`。
- 文档：`docs/tech-stack.md`（users 表）、`docs/frontend-architecture.md`（作者显示）、`docs/external-api.md`（External API 不涉及，确认无需改动）。
- 本次改动的文件和另一个 agent 未提交的 browser-extension 工作有重叠（`schema.ts`、`auth.ts`、`AccountDialog.vue`、migrations）。
