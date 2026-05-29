## Why

Paperland 目前对整站使用浏览器原生 HTTP Basic Auth（且当前 `auth.enabled: false` 实际完全开放），任何访问者都能添加论文、消耗大模型额度、查看并改动他人的自由问答与高亮，存在被滥用的风险。同时所有 free Q&A、论文标签、文本高亮都隐式归属于"唯一用户"，既无法支持多人各自拥有私有数据，也无法在线修改用户名 / 密码。本次引入"公开只读 + 登录后操作"的真正用户系统：未登录者可浏览论文与模板问答，登录后才能添加论文、调用大模型，并拥有各自私有的标签 / 自由问答 / 高亮（及未来的笔记）。

## What Changes

- **BREAKING**：站点 `/api/*` 鉴权从浏览器原生 HTTP Basic Auth 改为**应用内会话登录**（httpOnly cookie + `sessions` 表），以支持"未登录只读 + 登录操作"、在线改密码 / 用户名、以及角色区分。`config.yml` 的 `auth.users` 不再作为凭据来源（用户改存数据库）；`auth.enabled: false` 改为"开发期免登录（请求视为管理员）"。
- 新增 `users` 表与 **admin / user 两种角色**；首次启动若库中无用户则**自动创建 `admin` 用户、生成随机密码并打印到服务器日志一次**。仅实现登录，不实现注册——新用户由管理员添加。密码用 `Bun.password` 哈希存储。
- **数据归属改为按用户隔离**：`free Q&A`、`论文标签（tag for paper）`、`文本高亮` 增加 `user_id` 归属（外键指向 `users.id`——绑定到数据 id 而非用户名，改名 / 改密不影响归属）。**标签完全按用户隔离**（各自的标签名 / 颜色 / 可见性与"论文↔标签"关联，名称唯一性改为按用户）。一次性迁移：把库中已有的标签、自由问答、高亮、API token **全部归属到新建的 admin**。
- **访问分层**：
  - 未登录可见 / 可读：论文列表与详情、模板问答（template Q&A）、PDF / 查看器、健康检查。
  - 登录后才能：添加 / 编辑 / 删除论文、触发任何大模型问答（模板与自由）、创建 / 编辑高亮、标签管理、Q&A 列表（`/qa`）、Idea Forge。
  - 私有只读：自由问答、文本高亮（及未来笔记）只能看见自己的，未登录与他人均不可见。
  - 仅管理员：服务管理（Services Dashboard）、设置（Settings，含 API Token 管理）、用户管理。
- **自助账户**与**管理员用户管理**分离：所有登录用户都可在侧边栏"账户菜单"修改自己的用户名 / 密码、登出；管理员可在设置页新增用户、改角色、重置密码（保护：不能降级最后一个管理员）。**不支持删除用户**。
- **侧边栏**：未登录时仍照常展示全部导航按钮（保持美观），点击受限项时提示"需要登录"并引导登录；登录后展示账户菜单。
- **External API（Zotero 等）**：Bearer Token 增加 `user_id` 归属，token 创建 / 同步的标签等数据归该用户所有；已有 token 迁移归属 admin。
- 前端新增鉴权状态（Pinia store + `GET /api/auth/me`）、登录页 / 弹窗、路由守卫；现有 `api/client.ts` 随同源 cookie 发送会话，并在 401 时引导登录。

## Capabilities

### New Capabilities
- `user-accounts`: 用户身份与角色（admin / user）、管理员的用户新增 / 改角色 / 重置密码（不含删除用户）、所有用户的自助改名 / 改密、首启自动创建随机密码 admin、密码哈希。
- `session-login`: 应用内会话登录机制（httpOnly cookie + `sessions` 表，login / logout / me）、前端鉴权状态与路由守卫与登录弹窗、`auth.enabled:false` 的开发期免登录。
- `data-ownership`: free Q&A / 标签 / 高亮的 `user_id` 归属与"按属主过滤读取"原则、已有数据一次性迁移到 admin、External API Bearer Token 的用户归属与归属式写入。

### Modified Capabilities
- `auth`: 站点 `/api/*` 由 Basic Auth 改为会话登录 + 三级访问分层（公开只读 / 登录 / 仅管理员）；`config.yml` `auth.users` 弃用、`auth.enabled` 改为开发期免登录；External Bearer Token 解析其归属用户。
- `tag-management`: 标签完全按用户隔离——标签管理页与接口需登录、仅操作当前用户的标签、名称唯一性按用户。
- `markdown-highlight`: 高亮按属主隔离——读取仅返回当前用户的高亮、增改删需登录且仅作用于本人、未登录看不到任何高亮。
- `qa-feed-page`: `/qa` 列表需登录且仅展示当前用户的自由问答。
- `qa-display-split`: 论文详情页模板问答公开（未登录可看、不可触发）、自由问答仅属主可见、触发任何问答需登录。
- `responsive-nav`: 侧边栏在未登录时仍展示全部按钮、点击受限项提示登录；新增账户菜单（已登录）/ 登录入口（未登录）。

## Impact

- **Database / schema**：新增 `users`、`sessions` 表；`tags`、`qa_entries`、`highlights`、`api_tokens` 增加 `user_id`；`tags` 唯一约束 `name` → `(user_id, name)`；新增 Drizzle migration + 数据迁移（生成 admin、把存量数据归属 admin）。`papers.tags_json` 全局缓存弃用，改为按当前用户实时计算。
- **Backend**：新增 `auth/session_auth.ts`（会话中间件，解析当前用户并注入 `request.user`）、`api/auth.ts`（login / logout / me / 改密改名）、`api/users.ts`（管理员用户管理）；改造 `index.ts` 的 `onRequest` 鉴权钩子为分层授权；`token_auth.ts` 解析 token 归属用户；`tags` / `qa` / `highlights` / `settings` 路由按 `user_id` 读写与过滤；新增 `@fastify/cookie` 依赖、用 `Bun.password` 哈希；首启 seeding 逻辑。
- **Frontend**：新增 auth Pinia store、登录页 / 弹窗、路由守卫、侧边栏账户菜单与登录提示；`App.vue`、`router/index.ts`、`Settings.vue`（管理员用户管理 + token）、标签 / 高亮 / QA 相关组件按登录态与属主调整展示；`api/client.ts` 处理 401 引导登录。
- **Config / shared**：`config.ts` 的 `authSchema`（`users` 改可选 / 弃用、保留 `enabled`），`packages/shared/src/types.ts` 新增 `User` / `UserRole` / `SessionUser` 等类型并调整 `AuthConfig`。
- **External API**：`api_tokens` 增 `user_id`，token 鉴权注入归属用户；Zotero 标签同步按该用户写入。
- **Docs**：更新 `docs/frontend-architecture.md`（认证章节、侧边栏、标签 / 高亮 / QA 的归属与可见性、设置页用户管理）、`docs/tech-stack.md`（users / sessions 表、cookie 会话、依赖）、`docs/external-api.md`（token 的用户归属）。
