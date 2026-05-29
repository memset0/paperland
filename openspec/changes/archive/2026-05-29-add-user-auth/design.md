## Context

当前鉴权（`index.ts` 的 `onRequest` 钩子 + `auth/basic_auth.ts`）：`/api/*` 走 HTTP Basic Auth（凭据来自 `config.yml` 的 `auth.users`，明文比对），`/external-api/*` 走 Bearer Token（`api_tokens` 表），`/api/health` 放行。`auth.enabled:false` 时整站 `/api/*` 完全放行（当前 config 即为 `false`）。前端 `api/client.ts` 不带任何鉴权头，依赖浏览器原生 Basic Auth 弹窗。

数据层（`db/schema.ts`）现状：`tags`（`name` 全局唯一、`color`、`visible`）、`paper_tags`（`paper_id`+`tag_id` 复合主键）、`papers.tags_json`（冗余缓存 `[{id,name}]`，由 `utils/tags-json-sync.ts` 同步，供列表页免 JOIN 渲染）、`qa_entries`（`type` 为 `template|free`）、`highlights`、`api_tokens` 均**无属主字段**。标签还会被 External API（Zotero 同步，`external-api/tags.ts`）按名字创建 / 增删。Idea Forge 为文件存储、与用户无关。

约束：Bun 运行时（可用 `Bun.password` 与 `bun:sqlite`）；Drizzle + bun-sqlite，迁移在 `db/index.ts` 启动时 `migrate()` 自动跑；全站 snake_case；所有流量经 Vite（:5173）同源代理到后端（:3000）。

需求要点（已与用户确认）：公开只读论文 + 模板问答；登录后才能写 / 调用大模型；free Q&A / 标签 / 高亮**按用户私有**（标签**完全按用户隔离**）；用户分 admin / user，admin 管理用户；Services 与 Settings **仅 admin**；笔记**本次只打基础不实现**；侧边栏对未登录者照常显示按钮、点击提示登录；首启自动建 admin 并随机生成密码。

## Goals / Non-Goals

**Goals:**
- 用应用内会话登录（httpOnly cookie）取代浏览器 Basic Auth，支持"未登录只读 + 登录操作 + 在线改名 / 改密 + 角色"。
- 引入 `users` / `sessions` 表与 admin / user 角色；首启自动建 admin（随机密码、日志打印一次）；仅登录、不注册，用户由 admin 添加。
- 给 free Q&A / 标签 / 高亮加 `user_id` 归属（外键 `users.id`），并把存量数据迁移给 admin；归属模型可复用于未来笔记。
- 落地三级访问分层（公开只读 / 登录 / 仅 admin）与属主过滤读取。
- External API Bearer Token 携带归属用户，token 创建 / 同步的标签等归该用户。
- 前端：登录态、路由守卫、登录弹窗、侧边栏登录提示与账户菜单、admin 用户管理 UI。

**Non-Goals:**
- 不做用户自助注册、不做找回密码 / 邮件、不做 OAuth / SSO。
- 不实现笔记功能（仅保证归属模型可扩展）。
- 不让 Idea Forge 按用户隔离（仅"需登录"，登录用户间共享）。
- 不改 Q&A / 服务调度 / PDF 解析等业务逻辑，仅加归属与授权。
- 不引入会话 Redis / 分布式会话（单机 SQLite 足够）。

## Decisions

### D1. 会话登录用 httpOnly cookie + `sessions` 表，取代 Basic Auth
新增 `sessions(id TEXT PK, user_id, created_at, expires_at)`，`id` 为 32 字节随机不透明 token；登录成功后写一行并 `Set-Cookie: paperland_session=<id>; HttpOnly; SameSite=Lax; Path=/`（默认 30 天过期）。每次请求用 `@fastify/cookie` 读 cookie → 查 `sessions` → 取 `users` → 注入 `request.user`；过期则视为未登录并清理。登出删除该 session 行并清 cookie。
- **为何**：Basic Auth 是"全有或全无"且浏览器弹窗，无法表达"未登录只读"、无法登出、无法改密、无法把角色暴露给前端——与本需求根本冲突。会话表支持登出 / 过期 / 撤销。
- **备选**：① 无状态 JWT（驳回：撤销 / 登出难，需黑名单又回到有状态）；② token 存 localStorage + `Authorization: Bearer`（驳回：易受 XSS 窃取；httpOnly cookie 更安全，且同源代理下 cookie 自动随请求发送，前端零改动）。
- **依赖**：新增 `@fastify/cookie`（Fastify 官方小插件）；密码哈希用内置 `Bun.password`（argon2id），不引第三方。

