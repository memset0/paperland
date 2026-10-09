## Context

作者信息目前从 `users.username` 读取：`qa.ts` 里的 `loadUsernames`、`notes.ts`/`highlights.ts`/`reference_links.ts` 里 left join `users`。`username` 是唯一的登录名，可以通过 `PATCH /api/auth/me` 修改。

## Goals / Non-Goals

**Goals:** 每个用户有一个可重复、可清空的昵称；凡是向他人展示作者的地方都显示昵称，没有昵称时退回 username。
**Non-Goals:** 不隐藏 `username`（API 仍然返回，管理员页面仍然显示，用于区分同名昵称）；不能用昵称登录；不支持按昵称搜索用户。

## Decisions

### D1. 服务端计算 `display_name`
每一行作者信息都返回 `display_name = nickname ?? username`，前端只需要把显示 `.username` 的地方改成 `.display_name`，避免在多个组件里各写一遍回退逻辑。`username` 保留，以兼容现有调用方和测试。

### D2. 规范化
`nickname.trim()`，结果为空则存 `null`；超过 32 个字符返回 400 `VALIDATION_ERROR`；非字符串（且不是 `null`）返回 400。不检查唯一性。

### D3. 在哪里设置
用户本人在 AccountDialog 里设置。管理员可以在 Settings 用户表里通过同一个 `PATCH /api/users/:id` 修改，方便清理不合适的昵称。

### D4. 搜索
NotesPage 的本地搜索同时匹配 `display_name` 和 `username`。

## Risks / Trade-offs

- [昵称可以重复，列表里可能出现两个同名作者] → 这是用户明确要求的；管理员页面仍然能看到唯一的 username。
- [冒充他人昵称] → 风险较低，属于站内用户之间的问题；管理员可以修改任何人的昵称。
