## 1. 依赖与共享类型

- [x] 1.1 在 backend 增加 `@fastify/cookie` 依赖（`bun add @fastify/cookie --filter @paperland/backend`，或在 backend `package.json` 后 `bun install`），并在 `index.ts` `app.register(cookie)`
- [x] 1.2 `packages/shared/src/types.ts` 新增 `UserRole = 'admin' | 'user'`、`User { id, username, role, created_at }`、`SessionUser`（`{ id, username, role }`）；`ApiToken` 增 `user_id`；调整 `AuthConfig`（`users` 改 `AuthUser[] | undefined`，保留 `enabled`）
- [x] 1.3 `packages/backend/src/config.ts` 的 `authSchema`：`users` 改 `.optional()`（弃用但兼容解析）、`enabled` 保持 `default(true)`，移除"enabled 时 users 必填"的 `.refine`（凭据不再来自 config）

## 2. 数据库 schema、迁移与 seeding

- [x] 2.1 `db/schema.ts` 新增 `users` 表：`id`(PK autoinc)、`username`(text unique notNull)、`password_hash`(text notNull)、`role`(text notNull default 'user')、`created_at`(text notNull)
- [x] 2.2 `db/schema.ts` 新增 `sessions` 表：`id`(text PK，随机 token)、`user_id`(integer notNull → users.id)、`created_at`(text notNull)、`expires_at`(text notNull)
- [x] 2.3 `db/schema.ts`：`tags` 增 `user_id`(integer → users.id)，唯一约束由 `name` 改为 `(user_id, name)`；`qa_entries` 增 `user_id`(integer，可空 → users.id)；`highlights` 增 `user_id`(integer → users.id)；`api_tokens` 增 `user_id`(integer → users.id)
- [x] 2.4 生成迁移：`cd packages/backend && bunx drizzle-kit generate`，检查生成 SQL（SQLite 改 tags 唯一约束会重建表，确认数据保留与列默认值）
- [x] 2.5 `db/index.ts`：`migrate()` 后做 seeding——若 `users` 表为空，用 `randomBytes` 生成强随机密码 → `await Bun.password.hash(pw)` → 插入 `admin`(role='admin') → `console.log` 醒目横幅打印明文密码一次；记录 `adminId`
- [x] 2.6 `db/index.ts`：紧接 seeding 后回填（沿用现有 tags_json 回填范式）——`tags`/`highlights`/`api_tokens` 及 `qa_entries WHERE type='free'` 中 `user_id IS NULL` 的行 `UPDATE` 为 `adminId`；`template` 条目保持 `user_id` NULL
- [x] 2.7 停用 `papers.tags_json` 全局缓存写入：移除 `utils/tags-json-sync.ts` 在 tags/external-api 路由中的调用（列保留，不再作为标签展示来源）

## 3. 后端身份解析与授权基建

- [x] 3.1 新增 `auth/session_auth.ts`：`resolveSessionUser(request)` 读 `paperland_session` cookie → 查 `sessions`（过期则视为无效并可清理）→ 取 `users` → 返回 `SessionUser | null`；导出 `createSession(userId)`（写行 + 返回 token，默认 30 天过期）、`destroySession(token)`
- [x] 3.2 改 `auth/token_auth.ts`：token 命中后查其 `user_id` 对应 `users` 行并注入 `request.user`；无效/撤销返回 401
- [x] 3.3 新增授权守卫（`auth/guards.ts`）：`requireUser`（无 `request.user` → 401）、`requireAdmin`（无 → 401；非 admin → 403），均为 `preHandler`
- [x] 3.4 改 `index.ts` 的 `onRequest` 钩子：`/api/health` 放行；`/external-api/*` → `tokenAuth`；`/api/*` → 若 `auth.enabled===false` 注入合成 admin，否则 `request.user = resolveSessionUser()`（可能为 null，**此处不 401**，授权交给各路由守卫）
- [x] 3.5 Fastify 类型扩展（声明合并 `FastifyRequest { user?: SessionUser }`）
- [x] 3.6 `index.ts` 启动 warning 措辞改为"开发期免登录——所有 API 以 admin 身份开放访问"

## 4. 后端 auth / account / user API