### D2. `users` 表与角色；首启 seeding 随机密码 admin
`users(id PK autoinc, username TEXT UNIQUE, password_hash TEXT, role TEXT 'admin'|'user', created_at)`。启动 `migrate()` 后若 `users` 为空：用 `randomBytes` 生成强随机密码 → `Bun.password.hash` → 插入 `admin`（role=admin）→ 在日志打印醒目横幅展示明文密码**一次**（仅此一次，之后只能改密）。
- **为何**：用户要求"追加 admin 并生成随机密码""不实现注册、用户由 admin 添加"。seeding 与 `auth.enabled` 无关——总是保证至少有一个 admin，便于随时启用登录。
- **备选**：从 `config.yml` `auth.users` 迁移明文账户（驳回：用户明确要随机密码；且明文进库不安全）。`auth.users` 自此**弃用**（schema 改可选、忽略，仅保留兼容不报错）。

### D3. 身份解析（全局钩子）与授权（按路由守卫）分离
`onRequest` 钩子只负责**解析身份**：`/external-api/*` → `tokenAuth` 解析 token 及其 `user_id`（无效 token 直接 401）；`/api/*` → 若 `auth.enabled:false` 则注入"合成 admin"（开发期免登录），否则解析 session 得 `request.user` 或 `null`（**此处不 401**）。**授权**由各路由的 `preHandler` 小守卫 `requireUser` / `requireAdmin` 强制；公开只读路由无守卫；属主过滤在 handler 内用 `request.user.id` 完成。
- **为何**：访问分层是"按路由组"的，集中在一个大钩子里做 URL 前缀判断会很脆。身份解析全局做一次、授权在路由处显式声明，既清晰又好测。
- **访问矩阵**（路由组 → 层级）：

  | 层级 | 路由（组） |
  |---|---|
  | 公开（无需登录） | `GET /api/health`、`GET /api/papers`、`GET /api/papers/:id`、`GET /api/templates`、`GET /api/files/*`、`POST /api/auth/login`、`GET /api/auth/me`（返回 user 或 null） |
  | 公开但属主过滤（匿名返回空，不 401） | `GET /api/papers/:id/qa`（template 全返回 + free 仅本人）、`GET /api/highlights`（仅本人）、`GET /api/papers/:id/tags`（仅本人） |
  | 需登录（`requireUser`） | 论文增改删与 `PUT …/tags`；所有 QA 触发 / 重生成 / 删除（`/api/papers/:id/qa/*`、`/api/qa/*`）；高亮增改删；标签管理（`/api/tags*`）；`GET /api/qa/free`；`GET /api/config/models`；`/api/idea-forge/*`；per-paper 服务状态 / 触发（`/api/papers/:id/services*`）；`POST /api/auth/logout`、`PATCH /api/auth/me` |
  | 仅 admin（`requireAdmin`） | 全局服务面板 `GET /api/services`、`GET /api/services/executions`；设置 token `/api/settings/tokens*`；用户管理 `/api/users*` |
  | External（Bearer token，归属用户） | `/external-api/*` |

### D4. 数据归属：外键到 `users.id`，按属主过滤；标签完全按用户隔离
给 `tags`、`qa_entries`、`highlights` 加 `user_id`（FK `users.id`）。读：属主过滤的 GET 仅返回 `user_id = request.user.id` 的行，匿名返回空。写：`requireUser` 后写入时落 `user_id = request.user.id`。
- **标签按用户隔离**：唯一约束由 `name` 改为 **`(user_id, name)`**（两个用户可各有同名标签）；`paper_tags` **不**单独加 `user_id`（属主由 `tag_id → tags.user_id` 推导，避免冗余不一致）；标签的增删改 / 合并 / 可见性 / 颜色全部限定在当前用户的标签集内。
- **`papers.tags_json` 弃用**：该全局缓存无法表达"按用户的标签"。改为论文列表 / 详情按当前用户 JOIN `paper_tags`→`tags` 实时取标签（个人库规模下成本可忽略）；停止读写 `tags_json` 与 `utils/tags-json-sync.ts`（列保留不删，避免破坏式迁移）。匿名用户列表页论文不显示任何标签。
- **`qa_entries.user_id` 可空**：`template` 条目是**公开共享**的（任何人可看、登录才可触发 / 重生成），其 `user_id` 置空；`free` 条目必填属主。`GET /api/papers/:id/qa` 据此组装：template 全量 + free 仅本人。
- **为何**：用户明确把 free-QA / tag / 高亮列为按用户私有，并要求"绑定到数据 id"（故外键指向不可变的 `users.id` 而非可变的 username）。
- **备选**：`paper_tags` 也加 `user_id`（驳回：与 `tags.user_id` 冗余）；保留 `tags_json` 改为按用户的 JSON 表（驳回：过度设计，JOIN 已够）。

