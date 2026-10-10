# Paperland 技术栈

## 总览

| 维度 | 选型 |
|------|------|
| Runtime | Bun |
| Language | TypeScript (前后端统一) |
| Frontend | Vue 3 + Vite |
| Backend | Fastify |
| ORM | Drizzle ORM |
| Database | SQLite (未来可迁移到 PostgreSQL) |
| PDF 解析 | 可配置: Python subprocess 或 Node.js pdf-parse |
| 包管理 | Bun (workspace monorepo) |
| 全局配置 | config.yml |
| 命名规范 | snake_case (API 响应、数据库字段、JSON key 全部统一) |

---

## 项目结构

### 生产运行

从项目根目录执行 `bun run build:frontend`，再运行 `bun run packages/backend/src/index.ts`。`frontend_hosting.ts` 使用已安装的 `@fastify/static`，在 `packages/frontend/dist/index.html` 存在时托管 Vue SPA；缺少构建产物时保留 API-only 启动。后端始终绑定 `127.0.0.1:3000`，Caddy 将 `paperland.dev.mem.ac` 反代到该端口，并以 `flush_interval -1` 透传 SSE。

**前端构建排队**：`bun run build:frontend` 调 `scripts/build-frontend.sh`，是唯一的前端构建入口（规则见 `AGENTS.md` → Frontend builds）。用 `flock` 保证全机同一时刻只跑一个构建（锁随进程退出释放）；每个请求按输出目录登记递增序号，构建开始时覆盖此前登记的全部请求，排队中已被覆盖的请求不再构建，直接以那次构建的退出码退出并给出日志。默认输出 `packages/frontend/dist`，`--out-dir <dir>` 用于验证构建（同样排队，只与同目录请求合并）。状态与日志在 `data/build-queue/`（gitignore）；`BUILD_QUEUE_CMD` 可替换构建命令，用于测试队列本身。

**版本号**：Paperland 版本号是根 `package.json` 的 `version`（`MAJOR.MINOR.PATCH`，当前大版本 2），只用于辨认构建。大版本号仅开发者要求时更新；数据库表不兼容变更时必须更新中版本号（用户要求也可更新，小版本号归零）；每次 OpenSpec 归档更新小版本号，由归档的 agent 完成，开发期间不改（规则见 `AGENTS.md` → Versioning）。`packages/frontend/vite.config.ts` 在构建 / dev server 启动时读取该版本和 `git rev-parse --short HEAD`（失败为 `unknown`），以 `define` 注入 `__APP_VERSION__`、`__GIT_HASH__`；hash 是构建时的 HEAD，构建早于提交时会落后一个 commit。

**PWA**：站点可安装为独立窗口 App（Settings → Install app）。手写 `public/manifest.webmanifest` 与只为可安装性存在的 `public/sw.js`（不缓存、不拦截请求），生产构建时由 `main.ts` 注册；未引入 `vite-plugin-pwa` / Workbox。`frontend_hosting.ts` 以 `no-cache` 直接返回这些根目录文件，无需后端改动。

线上后端使用 systemd 的 `paperland.service`，`WorkingDirectory=/root/yulun/paperland`，支持自动重启和开机启动；模型所需环境变量保存在机器本地 `/etc/paperland/backend.env`（root-only，不入 Git）。更新构建后执行 `systemctl restart paperland`。开发使用 `bun run dev`，仍通过 Vite 5173 访问。静态入口 HTML 禁止长期缓存，带构建版本的 `/assets/` 使用一年 immutable 缓存。部署时先检查运行中的服务任务，再重启后端。