- [x] 4.1 新增 `api/auth.ts`：`POST /api/auth/login`（公开）——校验用户名/密码（`Bun.password.verify`）、`createSession`、`Set-Cookie`（HttpOnly/SameSite=Lax/Path=/），失败 401 且不区分用户名/密码
- [x] 4.2 `POST /api/auth/logout`（`requireUser`）——`destroySession` + 清 cookie
- [x] 4.3 `GET /api/auth/me`（公开）——返回 `{ user: SessionUser | null }`，匿名不 401
- [x] 4.4 `PATCH /api/auth/me`（`requireUser`）——改 `username`（查重 409）/ 改 `password`（需 `current_password` 校验，错误则拒绝）
- [x] 4.5 新增 `api/users.ts`（全部 `requireAdmin`）：`GET /api/users`（列表，无密码）、`POST /api/users`（建用户，含初始密码+角色）、`PATCH /api/users/:id`（改角色或重置密码）；降级前校验**不能降级最后一个 admin**；**不提供删除用户接口**（无 `DELETE /api/users/:id`）
- [x] 4.6 `index.ts` 注册 `authRoutes`、`userRoutes`

## 5. 后端数据归属落地（读写过滤 + 守卫）

- [x] 5.1 `api/highlights.ts`：`GET` 按 `request.user?.id` 过滤（匿名返回空数组、200）；`POST`/`PUT`/`DELETE` 加 `requireUser`、写入落 `user_id`、改删前校验属主（非属主 404）
- [x] 5.2 `api/qa.ts`：`GET /api/papers/:id/qa`——template 全量 + free 仅 `request.user?.id`（匿名只给 template）；`GET /api/qa/free` 加 `requireUser` + 按 user 过滤；`POST .../qa/free` 落 `user_id`；所有 template/free 触发、`POST /api/qa/:entryId/regenerate`、`DELETE /api/qa/results/:resultId` 加 `requireUser`，free 相关校验属主
- [x] 5.3 `api/tags.ts`：全部加 `requireUser`，查询/改名/改色/合并/删除/可见性按 `user_id` 过滤与写入；唯一性按 `(user_id,name)`；删除/合并去除 tags_json 同步、改为刷新该用户标签展示；跨用户 tag 返回 404
- [x] 5.4 `api/papers.ts`：`GET` 列表/详情保持公开；标签字段改为按 `request.user?.id` JOIN `paper_tags`→`tags` 计算（匿名为空）；`POST`/`PATCH`/`DELETE` 与 `PUT /api/papers/:id/tags` 加 `requireUser`；`PUT tags` 按 `user_id` 增删（仅动当前用户的关联）；`GET /api/papers/:id/tags` 按当前用户（匿名空）
- [x] 5.5 `api/services.ts`：`/api/papers/:id/services` 与 `.../services/trigger`、`.../services/:serviceName/trigger` 加 `requireUser`；全局 `GET /api/services`、`GET /api/services/executions` 加 `requireAdmin`
- [x] 5.6 `api/settings.ts`：token 三个接口加 `requireAdmin`；签发时写 `user_id`（默认签发的 admin，预留可选指定）；列表附带归属用户
- [x] 5.7 `api/idea-forge.ts`：所有路由加 `requireUser`
- [x] 5.8 `external-api/tags.ts`（及 `external-api/papers.ts` 涉及标签处）：标签创建/查找/增删改用 `request.user.id`（token 归属用户）作用域
- [x] 5.9 `GET /api/config/models` 加 `requireUser`；`GET /api/templates` 保持公开（模板问答需匿名可见）

## 6. 前端鉴权状态与登录 UI

- [x] 6.1 新增 `stores/auth.ts`：state `{ user, loaded }`；getters `isAuthenticated`/`isAdmin`；actions `fetchMe()`/`login()`/`logout()`/`updateAccount()`
- [x] 6.2 `api/client.ts` 新增 `authApi`（login/logout/me/updateAccount）与 `usersApi`（list/create/update/delete）
- [x] 6.3 `api/client.ts`：`fetch` 显式 `credentials: 'same-origin'`；响应 `401` 时经 error-bus 触发"需要登录"事件（新增事件类型）并打开登录弹窗，而非裸 toast
- [x] 6.4 新增 `components/LoginDialog.vue`（用户名/密码、提交、错误提示）；在 `App.vue` 根挂载，由 store/全局事件控制开合
- [x] 6.5 `main.ts` 或 `App.vue` `onMounted`：启动调用 `authStore.fetchMe()`（失败静默为匿名）

## 7. 前端路由守卫、侧边栏与账户菜单