### D5. External API Bearer Token 携带归属用户
`api_tokens` 加 `user_id`（FK `users.id`）。`tokenAuth` 解析 token 后注入 `request.user`＝该 token 的归属用户；`external-api/tags.ts` 等按 `request.user.id` 创建 / 查找 / 增删标签。admin 在设置页签发 token 时可选归属用户（默认签发者自己）。存量 token 迁移归属 admin。
- **为何**：标签变成按用户私有后，Zotero / 外部客户端写入的标签必须有明确属主，否则无法归类与隔离。
- **备选**：External API 一律归 admin（驳回：多用户用各自 token 同步时会串数据）。

### D6. 自助账户 与 管理员用户管理 分离
Settings 页**仅 admin**（含 token 管理、用户管理、config 只读），但**改用户名 / 密码是所有登录用户的刚需**。故拆分：
- **自助账户**（任意登录用户）：侧边栏底部"账户菜单"——显示用户名、`改用户名 / 改密码`（`PATCH /api/auth/me`，改密需校验当前密码）、`登出`。
- **管理员用户管理**（仅 admin，设置页内）：`GET/POST/PATCH /api/users`——新建用户（设初始密码）、改角色、重置密码。**保护**：不能降级**最后一个 admin**。**不支持删除用户**（无 DELETE 接口）。
- **为何**：既满足"Settings 仅 admin"，又满足"用户需支持改密码 / 用户名"。

### D7. 前端鉴权状态、路由守卫、侧边栏与 401 处理
- 新增 `stores/auth.ts`：启动调 `GET /api/auth/me` 拿 `{ user|null }`；暴露 `isAuthenticated` / `isAdmin` / `login()` / `logout()` / `updateAccount()`。
- 路由守卫：受限路由（`/tags`、`/qa`、`/idea-forge*`、`/services`、`/settings`）在 `beforeEach` 校验登录 / 角色，未满足则弹登录或提示无权限（不静默 404）。
- 侧边栏（`App.vue`）：未登录**照常渲染全部按钮**；点击受限项不跳转而是弹"需要登录"提示并打开登录弹窗（admin-only 项对普通用户提示无权限）。新增登录弹窗组件与账户菜单。
- `api/client.ts`：保持同源 `fetch`（cookie 自动随发，加 `credentials:'same-origin'` 显式声明）；遇 `401` 时经 error-bus 触发"需要登录"并打开登录弹窗，避免裸报错。
- **为何**：满足"侧边栏美观、未登录仍显示按钮、点击提示登录"，并让公开页（论文 / 模板问答）对匿名用户正常渲染。

### D8. `auth.enabled` 语义改为"开发期免登录"
`auth.enabled:false`（当前 config 值）＝开发期免登录：`onRequest` 注入合成 admin，所有功能可用、无需登录（等价当前完全开放，但归属仍生效＝都归 admin）。`auth.enabled:true`＝启用上述会话登录 + 分层。两种模式都会 seeding admin。
- **为何**：保留既有本地开发逃生口，零摩擦切换。文档提示生产应设 `true`。