```
paperland/
├── config.yml                      # 全站统一配置
├── data/
│   ├── paperland.db                # SQLite 数据库
│   └── backups/                    # 每日备份
├── packages/
│   ├── frontend/                   # Vue 3 + Vite
│   │   ├── src/
│   │   │   ├── views/              # 页面组件
│   │   │   │   ├── PaperList.vue
│   │   │   │   ├── PaperDetail.vue
│   │   │   │   ├── QAPage.vue
│   │   │   │   ├── ResearchList.vue    # /research：Deep Research 会话列表 + 新建（可从 QA 回答起步）
│   │   │   │   ├── ResearchDetail.vue  # /research/:id：步骤时间线、版本视图（Report / Papers）、标题编辑、从历史版本继续
│   │   │   │   ├── ServiceDashboard.vue
│   │   │   │   └── Settings.vue        # /settings（所有登录用户）：Install app → Account → Administration（仅 admin）
│   │   │   ├── components/         # 通用组件（含 settings/：InstallAppCard.vue（PWA 安装）、AccountSettings.vue（个人账户 / Sharing / API Tokens / 浏览器插件）；含 PdfUploadPanel.vue：PDF 缺失时的获取中 / 需要上传面板；PaperRefList.vue：可复用论文列表，QA 引用列表 / Deep Research 共用（论文 / 链接行、Markdown comment、New / Unverified / Removed）；ResearchPaperList.vue：一个研究列表版本 + 与上一版本逐段对比）
│   │   │   ├── composables/        # Vue composables（含 useS2Papers.ts：S2 id 批量解析与会话缓存）
│   │   │   ├── lib/                # 纯函数工具（含 cite-links.ts：`#cite:` 提取与 id 规范化；research-list.ts：研究列表格式边界——流式拆分报告/列表块、逐段版本对比）
│   │   │   ├── router/
│   │   │   ├── stores/             # Pinia stores（含 research.ts：研究会话、步骤 SSE 订阅）
│   │   │   ├── api/                # API 请求封装
│   │   │   └── App.vue
│   │   ├── public/                 # 静态资源原样复制到 dist 根：favicon.svg、PWA manifest.webmanifest、sw.js（不缓存不拦截）、icon-*.png / apple-touch-icon.png
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── backend/                    # Fastify API server
│   │   ├── src/
│   │   │   ├── api/                # Internal API routes
│   │   │   │   ├── papers.ts
│   │   │   │   ├── qa.ts
│   │   │   │   ├── s2.ts             # POST /api/s2/papers/resolve（S2 id → 缓存元数据）
│   │   │   │   ├── research.ts       # /api/research/*：会话、步骤（提交/重试/取消）、标题编辑、回退、SSE
│   │   │   │   ├── mcp.ts            # POST /mcp：agent 工具的 MCP 服务器（无状态 JSON-RPC，api_tokens Bearer：personal + agent）
│   │   │   │   ├── tokens.ts         # /api/auth/me/tokens*：用户自管 personal token、重置自己的 Codex agent token
│   │   │   │   ├── services.ts
│   │   │   │   └── settings.ts
│   │   │   ├── external-api/       # External API routes (/external-api/v1/...)
│   │   │   │   ├── papers.ts
│   │   │   │   └── tags.ts
│   │   │   ├── services/           # Service 实现
│   │   │   │   ├── arxiv_service.ts
│   │   │   │   ├── arxiv_service.test.ts
│   │   │   │   ├── semantic_scholar_service.ts
│   │   │   │   ├── semantic_scholar_service.test.ts
│   │   │   │   ├── s2_paper_cache.ts        # S2 元数据缓存：论文库 → 缓存 → batch 抓取，负缓存，回答完成后预热
│   │   │   │   ├── research_runtime.ts      # Deep Research 回合调度（services.research 的 Semaphore/RateLimiter）、状态机、流式、自动修复、重启恢复
│   │   │   │   ├── research_prompt.ts       # 回合输入组装（<topic>/<seed>/<history>/<current_version>/<request>）与修复请求
│   │   │   │   ├── research_list.ts         # 列表格式边界：解析回答、带 S2 元数据的 <paper_list> XML、标题编辑、修复合并
│   │   │   │   ├── agent_tools.ts           # agent 只读工具：本站论文检索 / 全文分页 / QA，S2 搜索 / 匹配 / 批量 / 引用 / 透传（共享 S2 限速、写缓存）
│   │   │   │   ├── agent_attach.ts          # 给 Paperland 拉起的 Codex 挂 paperland MCP（用户 agent token、工具白名单、预批准 upload_image、追加 figures prompt）
│   │   │   │   ├── model_usage.ts           # model_usage 账本：按 pricing 估算费用、记录（不抛错）、个人汇总 / 排行榜
│   │   │   │   ├── api_tokens.ts            # api_tokens 两种 kind：personal（自管）/ agent（每用户一个、只供 /mcp、原地重置），Bearer 校验
│   │   │   │   ├── paperlist.ts             # paperlist 块解析与校验（zod、批量解析 s2_id、段内去重）
│   │   │   │   ├── s2_paper_cache.test.ts
│   │   │   │   ├── s2_pdf_service.ts        # 无 arxiv_id 时经 S2 openAccessPdf 下载 PDF
│   │   │   │   ├── s2_pdf_service.test.ts
│   │   │   │   ├── pdf_parse_service.ts
│   │   │   │   ├── pdf_parse_service.test.ts
│   │   │   │   ├── qa_service.ts
│   │   │   │   ├── qa_service.test.ts
│   │   │   │   ├── papers_cool_service.ts  # papers.cool 中文摘要抓取
│   │   │   │   ├── doc2x_cli.ts            # doc2x CLI 调用封装（--json、超时、错误映射）
│   │   │   │   ├── doc2x_parse_service.ts  # doc2x 精确解析 → contents.doc2x_parsed
│   │   │   │   ├── doc2x_translate_service.ts  # doc2x 对照翻译 PDF + 仅译文裁剪 (pdf-lib)
│   │   │   │   ├── doc2x_gateway.ts        # 复用已存 parseId 建翻译任务（doc2x 网关，失败回退 CLI）
│   │   │   │   └── service_runner.ts   # 服务调度器 (并发控制、状态管理)
│   │   │   ├── db/                 # Drizzle schema + migrations
│   │   │   │   ├── schema.ts       # 数据库 schema 定义
│   │   │   │   ├── migrate.ts
│   │   │   │   └── migrations/
│   │   │   ├── auth/               # 认证
│   │   │   │   ├── basic_auth.ts   # HTTP Basic Auth 中间件
│   │   │   │   ├── visibility.ts   # 多用户可见性：共享开关 + mine/all 过滤（可选共享数据）
│   │   │   │   └── token_auth.ts   # Bearer Token 中间件
│   │   │   ├── config.ts           # config.yml 加载
│   │   │   └── index.ts            # 入口
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared/                     # 共享类型定义
│   │   ├── src/
│   │   │   └── types.ts            # Paper, QAEntry, QAResult 等类型
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── browser-extension/          # 浏览器插件（MV3，Chrome/Edge/Firefox，免构建；见 docs/browser-extension.md）
│   │   ├── manifest.json
│   │   ├── icons/
│   │   ├── src/                    # arxiv.js（id 提取，纯函数）/ background.js / options.html,js / settings.js（storage 优先、preset.json 兜底）
│   │   └── test/                   # bun test（URL → arxiv id、preset 合并）
│   │                               # 下载：后端 api/extension.ts 即时打包 zip（无依赖 STORE 写入器 + Bun.hash.crc32），注入 src/preset.json
│   │
│   └── zotero-plugin/              # Zotero 7 侧边栏插件
│       ├── addon/
│       │   ├── manifest.json       # 插件元数据
│       │   ├── bootstrap.js        # 入口 + 全部逻辑
│       │   ├── prefs.js            # 默认偏好设置
│       │   └── content/            # 偏好设置 UI + 图标
│       ├── scripts/build.sh        # 构建 .xpi
│       └── package.json
│
├── scripts/
│   └── pdf_parser.py               # Python PDF 解析脚本 (PyMuPDF/pdfplumber)
│
├── data/
│   ├── paperland.db                # SQLite 数据库
│   └── pdfs/                       # 下载的 PDF 文件
│
├── docs/                           # 设计文档
│   ├── frontend-architecture.md
│   ├── external-api.md
│   └── tech-stack.md
│
├── openspec/
├── bun.lock
├── package.json                    # workspace root
└── tsconfig.base.json              # 基础 TypeScript 配置
```

---

## Drizzle ORM Schema 概览

Drizzle 的 schema 定义同时适用于 SQLite 和 PostgreSQL，切换时只需更改 driver 和少量语法。

```typescript
// packages/backend/src/db/schema.ts (伪代码示意)

papers
  id              integer   primary key autoincrement
  arxiv_id        text      unique, nullable
  corpus_id       text      unique, nullable
  s2_paper_id     text      unique, nullable  // 40-hex S2 paperId（迁移 0029 从 metadata.s2_url 回填）
  title           text      not null
  authors         text      not null          // JSON array
  abstract        text      nullable
  contents        text      nullable          // JSON: { user_input, pdf_parsed, doc2x_parsed, ... }。论文列表 GET /api/papers 不读也不返回此列（只在详情返回）；metadata 在列表中瘦身为 citation_count/reference_count/s2_url
  pdf_path        text      nullable
  metadata        text      nullable          // JSON
  listed          integer   not null default 1 // 全局可见性: 1=列表显示+完整管线, 0=仅元数据/隐藏
  created_at      text      not null          // ISO 8601

users
  id              integer   primary key autoincrement
  username        text      unique not null
  nickname        text      nullable          // 对外显示名，可重复；为空时显示 username（≤32 字符，去首尾空格）
  password_hash   text      not null          // Bun.password (argon2id)
  role            text      not null          // "admin" | "user"
  status          text      not null default 'active'  // "active" | "pending"（自助注册待审核，不能登录；迁移 0036）
  open_token      text      nullable          // 浏览器插件快捷打开的每用户 CSRF token（首次请求时生成，可重新生成）
  created_at      text      not null

sessions
  id              text      primary key       // 随机不透明 token（httpOnly cookie）
  user_id         integer   → users.id, not null
  created_at      text      not null
  expires_at      text      not null          // 默认 30 天

tags
  id              integer   primary key autoincrement
  user_id         integer   → users.id        // 属主（标签按用户隔离）
  name            text      not null          // 唯一性按 (user_id, name)

paper_tags
  paper_id        integer   → papers.id
  tag_id          integer   → tags.id          // 属主经 tag_id → tags.user_id 推导
  primary key (paper_id, tag_id)

qa_entries
  id              integer   primary key autoincrement
  paper_id        integer   → papers.id, not null
  user_id         integer   → users.id, nullable  // free 条目属主；template 为空（公开）
  type            text      not null          // "template" | "free"
  template_name   text      nullable          // 模板类型时作为 key
  prompt          text      nullable          // 问题先于模型调用落库；仅不可恢复的历史失败行可为空
  instruction     text      nullable          // system prompt 名（prompts/system/<name>.md），null = 默认
  inputs          text      nullable          // JSON：text_selection / image(image_hash) / history(result_id)，链内唯一标号
  parent_entry_id integer   nullable, indexed // 由 history input 派生，用于追问树

