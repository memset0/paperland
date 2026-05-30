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

```
paperland/
├── config.yml                      # 全站统一配置
├── data/
│   ├── paperland.db                # SQLite 数据库
│   ├── backups/                    # 每日备份
│   └── idea-forge/                 # Idea Forge 文件存储（非数据库）
│       └── {project-name}/
│           ├── AGENTS.md           # AI agent 指引
│           ├── papers/             # 导出的论文
│           └── ideas/              # 研究想法（按分类目录）
├── packages/
│   ├── frontend/                   # Vue 3 + Vite
│   │   ├── src/
│   │   │   ├── views/              # 页面组件
│   │   │   │   ├── PaperList.vue
│   │   │   │   ├── PaperDetail.vue
│   │   │   │   ├── QAPage.vue
│   │   │   │   ├── ServiceDashboard.vue
│   │   │   │   ├── Settings.vue
│   │   │   │   └── idea-forge/    # Idea Forge 页面
│   │   │   │       ├── ProjectList.vue
│   │   │   │       └── IdeaManager.vue
│   │   │   ├── components/         # 通用组件
│   │   │   ├── composables/        # Vue composables
│   │   │   ├── router/
│   │   │   ├── stores/             # Pinia stores
│   │   │   ├── api/                # API 请求封装
│   │   │   └── App.vue
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
│   │   │   │   ├── services.ts
│   │   │   │   ├── settings.ts
│   │   │   │   └── idea-forge.ts  # Idea Forge API (projects, ideas, paper dump)
│   │   │   ├── idea-forge/        # Idea Forge 工具函数
│   │   │   │   ├── utils.ts       # 目录操作、hash、路径解析
│   │   │   │   └── frontmatter.ts # YAML frontmatter 解析/序列化
│   │   │   ├── external-api/       # External API routes (/external-api/v1/...)
│   │   │   │   ├── papers.ts
│   │   │   │   └── tags.ts
│   │   │   ├── services/           # Service 实现
│   │   │   │   ├── arxiv_service.ts
│   │   │   │   ├── arxiv_service.test.ts
│   │   │   │   ├── semantic_scholar_service.ts
│   │   │   │   ├── semantic_scholar_service.test.ts
│   │   │   │   ├── pdf_parse_service.ts
│   │   │   │   ├── pdf_parse_service.test.ts
│   │   │   │   ├── qa_service.ts
│   │   │   │   ├── qa_service.test.ts
│   │   │   │   ├── papers_cool_service.ts  # papers.cool 中文摘要抓取
│   │   │   │   └── service_runner.ts   # 服务调度器 (并发控制、状态管理)
│   │   │   ├── db/                 # Drizzle schema + migrations
│   │   │   │   ├── schema.ts       # 数据库 schema 定义
│   │   │   │   ├── migrate.ts
│   │   │   │   └── migrations/
│   │   │   ├── auth/               # 认证
│   │   │   │   ├── basic_auth.ts   # HTTP Basic Auth 中间件
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
  title           text      not null
  authors         text      not null          // JSON array
  abstract        text      nullable
  contents        text      nullable          // JSON: { user_input, pdf_parsed, ... }
  pdf_path        text      nullable
  metadata        text      nullable          // JSON
  listed          integer   not null default 1 // 全局可见性: 1=列表显示+完整管线, 0=仅元数据/隐藏
  created_at      text      not null          // ISO 8601

users
  id              integer   primary key autoincrement
  username        text      unique not null
  password_hash   text      not null          // Bun.password (argon2id)
  role            text      not null          // "admin" | "user"
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

qa_results
  id              integer   primary key autoincrement
  qa_entry_id     integer   → qa_entries.id, not null
  prompt          text      not null
  answer          text      not null
  model_name      text      not null
  completed_at    text      not null          // ISO 8601

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
  user_id         integer   → users.id        // 归属用户（External API 按此用户操作）
  created_at      text      not null
  revoked_at      text      nullable

highlights
  id              integer   primary key autoincrement
  user_id         integer   → users.id        // 属主（高亮按用户私有）
  pathname        text      not null
  content_hash    text      not null
  start_offset    integer   not null
  end_offset      integer   not null
  text            text      not null
  color           text      not null          // yellow | green | blue | pink
  note            text      nullable
  created_at      text      not null

notes                                          // 按用户私有的论文笔记
  id              integer   primary key autoincrement
  user_id         integer   → users.id, not null     // 属主
  paper_id        integer   → papers.id, not null
  kind            text      not null                 // 'walkthrough' | 'note'
  parent_id       integer   → notes.id, nullable      // 自引用树；walkthrough 与顶层 note 为 null
  title           text      nullable                 // 小笔记标题；walkthrough 不用
  body            text      not null default ''       // Markdown；锚点以 paperland:// 链接内联于 body
  sort_order      integer   not null default 0        // 同级排序
  created_at      text      not null
  updated_at      text      not null

conferences
  id              integer   primary key autoincrement
  name            text      not null
  year            integer   nullable
  start_date      text      nullable          // ISO 8601 date
  end_date        text      nullable
  location        text      nullable
  description     text      nullable
  link            text      nullable
  created_at      text      not null
  updated_at      text      not null

conference_papers                              // 候选池
  id              integer   primary key autoincrement
  conference_id   integer   → conferences.id, not null
  title           text      not null
  topic           text      nullable           // 自由文本，按主题分组用
  authors         text      nullable           // JSON array
  abstract        text      nullable
  source          text      nullable           // 'arxiv' | 'openreview' | 'semantic_scholar' | null
  external_id     text      nullable
  link            text      nullable
  status          text      not null default 'pending'  // pending | candidate | ingested
  paper_id        integer   → papers.id, nullable       // 入库后写入
  metadata        text      nullable           // JSON: 原始抓取数据
  created_at      text      not null
  updated_at      text      not null
  index (conference_id, status)
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
  enabled: true                       # true=会话登录+三级分层；false=开发期免登录（请求视为 admin）
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
  pdf_parse:
    max_concurrency: 2
    method: python                  # python | nodejs
    python_script: ./scripts/pdf_parser.py
  papers_cool:
    max_concurrency: 1
    rate_limit_interval: 5          # papers.cool 限流保护
  qa:
    max_concurrency: 2

# 模型配置
models:
  default: "gpt-4o"
  available:
    - name: "gpt-4o"
      type: openai_api
      endpoint: "https://api.openai.com/v1"
      api_key_env: "OPENAI_API_KEY"
    - name: "claude-sonnet"
      type: claude_cli
    - name: "codex"
      type: codex_cli

# Q&A 文本上下文优先级
content_priority:
  - user_input
  - pdf_parsed
```

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
| vuedraggable | 拖拽（idea-forge Kanban） |
| pdfjs-dist | PDF 在线阅读 |
| turndown + turndown-plugin-gfm | 选区 HTML→Markdown 还原（「复制为锚点链接」：GFM 表格、数学按 `$`/`$$` 还原） |

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
| 保留天数 | 30 天 |
| 清理策略 | 自动删除超过 30 天的备份文件 |

### 备份流程

```
每日定时任务 (后端启动时注册)
    │
    ├── 1. 使用 SQLite 的 backup API 复制数据库
    │      → data/backups/paperland_2026-03-18.db
    │
    ├── 2. 扫描 data/backups/ 目录
    │      删除超过 30 天的 .db 文件
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
    retention_days: 30
```

> 注意：迁移到 PostgreSQL 后，备份策略应改用 `pg_dump` 等专用工具，此自动备份仅适用于 SQLite。

---

## 数据库迁移策略 (SQLite → PostgreSQL)

1. Drizzle ORM schema 使用通用类型定义
2. 切换时修改 `config.yml` 中的 `database.type` 和连接信息
3. 更换 Drizzle driver (`better-sqlite3` → `postgres`)
4. 运行 `drizzle-kit push` 生成新库表结构
5. 编写数据迁移脚本导出/导入数据
