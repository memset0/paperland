# Paperland

[English](README.md)

一个自托管的学术论文管理系统，支持 AI 驱动的问答、自动元数据获取和 Zotero 集成。

## 功能特性

- **论文管理** — 通过 arXiv ID、Semantic Scholar corpus ID 或手动方式添加论文。自动从多个来源获取元数据（标题、作者、摘要）。
- **AI 问答** — 使用可配置的 LLM 后端对论文进行模板化或自由提问。支持 LaTeX 数学公式渲染。
- **PDF 阅读器** — 内置 PDF 阅读器，支持双栏布局（PDF + 论文信息及问答）。
- **服务流水线** — 可插拔的服务架构，支持依赖图调度、并发控制和速率限制。
- **Zotero 集成** — Zotero 7 侧边栏插件，支持论文同步、自动识别 arXiv ID 和标签同步。
- **标签系统** — 使用标签组织论文，在 Paperland 和 Zotero 之间同步。
- **响应式设计** — 桌面端侧边栏布局和移动端适配。

## 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | [Bun](https://bun.sh) |
| 前端 | Vue 3 + Vite + Pinia + Tailwind CSS |
| 后端 | Fastify + Drizzle ORM |
| 数据库 | SQLite（WAL 模式，每日自动备份） |
| Zotero 插件 | Zotero 7+ Bootstrap 插件 |

## 环境要求

- [Bun](https://bun.sh) v1.0+

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 创建配置文件

```bash
cp config.example.yml config.yml
```

编辑 `config.yml` 配置你的 LLM 模型、认证方式和其他设置。详见[配置说明](#配置说明)。

### 3. 运行应用

```bash
# 同时启动后端和前端（需在项目根目录运行）
bun run packages/backend/src/index.ts & bun run --filter '@paperland/frontend' dev
```

应用将在 `http://localhost:5173` 上可用。所有流量通过 Vite 开发服务器，API 请求会被代理到 3000 端口的后端。

> **重要提示：** 必须从项目根目录启动后端。`config.yml` 中的数据库路径是相对于工作目录解析的。

## 配置说明

Paperland 使用单一的 `config.yml` 文件作为配置源。复制 `config.example.yml` 开始使用。

### 数据库

```yaml
database:
  type: sqlite
  path: ./data/paperland.db
  backup:
    enabled: true
    dir: ./data/backups
    retention_days: 30
```

### 认证

```yaml
auth:
  enabled: false  # 设为 true 以启用 /api/* 的 HTTP Basic Auth
  users:
    - username: admin
      password: changeme
```

外部 API（`/external-api/*`）使用 Bearer token 认证，可在设置页面管理 token。

### LLM 模型

```yaml
models:
  default: gpt-4o
  available:
    - name: gpt-4o
      type: openai_api
      endpoint: https://api.openai.com/v1
      api_key_env: OPENAI_API_KEY
```

### 问答模板

定义可批量应用于论文的模板问题：

```yaml
system_prompt: |
  请根据下面的论文内容回答这个问题：{PROMPT}

  ---

  {PAPER}

qa:
  - name: research-question
    prompt: "这篇论文试图解决什么问题？"
  - name: method
    prompt: "论文如何解决所提出的研究问题？"
  - name: summary
    prompt: "帮我总结一下论文的主要内容"
```

### 服务配置

为每个服务配置并发数和速率限制：

```yaml
services:
  arxiv:
    max_concurrency: 3
    rate_limit_interval: 3
  semantic_scholar:
    max_concurrency: 5
    rate_limit_interval: 1
  pdf_parse:
    max_concurrency: 2
    method: nodejs  # 或 python
  qa:
    max_concurrency: 2
```

## 项目结构

```
paperland/
├── config.yml                 # 应用配置（已 gitignore）
├── config.example.yml         # 示例配置
├── data/                      # SQLite 数据库、PDF 文件、备份
├── packages/
│   ├── shared/                # 共享 TypeScript 类型
│   ├── backend/               # Fastify API 服务端
│   │   └── src/
│   │       ├── api/           # 内部 API 路由（/api/*）
│   │       ├── external-api/  # 外部 API 路由（/external-api/*）
│   │       ├── services/      # 服务实现
│   │       └── db/            # Drizzle schema 及迁移
│   ├── frontend/              # Vue 3 单页应用
│   │   └── src/
│   │       ├── views/         # 页面组件
│   │       ├── components/    # 可复用 UI 组件
│   │       ├── stores/        # Pinia 状态管理
│   │       └── api/           # HTTP 请求封装
│   └── zotero-plugin/         # Zotero 7 侧边栏插件
└── docs/                      # 架构文档
```

## Zotero 插件

Zotero 插件在 Zotero 7 中添加侧边栏面板，可直接查看论文详情和问答结果。

### 配置步骤

1. 构建插件或从 Release 安装
2. 在 Zotero 首选项中配置：
   - **Host URL**：Paperland 实例地址（如 `http://localhost:5173`）
   - **API Token**：在 Paperland 设置页面生成
3. 在 Zotero 中选择论文，侧边栏将自动识别其 arXiv ID 并与 Paperland 同步

### 功能

- 自动从 Zotero 条目元数据中识别 arXiv ID
- 一键同步论文并自动获取元数据
- Zotero 与 Paperland 之间的标签同步
- 在侧边栏中嵌入论文详情页

## API

Paperland 提供两套 API：

- **内部 API**（`/api/*`）— 供前端使用，通过 HTTP Basic Auth 保护（如已启用）。
- **外部 API**（`/external-api/v1/*`）— 供 Zotero 插件和第三方集成使用，通过 Bearer token 认证保护。

详见 [docs/external-api.md](docs/external-api.md) 获取外部 API 参考文档。

## 开发

```bash
# 仅运行后端（端口 3000）
bun run packages/backend/src/index.ts

# 仅运行前端（端口 5173）
bun run --filter '@paperland/frontend' dev

# 运行后端测试
bun run --filter '@paperland/backend' test

# 修改 schema 后生成 Drizzle 迁移
cd packages/backend && bunx drizzle-kit generate
```

## 许可证

MIT