qa_results
  id              integer   primary key autoincrement
  qa_entry_id     integer   → qa_entries.id, not null
  prompt          text      not null
  answer          text      not null
  model_name      text      not null
  completed_at    text      not null          // ISO 8601
  execution_id    integer   nullable          // → service_executions.id
  content_hash    text      nullable          // answer 去除全部空白后的 MD5
  status          text      not null default done // queued / awaiting_output / streaming / done / failed / cancelled
  error           text      nullable
  requested_by_user_id integer nullable → users.id ON DELETE SET NULL
  streaming_capable integer not null default 0
  created_at      text      not null
  started_at      text      nullable          // provider 调用/Thinking 开始
  first_chunk_at  text      nullable          // 首个真实非空 delta
  finished_at     text      nullable
  updated_at      text      not null          // 最近一次局部 answer 持久化
  deleted_at      text      nullable          // 软删除：所有用户读取排除，追问历史仍读取

s2_papers                                     // S2 论文元数据缓存（与论文库无关；#cite 等引用到的论文），迁移 0032
  id              integer   primary key autoincrement
  s2_paper_id     text      unique, nullable  // 40 位小写 paperId
  corpus_id       text      unique, nullable  // 至少有其一
  arxiv_id / doi / title / venue / abstract / tldr / publication_date / url / open_access_pdf_url   text nullable
  authors         text      nullable          // JSON 作者名数组
  year / citation_count / influential_citation_count / reference_count   integer nullable
  status          text      not null          // ok | not_found（负缓存，只存被请求的那种 id）
  fetched_at      text      not null          // 新鲜度判断依据
  created_at      text      not null

research_sessions                             // Deep Research 会话（optionally-shared 类型 research，默认私有），迁移 0034
  id              integer   primary key autoincrement
  user_id         integer   not null → users.id ON DELETE CASCADE
  topic           text      not null
  seed            text      nullable          // JSON：起步 QA 回答的快照（论文 id/标题、问题、回答、模型、result id）
  created_at / updated_at   text not null

research_steps                                // 线性步骤：agent 回合 / owner 标题编辑；paper_list + report 非空 = 一个版本
  id              integer   primary key autoincrement
  session_id      integer   not null → research_sessions.id ON DELETE CASCADE
  step_index      integer   not null          // 1 起连续；(session_id, step_index) 唯一
  kind            text      not null          // agent | title_edit
  user_text       text      nullable          // agent：用户文本；title_edit：改动描述
  model_name      text      nullable          // 仅 agent（Codex 模型）
  status          text      not null          // queued / awaiting_output / streaming / done / failed / cancelled（title_edit 恒为 done）
  answer          text      not null default '' // agent 原始输出（流式追加）
  report          text      nullable          // 版本的 Markdown 报告
  changes_note    text      nullable          // agent 的本轮改动说明（paperlist.changes）
  paper_list      text      nullable          // 版本的列表 JSON：{title, changes?, sections:[{title, description?, items:[paper{s2_id, comment?, verification} | link{url, citation, comment?}]}]}
  parse_error     text      nullable          // 未产出版本的原因
  repaired        integer   not null default 0 // 1 = 列表来自自动修复请求
  error           text      nullable
  created_at / started_at / first_chunk_at / finished_at / updated_at   text

model_usage                                   // 每次模型调用的 token 用量与估算费用（独立账本，不加在请求表上），迁移 0038
  id              integer   primary key autoincrement
  category        text      not null          // qa | research | translation
  user_id         integer   nullable → users.id ON DELETE SET NULL          // 计费归属
  qa_result_id    integer   nullable → qa_results.id ON DELETE SET NULL     // category = qa
  research_step_id integer  nullable → research_steps.id ON DELETE SET NULL // category = research（回合与修复各一行）
  translation_id  integer   nullable → translations.id ON DELETE SET NULL   // category = translation
  model_name      text      not null
  input_tokens / cached_input_tokens / output_tokens / reasoning_tokens / total_tokens  integer default 0  // input 含 cached，output 含 reasoning
  cost_usd        real      nullable          // 写入时按模型 pricing 估算；模型没配 pricing 为 null
  created_at      text      not null          // 索引：user_id、created_at

qa_user_preferences
  user_id         integer   → users.id
  qa_entry_id     integer   → qa_entries.id
  background_color text     not null          // gray | brown | orange | yellow | green | blue | purple | pink | red
  created_at      text      not null
  updated_at      text      not null
  primary key (user_id, qa_entry_id)

user_papers                                    // 用户×论文关系（迁移 0031）：个人论文列表（Mine）。论文全站共享，此表是每个用户的私有视图；回填 = Attention(1706.03762) + 该用户打过标签/写过笔记/free Q&A/触发过 Q&A/高亮/参考链接的论文
  user_id         integer   → users.id ON DELETE CASCADE
  paper_id        integer   → papers.id ON DELETE CASCADE（删除论文时也显式清理）
  in_library      integer   not null default 1 // 1 = 在该用户的 Mine 列表；移出只置 0，保留行
  created_at      text      not null
  updated_at      text      not null
  primary key (user_id, paper_id)

user_sharing_settings                          // 可选共享数据的每用户每类型共享开关（迁移 0027）；稀疏：无行 = config sharing.default_shared
  user_id         integer   → users.id ON DELETE CASCADE
  data_type       text      not null          // highlights | notes | qa | reference_links
  shared          integer   not null          // 1 = 出现在其他用户的 All 列表；0 = 私有（admin 仍可见）
  updated_at      text      not null
  primary key (user_id, data_type)
  // 读取过滤统一由 packages/backend/src/auth/visibility.ts（ownerVisibilityFilter / sharedFlagsFor / canViewOwnedRow）完成

service_executions
  id              integer   primary key autoincrement
  service_name    text      not null
  paper_id        integer   → papers.id, not null
  status          text      not null          // pending / running / done / failed
  progress        integer   not null default 0
  created_at      text      not null
  finished_at     text      nullable
  result          text      nullable
  error           text      nullable

api_tokens
  id              integer   primary key autoincrement
  token           text      unique not null
  user_id         integer   → users.id        // 归属用户（External API / MCP 按此用户操作）
  created_at      text      not null
  revoked_at      text      nullable
  kind            text      not null default 'personal'  // 'personal'（External API + /mcp）| 'agent'（只供 /mcp）；迁移 0037
  rotated_at      text      nullable          // agent token 最近一次原地重置时间
  // 部分唯一索引 api_tokens_agent_user_unq (user_id) WHERE kind = 'agent'：每个用户最多一个 agent token

highlights
  id              integer   primary key autoincrement
  user_id         integer   → users.id        // 属主（高亮可选共享，受 user_sharing_settings.highlights 控制）
  pathname        text      not null
  content_hash    text      not null
  qa_result_id    integer   nullable → qa_results.id  // QA answer 高亮归属；其他内容为空
  start_offset    integer   not null
  end_offset      integer   not null
  text            text      not null
  color           text      not null          // yellow | green | blue | pink
  note            text      nullable
  created_at      text      not null

