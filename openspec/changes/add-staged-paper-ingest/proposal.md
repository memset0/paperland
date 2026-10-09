## Why

我们要批量导入外部论文并用 Semantic Scholar 富集，但**不希望污染阅读列表、也不想触发 arxiv 的严格限流**。当前论文是"全有或全无"：一旦加入就跑完整管线（arxiv metadata + PDF + 解析 + papers.cool）并显示在列表里。我们需要一个更轻的层级：**只抓了 S2 元数据的论文**——分配真实条目与编号、可索引、可去重合并，但在被显式"加入"之前**对所有用户都不显示**。这样既能避免 S2 重复抓取，又能借唯一约束自动合并相同论文。

## What Changes

- **`papers.listed`（全局布尔，默认 `true`）**：`true` = 显示在列表 + 跑完整管线；`false` = **仅元数据**（隐藏、仅 S2 来源）。可见性是全局的（要么对所有用户可见，要么都不可见）。
- **所有"论文列表"出口按 `listed` 过滤**：论文列表、搜索、标签筛选、External API `GET /papers`（Zotero）、idea-forge paper dump 等只返回 `listed=true`。
- **服务按 `listed` 门禁**：会打 arxiv / 产生重产物的 paper-bound 服务（`arxiv_metadata_service`、`arxiv_pdf_service`、`papers_cool`、`pdf_parse_service`）标记 `requires_listed`，在 `listed=false` 时**延后（deferred）不执行**；只有 `semantic_scholar_service` 运行，供给 id + 引用图 + basic fields + abstract（全部来自 S2）。**提升为 `listed=true` 时再触发完整管线。**
- **S2 优先的元数据**：basic fields（title/authors）+ abstract 优先取自 S2；`arxiv_metadata_service` 退为兜底/补缺（及 PDF 来源）。因为我们本就为引用图调用 S2，这样几乎不再为元数据打 arxiv，让出紧的限流。
- **"加入列表"动作**：把某论文 `listed` 翻成 `true` 并触发完整管线。
- **向后兼容**：默认 `listed=true` 保留既有"加入→完整管线"流程；存量论文迁移回填 `listed=true`，行为不变。

## Capabilities

### New Capabilities
- `paper-staging`: `papers.listed` 全局可见性、两层论文（仅元数据 vs 已列出）、列表/搜索/外部 API 按 `listed` 过滤、按 `listed` 门禁服务调度、"加入列表"提升动作（翻 `listed` 并跑完整管线）。

### Modified Capabilities
- `database-schema`: `papers` 表新增 `listed` 列（布尔，默认 true）。
- `service-dependency-graph`: 新增"按 `listed` 门禁"——`requires_listed` 服务在 `listed=false` 时延后；提升为 `listed=true` 时触发完整管线。
- `semantic-scholar-fetch`: S2 服务供给 basic fields + abstract（S2 优先），对 `listed=false` 论文也运行。
- `arxiv-fetch`: arxiv metadata/PDF 服务标 `requires_listed`、对仅元数据论文延后；元数据以 S2 为先、arxiv 兜底。

## Impact

- **Database**：`papers.listed`（migration + 回填 true）。
- **Backend**：`base_service` 的 paper-bound 定义增 `requires_listed`；`service_runner.triggerForPaper`/调度在 `listed=false` 时跳过/延后 `requires_listed` 服务、提升时重触发；新增 promote 端点（`PATCH /api/papers/:id` 或 `POST /api/papers/:id/list`）；`ingestPaper` 支持 `listed` 入参（默认 true）；`semantic_scholar_service` 填 basic fields + abstract；arxiv 两服务 `requires_listed`；`api/papers.ts`、`external-api/papers.ts`、idea-forge dump 的列表查询按 `listed` 过滤。
- **Frontend**：论文列表（服务端已过滤，无需改）；论文详情页对 `listed=false` 论文显示"加入列表"。
- **Docs**：`docs/tech-stack.md`（`papers.listed`）、`docs/frontend-architecture.md`（两层论文 / 可见性 / 服务门禁）、`docs/external-api.md`（`GET /papers` 仅返回 listed）。

> 会议相关部分（会议候选 S2 解析、会议状态派生）已随 `remove-conference` 移除，本变更只保留 `papers.listed` 两层论文机制。
