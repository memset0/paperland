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
├── packages/
│   ├── frontend/                   # Vue 3 + Vite
│   │   ├── src/
│   │   │   ├── views/              # 页面组件
│   │   │   │   ├── PaperList.vue
│   │   │   │   ├── PaperDetail.vue
│   │   │   │   ├── QAPage.vue
│   │   │   │   ├── ServiceDashboard.vue
│   │   │   │   └── Settings.vue
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
│   │   │   │   └── settings.ts
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
│   └── shared/                     # 共享类型定义
│       ├── src/
│       │   └── types.ts            # Paper, QAEntry, QAResult 等类型
│       ├── tsconfig.json
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
  contents        text      nullable          // JSON: { user_input, alphaxiv, pdf_parsed, ... }
  pdf_path        text      nullable
  metadata        text      nullable          // JSON
  created_at      text      not null          // ISO 8601

tags
  id              integer   primary key autoincrement
  name            text      unique not null

paper_tags
  paper_id        integer   → papers.id
  tag_id          integer   → tags.id
  primary key (paper_id, tag_id)

qa_entries
  id              integer   primary key autoincrement
  paper_id        integer   → papers.id, not null
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
  created_at      text      not null
  revoked_at      text      nullable
```

---

## config.yml 完整结构

```yaml
# 数据库
database:
  type: sqlite                      # sqlite | postgresql
  path: ./data/paperland.db         # SQLite 时使用
  # url: postgresql://...           # PostgreSQL 时使用

# 认证
auth:
  users:
    - username: "admin"
      password: "your-password-here"

# 服务配置
# 各 service 之间完全并行，互不阻塞
# 每个 service 内部受 max_concurrency 和 rate_limit_interval 约束
services:
  arxiv:
    max_concurrency: 3
    rate_limit_interval: 3          # 两次请求最小间隔 (秒)
  semantic_scholar:
    max_concurrency: 5
    rate_limit_interval: 1
  pdf_parse:
    max_concurrency: 2
    method: python                  # python | nodejs
    python_script: ./scripts/pdf_parser.py
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
  - alphaxiv
  - pdf_parsed
```

---

## 关键依赖

### Backend (packages/backend)

| 依赖 | 用途 |
|------|------|
| fastify | Web 框架 |
| drizzle-orm | ORM |
| drizzle-kit | Migration 工具 |
| better-sqlite3 | SQLite driver |
| js-yaml | 解析 config.yml |
| pdf-parse | Node.js PDF 解析 (可选方案) |

### Frontend (packages/frontend)

| 依赖 | 用途 |
|------|------|
| vue | UI 框架 |
| vue-router | 路由 |
| pinia | 状态管理 |
| vite | 构建工具 |
| pdfjs-dist | PDF 在线阅读 |

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