notes                                          // 按用户归属的论文笔记（每 用户×论文 一篇 Markdown 大笔记；可选共享，受 user_sharing_settings.notes 控制）
  id              integer   primary key autoincrement
  user_id         integer   → users.id, not null     // 属主
  paper_id        integer   → papers.id, not null
  body            text      not null default ''       // 整篇 Markdown；结构由标题派生，锚点以 paperland:// 链接内联于 body
  completed       integer   not null default 0         // 1 = 用户标记该笔记 "Done reading"（论文列表 note-status 列 + 详情页功能栏切换）
  is_public       integer   not null default 0         // 1 = 已发布（任何人含匿名可只读思维导图+全文，且无视共享开关始终出现在 All 列表）；属主经 PUT .../note/visibility 切换（迁移 0020）
  created_at      text      not null
  updated_at      text      not null
  // 唯一索引 notes_user_paper_unq (user_id, paper_id) —— 每 用户×论文 至多一行；惰性创建（首次写入才建行）
  // 旧的 kind/parent_id/title/sort_order 树字段已由迁移 0017 删除；旧树经 notes-migration.ts 压平为单篇 body

paper_reference_links                          // 按用户归属的论文参考链接（博客解读 / 项目主页 / 讨论帖等；可选共享，受 user_sharing_settings.reference_links 控制）
  id              integer   primary key autoincrement
  user_id         integer   → users.id, not null     // 属主
  paper_id        integer   → papers.id, not null
  title           text      not null                 // 标题（必填）
  url             text      not null                 // 链接（必填，仅 http/https）
  description     text      nullable                 // 描述（可选）
  created_at      text      not null
  updated_at      text      not null
  // 索引 idx_paper_reference_links_paper_user (paper_id, user_id)；列表按 created_at 升序（添加顺序）

translations                                   // 英译中翻译缓存；按内容寻址，全体用户共享（无 user_id）
  id              integer   primary key autoincrement
  source_hash     text      not null           // 规范化(去首尾空白)源文的 SHA-256 hex
  source_text     text      not null           // 规范化后的源文
  source_lang     text      not null default 'en'
  target_lang     text      not null default 'zh'
  translated_text text      not null
  model_name      text      nullable           // 实际使用的模型名
  created_at      text      not null
  updated_at      text      not null
  // 唯一索引 (source_hash, target_lang)：命中/覆盖键；「重新翻译」原地覆盖同一行。另有 source_hash 索引
```

---

## config.yml 完整结构

```yaml
# 数据库
database:
  type: sqlite                      # sqlite | postgresql
  path: ./data/paperland.db         # SQLite 时使用
  # url: postgresql://...           # PostgreSQL 时使用

# 认证（会话登录；用户存于数据库 users 表，不再使用 config 凭据）
auth:
  enabled: true                       # true=会话登录 + 登录墙（未登录只能登录/注册、看已发布笔记与图床）；false=开发期免登录（请求视为 admin）
  registration_enabled: true          # 登录页自助注册（建 pending 账号，管理员在 Settings 审核）；false=关闭，POST /api/auth/register 返回 403
  # users: 已弃用 —— 用户改存数据库。首次启动若无用户会自动创建 admin
  #        并把随机初始密码打印到服务器日志（仅一次）。新用户由管理员在设置页添加。

# 服务配置
# 各 service 之间完全并行，互不阻塞
# 每个 service 内部受 max_concurrency 和 rate_limit_interval 约束
services:
  arxiv:
    max_concurrency: 3
    rate_limit_interval: 3          # 两次请求最小间隔 (秒)
  semantic_scholar_service:         # 服务名须与代码注册名一致
    max_concurrency: 1              # S2 带 key 默认 1 RPS
    rate_limit_interval: 1          # 无 key 建议 3；强制指数退避
    # api_key_env: SEMANTIC_SCHOLAR_API_KEY   # 或 api_key: <key>，经 x-api-key 头发送
  research:                         # Deep Research 回合（未配置时并发 1、无间隔；不写 service_executions）
    max_concurrency: 1
  s2_pdf_service:                   # 仅无 arxiv_id 的论文：经 S2 openAccessPdf 下载 PDF
    max_concurrency: 2
    rate_limit_interval: 2
    download_timeout: 60            # 秒
    max_file_size_mb: 100
  pdf_parse:
    max_concurrency: 2
    method: python                  # python | nodejs
    python_script: ./scripts/pdf_parser.py
  papers_cool:
    max_concurrency: 1
    rate_limit_interval: 5          # papers.cool 限流保护
  qa:
    max_concurrency: 2
  translation_service:              # 翻译服务的 AI 调用并发/限流
    max_concurrency: 2
    rate_limit_interval: 1
  # concurrency_group：同组服务共享一个并发信号量（组内 max_concurrency 取相同值）。
  # doc2x 两个服务共享 Doc2X 账号级任务并发上限：实测账号同时只能跑 1 个任务
  # （并发解析多出来的会以 task_request_failed 失败），所以固定为 1。
  doc2x_parse:
    max_concurrency: 1
    concurrency_group: doc2x
  doc2x_translate:
    max_concurrency: 1
    concurrency_group: doc2x

# 模型配置
models:
  default: "gpt-4o"
  available:
    - name: "gpt-4o"
      type: openai_api
      endpoint: "https://api.openai.com/v1"
      api_key_env: "OPENAI_API_KEY"
      stream: false                # 缺省/false=JSON；true=Chat Completions SSE
    - name: "codex-gpt-6-luna-low"
      type: codex                  # 与 openai_api 独立的一等 provider
      stream: true                 # false=codex exec --ephemeral；true=app-server delta
      cli_path: "/root/.local/bin/codex"
      codex_home: "/root/.codex"  # 读取既有登录状态，不复制/输出 auth.json
      model_id: "gpt-6-luna"
      reasoning_effort: low
      timeout: 1800
      vision: true                 # 能接收图片输入（截图提问）；缺省 false
      pricing:                     # 可选：美元 / 百万 token，只用于估算 model_usage.cost_usd；缺省则费用为空
        input: 1.25
        cached_input: 0.125        # 可选，缺省按 input 计
        output: 10

# BREAKING：原 claude_cli / codex_cli generic provider 已移除；Codex 统一迁移到 type: codex。

# Q&A 文本上下文优先级（运行时解析：doc2x 解析完成后新的提问/重新生成自动改用 doc2x 文本）
pdf_upload:
  max_file_size_mb: 100             # 用户上传 PDF（POST /api/papers/:id/pdf）的大小上限，超出 413

content_priority:                   # 缺省即为下列值
  - user_input
  - doc2x_parsed
  - pdf_parsed

# QA prompt。system prompt 是 prompts/system/<name>.md 文件（只放规则，每次运行重新读取）；
# 论文、参考文献、inputs、历史和问题由后端拼成 user 消息。旧的顶层 system_prompt 模板会让启动报错。
qa_prompt:
  # system_prompts_dir: ./prompts/system   # 缺省 = 仓库自带目录；相对路径相对 config.yml
  default_system_prompt: paper-qa
  direct_ask:                               # PDF 选段/截图直接提问
    # system_prompt: paper-qa
    question: "Explain this in detail in an easy-to-understand way, using bullet points."
  codex_web_search: true                    # Codex 模型可联网搜索（如查 S2 paperId）
  max_history_turns: 20                     # 追问最多带最近 N 轮历史

qa:                                         # 只放 preset QA；可选 system_prompt: <name>
  - name: research-question
    prompt: "这篇论文试图解决什么问题？"

