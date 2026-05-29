## Why

Paperland 现在的论文几乎全部来自 arxiv（带 `arxiv_id`、无 `corpus_id`）。但现有 `semantic_scholar_service` 声明为 `depends_on: [corpus_id]` / `produces: [arxiv_id]`，方向与真实数据流相反：调度器发现 arxiv 论文缺 `corpus_id` 且无任何服务能产出它，于是把该服务标记为 **blocked**——结果 S2 的引用数、参考文献、corpus_id 等数据**从未被抓取**。

同时存在一处配置错配：`config.yml` 用键名 `semantic_scholar`，而代码注册名为 `semantic_scholar_service`，导致 `ServiceRunner.initialize()` 从未把配置的并发/限流绑定到该服务（实际以默认 `max_concurrency: 2`、**无限流**运行）。而 S2 限流严格（带 key 默认 1 RPS）且**强制要求指数退避**，当前实现既无限流也无退避，极易触发 429。

实测确认：`GET /paper/ARXIV:{arxiv_id}?fields=externalIds,...` 单次请求即可同时拿到 `corpus_id` 与全部富化字段，因此 arxiv → S2 完全可以直接打通。

## What Changes

- **重定向 S2 抓取（核心）**：`semantic_scholar_service` 改为 `depends_on: [arxiv_id]`、`produces: [corpus_id, citation_count, influential_citation_count, references]`（这四个键成功时必写、不会为空，故能终止重跑；`tldr` 等可选字段存入 metadata 但**不**纳入 produces，因其可能缺失）。每篇带 `arxiv_id` 的论文添加后，自动经依赖图抓取 S2 数据。
- **抓取字段**：`corpus_id`（顶层列）、`citation_count`、`influential_citation_count`、`references`（`paper_id`/`title`/`year`）、`tldr`、`venue`、`year`、`doi`、`fields_of_study`、`s2_url`（除 `corpus_id` 外均存入 `paper.metadata`）。
- **单 id 即保留，不强求补全**：只声明主方向。查询 S2 时把响应 `externalIds` 中能拿到的 id 一并写回——arxiv 论文即补上 `corpus_id`（"两个 id 都拿到就都存"）；S2 只返回一个 id 时保留原有的即可，不报错、不强求。只凭 `corpus_id` 添加的论文保持原样、**不做反向解析**。（原设计"也许只能 corpus→arxiv"的前提已被实测证伪。）
- **限流与健壮性**：修正服务名错配使配置生效；按 S2 要求新增 429/5xx **指数退避 + 抖动**；支持 `api_key` / `api_key_env` 经 `x-api-key` 头发送。默认（带 key）`rate_limit_interval: 1`、`max_concurrency: 1`；无 key 建议 `interval: 3`。
- **回填存量论文**：新增一次性回填——对所有"有 `arxiv_id` 但缺 S2 富化（metadata 无 `citation_count`）"的存量论文运行 S2 服务，补全 corpus_id 与富化并入库；经 ServiceRunner 串行、遵守限流。提供内部接口 + 服务管理页按钮触发，进度经既有 `service_executions` 可见。
- **前端 S2 来源标签**：论文**列表**与**详情页**在 arxiv 来源标签旁，新增可点击的 Semantic Scholar 标签（论文有 `corpus_id` 时），跳转其 S2 论文页。
- **详情页富化展示**：论文详情页展示引用数 / influential 引用数 / TL;DR 摘要（完整参考文献列表留作后续）。
- **抓取引用图**：调用 S2 `/references` 与 `/citations`（各取一页），把"本文引用的"与"引用本文的"论文（标题、作者、年份、venue、arxiv/doi/链接、引用上下文 `contexts`、`intents`、`is_influential`）存入新表 `paper_citations`，供之后使用；并提供 `GET /api/papers/:id/citations` 读取接口。所有 S2 调用经共享 1 RPS 限流门。
- **DB 迁移**：新增 `paper_citations` 表（迁移 `0009`）保存引用图；`papers` 与 `metadata` 列无变化。

## Capabilities

### New Capabilities
（无——本次为对既有能力的重定向与扩展。）

### Modified Capabilities
- `semantic-scholar-fetch`: 重定向抓取方向为 `arxiv_id → corpus_id + 引用富化`（写回 S2 返回的所有可得 id）；扩展抓取字段集；新增可选 API key、强制指数退避与限流合规；**新增存量论文回填**；**抓取并存储引用图**（references + citations，含 contexts/intents/作者/链接）到 `paper_citations` 表；详情页展示引用数 / TL;DR。
- `paper-source-link`: 论文列表与详情页新增可点击的 **Semantic Scholar 来源标签**（与 arxiv 标签并列，有 corpus_id 时展示）。

## Impact

- **Backend**: 重写 `services/semantic_scholar_service.ts`（按 `ARXIV:{arxiv_id}` 查询、写回 `externalIds` 中所有可得 id、富化字段、`x-api-key` 头、指数退避）；`index.ts` 注册单个 `semanticScholarService`；`config.ts` 的 `serviceSchema` 增加可选 `api_key` / `api_key_env`，`packages/shared/src/types.ts` 的 `ServiceConfig` 同步；`service_runner.ts` 对 `corpus_id` 唯一约束写入做容错、并修复多 metadata 键写入互相覆盖的潜在 bug；新增**回填接口**（`api/services.ts`）。另新增 `paper_citations` 表（`db/schema.ts` + 迁移 `0009`）、引用图抓取（S2 `/references`+`/citations`，经共享限流门）、读取接口 `GET /api/papers/:id/citations`、删除级联清理、`PaperCitation` 类型（`packages/shared/src/types.ts`）。
- **Frontend**: 新增 `S2Badge` 组件（有 corpus_id 时渲染可点击标签），用于 `views/PaperList.vue` 卡片（`SourceTag` 旁）与 `views/PaperDetail.vue`（宽/窄屏，替换现有纯文本 "Corpus: {id}" Badge）；`PaperDetail.vue` metadata 区展示 `citation_count` / `influential_citation_count` / `tldr`；`views/ServiceDashboard.vue` 增"回填 S2 数据"按钮。
- **Config**: `config.yml` 已将 `semantic_scholar` 重命名为 `semantic_scholar_service`、设 `max_concurrency: 1` / `rate_limit_interval: 1` 并写入 `api_key`（本会话已完成）；`config.example.yml` 补充该块（含 `api_key_env` 注释）。
- **Docs**: 更新 `docs/frontend-architecture.md`（依赖图方向、service 声明、DB metadata 字段、服务名一致性、限流数值、回填与 S2 来源标签）、`docs/tech-stack.md`（S2 config 块、修正过时的 `semantic_scholar_service.test.ts` 引用）、`docs/external-api.md`（`/papers/full` 响应新增 S2 metadata 字段）。
- **External dependency**: Semantic Scholar Graph API（公共、只读、带可选 key），base URL `https://api.semanticscholar.org/graph/v1`。