- [x] 7.1 `router/index.ts`：给 `/tags`、`/qa`、`/idea-forge`、`/idea-forge/:projectName` 标 `meta.requiresAuth`，给 `/services`、`/settings` 标 `meta.requiresAdmin`；`router.beforeEach` 守卫——未登录打开登录弹窗并阻止导航、非 admin 访问 admin 项提示无权限
- [x] 7.2 `App.vue` 侧边栏（桌面 + 移动 drawer）：保留全部 `navItems` 渲染；受限项点击拦截——匿名 → 登录弹窗、非 admin admin 项 → 无权限提示（用 store 状态判断，不静默跳转）
- [x] 7.3 `App.vue`：底部账户区——登录态显示账户菜单（用户名 + 改名改密 + 登出），未登录显示登录入口（替换/补充现有 GitHub 图标区）
- [x] 7.4 新增账户设置 UI（弹窗或菜单内）：改用户名、改密码（需当前密码），调用 `authStore.updateAccount()`

## 8. 前端归属感知展示

- [x] 8.1 `views/PaperList.vue` / `views/PaperDetail.vue`：标签按当前用户展示（匿名不显示标签、不显示标签筛选）；匿名隐藏添加论文/编辑/删除等写操作入口或改为登录提示
- [x] 8.2 `components/QAList.vue`/`QAResultView.vue`/`QAInput.vue`：匿名隐藏 Free Q&A 卡片与提问框、模板问答的生成/重生成控件改为登录提示；template 问答结果对匿名正常展示
- [x] 8.3 `components/MarkdownContent.vue`：匿名不加载/不渲染高亮、选中文本不弹高亮工具（或弹"需登录"）；登录用户照旧
- [x] 8.4 校验 `QAPage.vue`(/qa)、`TagManagement.vue`(/tags)、idea-forge 页、`ServiceDashboard.vue`、`Settings.vue` 在守卫下仅授权用户可达，匿名/越权时呈现登录或无权限态

## 9. 管理员用户管理 UI

- [x] 9.1 `views/Settings.vue`（仅 admin 可达）：新增"用户管理"区块——用户列表、新建用户（用户名/初始密码/角色）、改角色、重置密码（**不提供删除用户**；最后一个 admin 禁止降级并提示）；保留 token 管理区块

## 10. 文档

- [x] 10.1 `docs/frontend-architecture.md`：重写"认证"章节（会话登录取代 Basic Auth、三级访问分层矩阵、侧边栏登录提示与账户菜单、设置页用户管理）；在标签/高亮/Q&A 章节补充"按用户归属与可见性"
- [x] 10.2 `docs/tech-stack.md`：新增 `users`/`sessions` 表与各表 `user_id` 列、cookie 会话、`@fastify/cookie`、`Bun.password` 哈希、`config.yml` auth 段语义变更（`users` 弃用、`enabled` 改为开发期免登录）
- [x] 10.3 `docs/external-api.md`：补充 Bearer Token 的用户归属（token 创建/同步的标签归该用户）
- [x] 10.4 `config.yml` 与 `config.example.yml`：更新 `auth` 段注释（`enabled` 语义、`users` 弃用、首启请到服务器日志获取 admin 初始密码）

## 11. 验证

- [x] 11.1 从项目根 `bun run packages/backend/src/index.ts` 启动：确认日志打印 admin 随机密码横幅、`users`/`sessions` 表与各 `user_id` 列就位、`packages/backend/data/` 未被误创建
- [x] 11.2 匿名场景：可读论文列表/详情/模板问答/PDF；`POST /api/papers`、`/api/papers/:id/qa/free`、`/api/highlights`、`/api/tags`、`/api/qa/free`、idea-forge、`/api/services`、`/api/users` 均按矩阵返回 401/403；前端受限项点击弹登录
- [x] 11.3 普通用户：登录后可加论文/提问/建标签/建高亮且只见自己的；`/services`、`/settings`、`/api/users` 被 403/守卫拦截
- [x] 11.4 admin：可进服务管理/设置、新增/改角色/重置密码；验证"不能降级最后一个 admin"（确认无删除用户入口与接口）
- [x] 11.5 改用户名后其名下标签/free-QA/高亮仍归属本人（外键 `users.id`）；改密码需正确 `current_password`；登出后回到匿名只读
- [x] 11.6 External API：用某用户的 token 同步/创建标签，确认归该用户；另一用户登录后看不到这些标签
- [x] 11.7 仅运行本次涉及的后端单测（如新增 `auth`/`session`/`users` 测试则运行之）；**不要盲跑全部测试**（部分会调用真实外部 API 产生费用）