# S2 论文元数据缓存（s2_papers）。整块或单项缺省时使用下列默认值。
s2_cache:
  ttl_days: 30                      # 成功条目过期天数，过期后重抓；重抓失败时返回旧数据（stale_cache）
  not_found_ttl_days: 7             # S2 查无此文的负缓存天数，期间不再请求
  max_ids_per_request: 200          # POST /api/s2/papers/resolve 单次 id 上限，超出 400

# Deep Research（/research）。整块或单项缺省时使用下列默认值。
research:
  system_prompt: research           # prompts/system/research.md（先找 qa_prompt.system_prompts_dir，找不到用仓库自带）
  history_char_budget: 20000        # 每轮回放的历史步骤字符预算（超出只保留用户文本）
  abstract_char_limit: 1500         # <current_version> 中每篇论文摘要的截断长度

# agent 工具（/mcp，Deep Research 回合使用）。整块或单项缺省时使用下列默认值。
agent_tools:
  enabled: true                     # false = 回合只有联网搜索
  base_url: http://127.0.0.1:3000   # agent 连接本后端 /mcp 的地址
  search_max_results: 20            # search_papers 结果上限
  read_max_chars: 20000             # read_paper 单页字符上限
  qa_answer_max_chars: 4000         # get_paper_qa 每个回答截断长度上限
  s2_get_path_prefixes: ['/graph/v1/']  # s2_get 透传允许的路径前缀（仅 GET）
  s2_get_max_chars: 20000           # s2_get 响应截断长度
  # skills_dir: ./prompts/skills    # 额外的 Codex skill 根目录（缺省 = 仓库自带；相对路径相对 config.yml）

# doc2x CLI（精确解析 + 保留排版对照翻译）。整块缺省 = 关闭。
# 前置（以运行后端的同一 OS 用户，一次性）：npm i -g @noedgeai-org/doc2x-cli@latest（Node >= 22）+ doc2x login
doc2x:
  enabled: true
  cli_path: doc2x                   # 绝对路径时其所在目录（含 node）会被加到子进程 PATH 前
  timeout: 1800                     # 单次 CLI 运行超时（秒），超时 kill
  output_dir: ./data/doc2x          # 产物：<output_dir>/<paperId>/{parse,translate}/，经 /api/files/* 访问
  auto_since: '2026-10-09T06:30:00Z'  # created_at ≥ 此时间的论文自动解析；更早的仅手动触发
  token_file: ~/.config/doc2x/cli-oauth-tokens.json  # doc2x login 写入的 OAuth token（复用 parseId 翻译时读取）
  gateway_url: https://v2c.doc2x.noedgeai.com        # doc2x 网关（CLI 内部接口，未公开文档）
  parse:
    formula_mode: dollar            # $…$ 公式分隔符
  translate:
    target_language: zh
    model: '85'                     # doc2x 翻译模型 id（doc2x models list）；85 = gemini-3.1-flash-lite-preview
    pdf_font_strategy: page-optimal
    ignore_types: [reference]       # 参考文献只解析不翻译

# 翻译（英译中）。{TEXT} 占位符在翻译时替换为源文；model 可选，缺省回退 models.default。
# 改 prompt 文案无需改代码。
translation:
  # model: gpt-4o
  prompt: |
    ...（保留格式的英译中 prompt，含 {TEXT} 占位符）

# "Reference links" 描述自动抓取（爬取链接页 <title> 生成 `${title} (${hostname})` 描述）。
# 整块可省略，省略时用下列默认值（注意：内层默认靠 config.ts 的显式 .default 提供）。
reference_links:
  fetch_timeout_ms: 8000              # 单次抓取超时（毫秒）
  max_bytes: 524288                   # 读取响应的最大字节数（512KB，足够取到 <title>）
  user_agent: paperland-link-preview/1.0   # 抓取时使用的 User-Agent

# 多用户共享：高亮 / 笔记 / Free Q&A / 参考链接为「用户可选共享」，每用户每类型一个开关（Account → Sharing）。
# default_shared = 用户从未设置开关时的取值（默认 true）。整块可省略（config.ts 显式 .default）。
sharing:
  default_shared: true

# 笔记渲染。image_width_tiers = 图片 alt 里 `w=sm|md|lg` 指令对应的 px max-width 三档。
# 整块/字段可省略，省略时用下列默认（靠 config.ts 显式 .default 提供）。详见 frontend-architecture.md。
notes:
  image_width_tiers:
    sm: 240
    md: 480
    lg: 720