### D9. 迁移与 seeding 顺序（启动时）
沿用 `db/index.ts` 现有"`migrate()` 后跑数据回填"的范式：
1. Drizzle 结构迁移：建 `users` / `sessions`；给 `tags` / `qa_entries` / `highlights` / `api_tokens` 加 `user_id`（**可空**入库）；`tags` 唯一约束 `name`→`(user_id,name)`（SQLite 由 drizzle-kit 重建表完成）。
2. seeding：若 `users` 为空 → 建随机密码 admin、日志打印明文一次 → 记其 `id`。
3. 回填：把 `tags` / `highlights` / `api_tokens` 及 `qa_entries`（仅 `type='free'`）中 `user_id IS NULL` 的行 `UPDATE` 为 admin.id；`template` 条目保持 `user_id` 为空。
- **为何**：结构迁移是纯 SQL、与数据无关；回填需要 seeded admin 的 id，必须在代码里 seeding 之后做（与既有 `tags_json` 回填同一处）。

## Risks / Trade-offs

- **会话 cookie 经 Vite 代理** → 个别环境 `Set-Cookie` 不被转发 / 域不匹配。Mitigation：不设 `Domain`（默认绑定当前 host）、`SameSite=Lax`、`Path=/`；同源代理下验证可达；必要时文档说明反代需透传 cookie。
- **明文密码仅日志打印一次** → 用户错过即需手动重置。Mitigation：醒目横幅 + 文档写明"首启请到日志取 admin 初始密码"；admin 可随时重置任意用户密码。
- **标签去全局化的连带面** → `tags_json` 列表渲染、tag 过滤、External tag 同步、Zotero 批量同步全部受影响。Mitigation：统一切到"按当前用户 JOIN 取标签"；`tags_json` 仅停用不删列；External 走 token 归属用户；本次专门改这些读写点并加测试。
- **`auth.enabled:false` 误上生产** → 整站等于开放。Mitigation：`false` 时启动打印明确警告（沿用现有 warning，措辞改为"开发期免登录"）；文档强调生产置 `true`。
- **匿名读属主数据返回空 vs 401 的一致性** → 前端需区分"未登录看不到"与"真出错"。Mitigation：属主 GET 一律 200 + 空集，仅写操作 401；前端公开页据空集正常渲染。
- **现存 free QA / 高亮 / 标签全部归 admin** → 若实际由多人产生，登录后非 admin 用户看不到旧数据。Mitigation：单用户历史场景下符合预期；admin 可见全部存量；属于一次性迁移、可接受。
- **会话过期 / 多设备** → 体验中断。Mitigation：30 天有效期；`sessions` 表天然支持多端并存与逐个登出；过期请求按未登录处理并提示重新登录。

## Migration Plan

1. **依赖**：根目录加 `@fastify/cookie`（`bun add` 到 backend）。
2. **schema + 迁移**：改 `db/schema.ts`（新表 + `user_id` + 唯一约束）→ `cd packages/backend && bunx drizzle-kit generate` 生成迁移；`db/index.ts` 增 seeding + 回填（D9）。
3. **后端鉴权**：新增 `auth/session_auth.ts`、`api/auth.ts`、`api/users.ts`、守卫 `requireUser`/`requireAdmin`；改 `index.ts` 钩子；`token_auth.ts` 注入归属用户；`tags`/`qa`/`highlights`/`settings`/`external-api/tags` 按 `user_id` 改造。
4. **shared / config**：`types.ts` 增 `User`/`UserRole`/`SessionUser` 并调整 `AuthConfig`；`config.ts` `authSchema` 的 `users` 改可选。
5. **前端**：`stores/auth.ts`、登录弹窗 / 账户菜单、路由守卫、`App.vue` 侧边栏、`Settings.vue` 用户管理、`client.ts` 401 处理，及标签 / 高亮 / QA 组件按登录态调整。
6. **docs**：更新三份文档（见 proposal Impact）。
7. **config.yml**：保持 `auth.enabled` 字段（开发先 `false`，验证登录时切 `true`）。

**回滚**：还原 onRequest 为 Basic Auth、移除新路由与守卫、前端去掉登录态与守卫即可；`user_id` 列与新表保留无害（不阻塞旧逻辑）。

## Open Questions

- 会话有效期（默认 30 天）与"记住我"是否需要可配？暂定固定 30 天，后续按需加 config。
- 是否需要"登出所有设备"/ 会话列表管理？本次不做，`sessions` 表已为之留有空间。
- 本次**不支持删除用户**（仅新增 / 改角色 / 重置密码）。若未来需要，再单独评估其名下标签 / free-QA / 高亮的连带处置。