```

**翻译服务（`translation_service`）**：通用「英译中」文本翻译，pure service（类 `qa_service`，不进依赖图）。核心保留原流水线：源文只做外层 `trim()` → SHA-256 → 查询 `(source_hash,target_lang='zh')` → 命中直接返回；未命中（或 `force`）才经 `services.translation_service` 并发/限流调用 `translation.model`，成功得到非空 final 后再 upsert。delta 永远只在内存/HTTP 流中，失败、超时、取消不会新建/覆盖成功缓存。

`translation.prompt` 继续用 `{TEXT}` 装配，默认采用 format-preserving 单文本 prompt（保留 whitespace、Markdown/HTML、代码、公式、URL、identifier 与 placeholder，只输出简体中文译文）。内部 API（`/api/*`，登录可用，缓存全体共享）：

- `POST /api/translate` —— body `{ text, force?, cache_only? }` → `{ source_hash, source_text, translated_text, source_lang, target_lang, model_name, cached }`。`force:true` 绕过缓存重译并覆盖；`cache_only:true` 为 **peek**：只查缓存、不调 AI、不报 404（命中 `cached:true`+译文，未命中 `cached:false`+`translated_text:null`），供前端判断是否默认展开。
- `POST /api/translate/stream` —— body `{ text, force? }`，返回 `text/event-stream`：`start → delta* → done|error`。缓存命中为 `start(cached:true) → done`，非流式 provider 也只发 done，不伪造 chunk；断连向 provider 传播 abort。
- `GET /api/translations/:hash`（可选 `?target_lang=`，默认 `zh`）—— 按 hash 仅查缓存，命中返回 `{ data }`，未命中 404，不触发 AI。

`qa_service` 与 `translation_service` 继续共用 `services/model_invoke.ts` 的 `callModel(input, modelName, options?)` 门面，内部只路由到独立 `OpenAIProvider` / `CodexProvider`。`input` 可以是字符串（单条 user 文本，翻译仍这样用），也可以是结构化 `ModelInput { system?, user: (text | image{path,mime})[], web_search? }`：OpenAI 发 `role: system` + 多 part user 消息（图片读本地图床文件转 base64 data URL）；Codex app-server 用 `developerInstructions`、`config.web_search: "live"`、`localImage`；Codex exec 用 `-c developer_instructions=…`、`-c web_search="live"`、`--image <path>`，文本仍走 stdin（`--image` 接收多值，不能把问题写在它后面）。`stream` 缺省为 false；Codex exec 与 app-server 都强制 ephemeral，app-server 还会在 `turn/start` 前验证 `thread.ephemeral === true`，不污染个人 Codex 历史。

**PDF 划词翻译**：纯前端复用上述 Internal SSE API 与全局 `translations` cache，不新增 provider、endpoint、表或 migration。`PdfViewer` 以 60ms 选区捕获显示选区工具栏（复制链接 + 翻译），仅在登录用户点击 "Translate" 后对单页 text-layer 选区 identity 挂载 `StreamingTranslationText`，不再有 500ms 自动触发。Vue scoped slot 在 translated text 仍为空时显示 immutable selection snapshot 的原文，首个非空 delta 或 cache result 到达后切换为译文；这只是现有 SSE 消费端的 fallback，不改变 backend、数据库、provider、配置或依赖。面板内 pointer focus transfer 导致的 collapsed selection 不清理 active child；普通外部点击与不同的新选区都会立即 abort 旧 child。其他 viewer 生命周期变化仍会 abort；匿名用户不显示翻译按钮、不请求或弹登录。

**QA prompt 持久化**：`qa_entries` 是问题文本的持久化来源。free QA 在创建 Entry 时写入 `prompt`，后续重跑只读该字段；template QA 每次运行前从 `config.yml` 读取最新模板并更新 Entry。历史 `qa_results.prompt` 仍保存每次成功调用实际使用的快照。迁移通过最新历史 Result 回填可恢复的 Entry；没有任何 Result 的旧失败 free QA 不会伪造原文，只有在用户明确授权且生成当前一致性备份后，才按精确 ID 清理。

**QA ↔ Service execution**：QA 保持 ServiceRunner pure service。`executePureService` 把刚创建的 `executionId` 作为 typed callback context 传入，QA 成功后直接写入该 id；同 paper 并发或同 model 重跑不会再通过“最新 execution”误关联。历史错连缺少确定性映射信息，原样保留。Services 页面继续负责统一监控，不提供 QA 专属重试。

**上下文提问（contextual QA）**：QA = system prompt（`prompts/system/*.md`）+ 有序 inputs（PDF 选段、图床截图、对话历史引用）+ 问题。`services/qa_formatter.ts` 按 `<paper>`（无全文时所有提问 409）→ `<references>`（`paper_citations` 中本论文引用的文献，S2 paperId + 论文库链接）→ `<inputs>`（整条追问链的截图在前、选段在后，各一次）→ `<history>`（祖先问题 + 被选中的回答，只用标号引用输入）→ `<question>` 组装，运行和 "View model input"（`GET /api/qa/results/:id/model-input`，按当前配置重建、不存储、全文只给来源和长度）共用。追问只接续 done 的回答（否则 409），可接续他人共享的回答，归属追问者；后端沿 `history.result_id` 回溯时不过滤可见性和软删除。删除回答改为软删除（`deleted_at`）；图床不再提供删除接口，`GET /api/images` 额外返回 `qa_reference_count`（列表按上传者隔离：非管理员只看到自己上传的图，管理员看全部并带 `uploaded_by_name`）。新增 `GET /api/qa/entries/:id/tree`、`GET /api/qa/entries/:id/locate`；`POST /api/papers/:id/qa/free` 接受 `instruction`、`inputs`、`direct_ask`。迁移 `0030_contextual_qa`（加列 + `qa_result_cites`）。

**S2 论文元数据缓存**：`services/s2_paper_cache.ts` 的 `resolveS2Ids(ids, { allowFetch })` 把 S2 id（paperId、CorpusId、`CorpusId:<n>`、S2 URL，经 `utils/s2_ids.ts` 规范化）解析为元数据，每个 id 依次查：论文库 `papers`（`source: library`，不出网）→ `s2_papers` 新鲜条目（`cache`）→ 剩余 id 合并为一次 S2 `POST /paper/batch`（每块 ≤500，`semantic_scholar_service.ts` 的 `s2PostBatch`，与其他 S2 调用共用 API key、限流和退避）。S2 返回 null 记为 `not_found` 负缓存；抓取失败时有旧数据返回 `stale_cache`，否则 `unavailable`。同一 id 的并发抓取共享一个 in-flight 请求。QA 回答完成后 `api/qa.ts` 异步调用 `warmCites(answer)` 预热回答里所有 `#cite:` id，失败只记日志。

**Deep Research**：`api/research.ts` + `services/research_runtime.ts`。回合在模块内用 `Semaphore` / `RateLimiter`（`services.research`）调度——不走 `executePureService`，因为 `service_executions.paper_id` 是指向 `papers` 的非空外键而研究回合不属于论文；每个排队/运行中的步骤有一个 AbortController 供取消。状态机、200ms 局部写入、独立的 `QAResultStreamBroker` 实例、SSE（`start → (delta|tool)* → [repairing] → done|error`）和启动恢复照搬 QA 的写法。输入由 `research_prompt.ts` 组装：`<topic>`、`<seed>`、`<history>`（用户文本 + `changes` / 标题编辑记录，按 `history_char_budget` 截断）、`<current_version>`（当前报告 + `research_list.ts` 渲染的 `<paper_list>` XML：已验证论文附 `resolveS2Ids` 取得的标题、作者、年份、venue、arXiv id、被引数、TLDR、截断摘要；未验证论文 `verified="false"` 只给 id 与 comment；已在论文库的论文带 `in_library="paperland://paper/<id>"`）、`<request>`；Codex 联网搜索开启。system prompt（`prompts/system/research.md`）除列表格式外还规定：公式一律 `$...$` / `$$...$$`、禁止 `\(...\)` / `\[...\]`；`paperlist` JSON 字符串里的反斜杠必须转义（否则 `\frac`、`\theta` 等会被当成 `\f`、`\t` JSON 转义悄悄损坏）；`in_library` 论文可用 `[📄 标题](paperland://paper/<id>)` 链接。完成后 `paperlist.ts` 拆分报告与最后一个 ```` ```paperlist ```` 块，zod 校验（论文只取 `s2_id` + comment，链接要 BibTeX 风格 `citation`），批量解析 id（解析不到标 unverified，不做标题匹配），段内去重；报告与列表缺一则在同一回合内用同一模型**自动修复一次**（非流式、不联网；只缺/坏列表时只要 `paperlist` 并沿用原报告，缺报告时要完整输出），仍失败则记 `parse_error`、不产生新版本。解析与修复都在标记 done 之前完成。列表格式的知识集中在 `research_list.ts` / `paperlist.ts`（前端对应 `lib/research-list.ts`）。

**Agent 工具（MCP）**：`agent_tools.enabled` 时每个研究回合额外获得本站 MCP 服务器 `paperland` 与 S2 检索 skill。`api/mcp.ts` 自行实现 MCP 的最小子集（Streamable HTTP、无状态：每个 POST 一条 JSON-RPC 或一个批量，直接回 `application/json`；`initialize` / `ping` / `tools/list` / `tools/call`，通知回 202，`GET` / `DELETE` 405），没有引入 `@modelcontextprotocol/sdk`。路径在 `/api` 之外，不经登录墙，任何来源都可访问（含经 Caddy 转发），只靠 Bearer token 鉴权：复用 `api_tokens`（`services/api_tokens.ts#checkBearerToken`，接受 personal 与 agent 两种 kind，要求 token 未撤销、属主存在且 active），按属主的身份与可见性执行工具。每个用户恰好一个 **Codex agent token**（`kind = 'agent'`，部分唯一索引保证；迁移 `0037_agent_tokens` 为 active 用户回填，admin 新建 / 注册审核通过时创建，`db/index.ts` 启动时为缺失的 active 用户兜底，运行时 `ensureAgentToken` get-or-create，均幂等）：任何接口都不返回它的值，只能原地重置（`rotated_at`，旧值立即失效），External API（`auth/token_auth.ts`）不接受它。用户在 Settings 页 Account 区管理自己的 personal token（`api/tokens.ts`）。除 `upload_image` 外工具全部只读、声明 `readOnlyHint`（`services/agent_tools.ts`）：本站 `search_papers`（已列出论文，标题 / 作者 / 摘要逐词匹配）、`get_paper`、`read_paper`（按 `content_priority` 取全文，分页，`outline` 模式给章节标题与偏移）、`get_paper_qa`（按 QA 共享规则过滤）；S2 `s2_search`、`s2_match`、`s2_papers`（走 `resolveS2Ids`）、`s2_citations` / `s2_references`、`s2_get`（仅 `s2_get_path_prefixes` 下的 GET，路径不得含 `..` / 查询串，响应截断）。S2 工具都走 `semantic_scholar_service.ts` 新导出的 `s2ApiGet`（同一个 key、共享限速与退避，key 不进工具输入输出），搜索 / 匹配 / 引用结果经 `s2_paper_cache.ts` 的 `cacheS2Records` 合并写入 `s2_papers`（不覆盖已有非空字段）。注入方式（已用 codex 0.162.1 实测）：`codex_provider.ts` 在 `thread/start` 的 `config.mcp_servers.paperland = { url, bearer_token_env_var }` 里引用环境变量 `PAPERLAND_MCP_TOKEN_PAPERLAND`，值是会话所有者的 agent token，只放在 app-server 子进程环境里；`thread/start` 之前发 `skills/extraRoots/set` 把 `agent_tools.skills_dir`（仓库 `prompts/skills/`，含 `s2-literature-search/SKILL.md`）加为本进程的 skill 根目录——不写 `CODEX_HOME`，不影响用户自己的 Codex。app-server 的 `mcpToolCall` / `webSearch` 条目经 `onToolCall` 回调变成研究 SSE 的 `tool` 事件（不落库），前端显示当前工具调用。exec（`stream: false`）路径不接工具。

**Agent 画图（`upload_image`）**：Codex 内置 `image_gen`（随带 `imagegen` skill）在我们的 ephemeral、只读沙箱 app-server 回合里可用，图片存到 `$CODEX_HOME/generated_images/<thread>/<item>.png`（模型知道这个路径）。`upload_image`（唯一的非只读工具，`readOnlyHint: false`、`destructiveHint: false`、`idempotentHint: true`）把图片经 `image_store.ts#storeImage`（同样的大小上限、MIME 白名单、内容寻址去重）存进图床，上传者为 token 属主，返回 `{ url: '/image/<path>', markdown: '![alt](url)', width, height, deduped }`。两种输入二选一：`path` 只接受 **agent token**（`AgentToolContext.token_kind`，来自 `checkBearerToken`），且 realpath 必须落在某个已配置 Codex 模型的 `<codex_home>/generated_images/` 内（拒绝 `..`、符号链接逃逸、相对路径，校验通过前不读文件）；`data`（base64 / data URL）任何 token 都可用。`/mcp` 的 body 上限按 `image_host.max_size_mb` 的 base64 体积放宽（Fastify 默认 1MB 会让 `data` 上传 413）。`approvalPolicy: never` 会拒绝非只读 MCP 工具，所以 `services/agent_attach.ts#attachAgentTools` 挂 `paperland` 服务器时总是在 thread config 里预批准：`mcp_servers.paperland.tools.upload_image.approval_mode = "approve"`（`ModelMcpServer.approved_tools`），可选 `enabled_tools` 白名单（`ModelMcpServer.enabled_tools`）。研究回合：全部工具 + skill（`attachResearchTools`）；**QA**：Codex app-server 模型（`model_invoke.ts#modelSupportsAgentTools`）且有提问者时，`qa_service.ts#askQuestion({ agentUserId })` 用提问者的 agent token 只挂 `upload_image`。只要挂了 `upload_image`，就把 `prompts/agent/figures.md`（每次运行重读）追加到 system prompt：需要或用户要求时才画；内置预览和 Mermaid 代码读者看不到；画完立即用保存路径调 `upload_image`，原样嵌入返回的 Markdown；不写本地路径 / 占位符、不往工作区拷文件。实测 `gpt-6-astra`（medium）能完成画图 → 上传 → 嵌入，`gpt-6-luna`（low）会画但不上传。生成的原图留在 `$CODEX_HOME/generated_images/`，暂不清理。

**Token 用量与估算费用**：每次模型调用写一行 `model_usage`（`services/model_usage.ts#recordModelUsage`，写入失败只打日志、不影响运行）。provider 经 `ModelInvokeOptions.onUsage` 上报一次用量：Codex app-server 取本轮最后一条 `thread/tokenUsage/updated` 的 `total`（线程内所有请求累计，含工具调用往返；`inputTokens` 含命中缓存的 `cachedInputTokens`，一轮里除首个请求外大多命中缓存），在 `finally` 里上报，失败 / 取消的回合也记；OpenAI 兼容 API 取 JSON 响应的 `usage`，流式请求带 `stream_options: { include_usage: true }`、从最后一个 chunk 取 `usage`；Codex exec 模式拿不到用量，不记。费用 = (未命中输入 × input + 命中输入 × cached_input + 输出 × output) / 1e6，reasoning 算在输出里，写入时按当时 `models.available[].pricing` 固定；管理员可用 `POST /api/usage/recalculate`（`{ from?, to? }`，`YYYY-MM-DD`、UTC 日、含两端，缺省为开区间）按**当前** pricing 从已存 token 重算区间内的费用（`model_usage.ts#recalculateCosts`，每个模型一条 SQL UPDATE、同一事务；模型已不在配置里或没配 pricing 的行保持原值，返回 `{ updated, skipped, skipped_models }`）。归属：QA → `qa_results.requested_by_user_id`（`api/qa.ts#runQA`）；Deep Research → 会话所有者（`research_runtime.ts`，修复请求另记一行）；翻译 → 触发未命中缓存翻译的登录用户（`translateText({ userId })`，命中缓存不调模型不记）。Codex 内置画图的消耗不在 `tokenUsage` 里，不记。旧调用不回填。`api/usage.ts`：`GET /api/usage/me`（本人汇总，总计 + 按类别）、`GET /api/usage/leaderboard`（admin，按估算费用、再按 token 降序；无归属的合为一行），都支持 `?days=N`。

**QA durable streaming runtime**：每次调用通过 pure-service `onCreated` 在排队前插入一个 exact Result；execution context 带 `AbortSignal`，semaphore/rate-limit/provider 都可精确取消。provider delta 以约 200ms 合并，先 append 到 `qa_results.answer` 再发布 SSE；终态 flush 后由权威 final 覆盖并生成 hash。Internal `GET /api/qa/results/:resultId/stream` 使用 `start → delta* → done|error`，断开只取消订阅；`POST /api/qa/results/:resultId/cancel` 才取消运行。`thinking_duration_ms` 由 started/first_chunk/finished 时间戳派生，不写入数据库。启动时 stale active Result 保留局部内容后标为 failed，并重算 Entry 汇总状态。

**有效 Codex QA 模型配置**：交互式 Codex QA 必须使用 structured app-server（`stream:true` + `cli_path` + `codex_home` + `model_id` + `reasoning_effort`）。本机默认/可选的 GPT-5.6-sol max/xhigh/medium 与 GPT-5.5-xhigh 已从 `shell` exec 迁移到该形式，稳定 Paperland model name 不变，因此浏览器保存的模型选择继续有效。`config.example.yml` 同样展示 GPT-5.6-sol app-server 形态。`stream:false` 仍是受支持的显式 buffered 兼容模式。

**QA 前端流式渲染**：Pinia 为当前可见 active Result 管理一个可重连 SSE observer，delta 先经 animation-frame batch；`QAThinkingTimer` 只更新固定宽度计时文本。`QAStreamingMarkdown` 保留稳定 Markdown block DOM、只解析尾部，流式期禁用不稳定的 hash 高亮/锚点；done 等待 pending paint 后切到标准 `MarkdownContent` 做一次 canonical render。不自动滚动或对答案容器做 transition。
新增流式 UI copy 统一为英文：`Queued / Thinking / Streaming / Done / Stopped / Failed`、`Thought for · mm:ss`、`This model will display its answer when complete`、`Agent is thinking…`。

**QA 对话 / 树视图**：纯前端，无新依赖。对话视图的 thread 不落库，由尾回答经已有的 `GET /api/qa/entries/:id/tree` 推导；Q&A 树沿用笔记思维导图的手写布局（嵌套 flex + DOM 实测 SVG 连线），不引入图形库，并在全站共用的浮动窗口机制（`stores/windows.ts` + `FloatingWindow.vue`）中打开。提问框一次只选一个模型（后端接口仍支持多模型）。论文页三种布局（"Two columns" / "Paper + conversation" / "Three columns"）中，论文信息 + Q&A 栏用 VueUse 已有的 `createReusableTemplate` 只定义一次，不新增依赖。

**QA 多回答选择**：`QAResultView` 对所有状态都按 `created_at`（缺失回退 `completed_at`）+ result id 判定最新回答（按提问时间，不按完成时间）。多模型提交时后端按模型列表逆序创建 Result，排在前面的模型默认被选中；默认追问对象额外限定为 done（`defaultFollowupResult`）。首次显示和新增 Result 时激活最新；status、Thinking 计时、answer delta 和等价轮询都不进入 selection signature，因此不重置手动 tab；删除当前 Result 回退最新；`requestedResultId` 锚点为一次性高优先级选择。

---

## 关键依赖

### Backend (packages/backend)

| 依赖 | 用途 |
|------|------|
| fastify | Web 框架 |
| @fastify/cookie | 会话 cookie（登录） |
| drizzle-orm | ORM |
| drizzle-kit | Migration 工具 |
| better-sqlite3 | SQLite driver |
| js-yaml | 解析 config.yml |
| pdf-parse | Node.js PDF 解析 (可选方案) |
| pdf-lib | 把 doc2x 左右对照 PDF 每页裁成右半边，生成 "Translation only" PDF |
| doc2x CLI（外部，`@noedgeai-org/doc2x-cli`） | doc2x 精确解析 / 对照翻译；以子进程 `Bun.spawn` 调用，OAuth 登录态取自 `~/.config/doc2x/` |
| `Bun.password` (内置) | 密码哈希（argon2id），无需第三方依赖 |

### Frontend (packages/frontend)

| 依赖 | 用途 |
|------|------|
| vue | UI 框架 |
| vue-router | 路由 |
| pinia | 状态管理 |
| vite + @tailwindcss/vite | 构建工具 + Tailwind v4 集成 |
| tailwindcss@4 | 样式系统（v4，CSS-first 配置，OKLCH 主题变量） |
| shadcn-vue | 组件库（代码即资产，组件落在 `src/components/ui/`） |
| reka-ui | shadcn-vue 底层无样式原语（前身 radix-vue） |
| @lucide/vue | 图标库 |
| @fontsource-variable/noto-sans, /noto-sans-mono | 正文与等宽字体 |
| tw-animate-css | Tailwind v4 动画工具（替代 v3 的 tailwindcss-animate） |
| class-variance-authority + clsx + tailwind-merge | cn() 与变体管理 |
| vue-sonner | Toast 通知（由 `<Toaster>` 组件包装） |
| pdfjs-dist | 嵌入式 PDF 查看器（替代浏览器原生插件）：canvas 渲染 + 文本层选区，支撑 `paperland://…?pdf=…` 页面/选区锚点。**版本精确 pin**（`ts/te` 为 pdf.js 文本偏移，需跨版本稳定）；动态 `import()` code-split，worker 经 `pdf.worker.min.mjs?url` 注册到 `GlobalWorkerOptions.workerSrc` |
| turndown + turndown-plugin-gfm | 选区 HTML→Markdown 还原（"Copy content and anchor link"：GFM 表格、数学按 `$`/`$$` 还原） |
| monaco-editor | 笔记编辑器（`MonacoMarkdownEditor.vue`，浮窗 + 左面板 edit/split）：Markdown 语法高亮（`lib/monaco.ts` 用 `withMath` 扩展自带文法，加 `$…$`/`$$…$$` LaTeX 数学 token）、显示行号、跟随明暗主题。**懒加载**：`lib/monaco.ts` 动态 `import()` 仅取 `editor.api` + markdown 文法（独立 async chunk，不进首包），`editor.worker?worker` 注册到 `self.MonacoEnvironment`，`vite.config.ts` 设 `worker.format:'es'` |

### Python (scripts/)

| 依赖 | 用途 |
|------|------|
| PyMuPDF (fitz) | PDF 解析 (可选方案) |

---

## 数据库备份 (SQLite)

SQLite 为单文件数据库，支持自动定期备份。

### 备份策略

| 配置 | 值 |
|------|------|
| 备份频率 | 每日一次 |
| 备份目录 | `data/backups/` |
| 备份文件名 | `paperland_YYYY-MM-DD.db` |
| 保留策略 | 分层保留：最近 7 天每日一份 + 检查点 (7,14]、(14,28] 各保留最老一份（稳态约 10 个文件） |
| 清理策略 | 每次备份后按文件名日期（UTC）计算天数，删除不在保留集合中的 `paperland_*.db`；`pre-*.db` 等手工备份不处理 |

### 备份流程

```
每日定时任务 (后端启动时注册)
    │
    ├── 1. 使用 SQLite 的 backup API 复制数据库
    │      → data/backups/paperland_2026-03-18.db
    │
    ├── 2. 扫描 data/backups/ 目录，selectBackupsToDelete() 计算删除集合
    │      保留 0..7 天的全部；(7,14]、(14,28] 区间各保留最老一份
    │      （检查点随时间在区间内老化，而不是每天被替换）；超过 28 天的删除
    │
    └── 3. 记录日志
```

### config.yml 备份配置

```yaml
database:
  type: sqlite
  path: ./data/paperland.db
  backup:
    enabled: true
    dir: ./data/backups
    keep_daily_days: 7             # 最近 N 天每日备份全部保留
    keep_checkpoint_days: [14, 28] # 每个区间 (上一个检查点, c] 保留最老一份
```

> 注意：迁移到 PostgreSQL 后，备份策略应改用 `pg_dump` 等专用工具，此自动备份仅适用于 SQLite。

---

## 数据库迁移策略 (SQLite → PostgreSQL)

1. Drizzle ORM schema 使用通用类型定义
2. 切换时修改 `config.yml` 中的 `database.type` 和连接信息
3. 更换 Drizzle driver (`better-sqlite3` → `postgres`)
4. 运行 `drizzle-kit push` 生成新库表结构
5. 编写数据迁移脚本导出/导入数据
