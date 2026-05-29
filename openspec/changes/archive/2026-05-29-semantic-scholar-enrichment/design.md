## Context

- **数据流现状**：论文几乎都来自 arxiv，创建时带 `arxiv_id`、不带 `corpus_id`。
- **依赖图调度（`service_runner.ts`）**：`getExistingKeys(paper)` 从 `arxiv_id`/`corpus_id`/`pdf_path` 顶层列 + `metadata` JSON 键 + `contents.*` 推导"已有键"。一个 paper-bound service 在「`depends_on` 全部已有」且「`produces` 未全部存在」时执行；若 `produces` 已全部存在则跳过并标记 done；若 `depends_on` 无任何服务可产出则标记 **blocked**；服务完成写入新键后会重新触发其它服务。
- **现有 S2 服务方向相反**：声明 `depends_on: [corpus_id]` / `produces: [arxiv_id]`。arxiv 论文无 `corpus_id` 且无服务产出它 → 永远 **blocked**，S2 数据从不抓取。
- **配置错配 bug**：`config.yml` 键名 `semantic_scholar`，代码注册名 `semantic_scholar_service`。`initialize()` 按 config 键建限流器，`register()` 发现服务名无对应项 → 赋默认 `max_concurrency: 2` 且 `RateLimiter(0)`（无限流）。故配置的 `5/1` 从未生效。
- **S2 API 实测与限流**（依据 AllenAI 官方 `s2-folks` 文档）：
  - `GET /graph/v1/paper/ARXIV:{id}?fields=externalIds,...` 单次返回 `externalIds.CorpusId` + `citationCount`/`influentialCitationCount`/`tldr`/`venue`/`year`/`fieldsOfStudy`/`references` 等——**arxiv → corpus 可直接打通**。
  - 无 key：5,000 请求 / 5 分钟，全体匿名用户**共享一个池**（易 429）。带 key：默认 **1 RPS（所有端点）**。**强制要求指数退避**；无 `Retry-After`；鉴权头 `x-api-key`。
- **现有 UI / 接口**：`SourceTag.vue` 在论文列表（`PaperList.vue:190`）与详情页（`PaperDetail.vue`）展示 arxiv 来源标签；详情页另有纯文本 `Corpus: {id}` Badge（非链接）。`paper-source-link` 能力管辖来源标签展示。已有触发接口 `POST /api/papers/:id/services/trigger`（整篇重跑）与 `.../:serviceName/trigger`（单服务）。

## Goals / Non-Goals

**Goals:**
- 每篇带 `arxiv_id` 的论文添加后，经依赖图**自动**抓取 S2 数据（corpus_id + 引用富化）。
- 查询 S2 后把响应中能拿到的 id 一并写回（arxiv 论文即补全 corpus_id）；拿到几个 id 存几个。
- 修正服务名错配使限流/并发生效；按 S2 要求加入指数退避；支持可选 API key。
- **回填存量** arxiv 论文的 S2 数据并入库。
- 论文**列表与详情**新增可点击 S2 来源标签；详情页展示引用数 / influential / TL;DR。
- **抓取并存储引用图**（references + citations，含 contexts/作者/链接）到 `paper_citations` 表，供之后使用。

**Non-Goals:**
- 反向 `corpus_id → arxiv_id` 解析：只凭 corpus_id 添加的论文保持单 id，不强求补全 `arxiv_id`（按用户要求）。
- 引用图的**翻页/全量**抓取与图谱遍历：每方向只存第一页；引用图的前端展示也留作后续（本次仅抓取 + 存储 + 读取接口）。
- 用 `openAccessPdf` 作非 arxiv PDF 兜底；使用 batch/search 端点。

## Decisions

### 1. 主方向 `arxiv_id → corpus_id + 富化`
`semantic_scholar_service`: `depends_on: ['arxiv_id']`，`produces: ['corpus_id','citation_count','influential_citation_count','references']`，按 `ARXIV:{id}` 查询。
- **把富化键也放进 `produces`**：若论文同时带两个 id 但缺引用数据，仅声明 `corpus_id` 会让调度器判定"produces 已全"而跳过、永不富化；纳入 `citation_count` 等可保证缺字段时重跑。`getExistingKeys` 读 metadata 键，存在性可被探测。
- **为何 produces 不含 `tldr`**：runner 写入时跳过 `null`/`undefined`，而 S2 的 `tldr` 常常缺失；若把 tldr 放进 produces，缺 tldr 的论文会"produces 永不齐全"而每次重触发都重抓。故 produces 只取成功时必写、不会为空的四个键（`citation_count`/`influential_citation_count` 用 `?? 0`、`references` 用 `[]` 兜底），`tldr` 等仅在存在时写入 metadata、不参与依赖判定。

### 2. 单一服务 + 写回所有可得 id（按用户反馈简化）
- 只注册一个 paper-bound 服务（`depends_on: ['arxiv_id']`），**无**专门反向解析服务。
- **写回策略**：用论文已有的 `arxiv_id` 查询 S2，把响应 `externalIds` 中能拿到的 id（即 `corpus_id`）一并写回——arxiv 论文于是"两个 id 都有就都存"。S2 只返回一个 id 时保留原有的，不报错、不强求。
- 只凭 `corpus_id` 添加的论文：主服务 `depends_on=arxiv_id` 未满足，不运行，保持单一 corpus_id。这是用户明确接受的（单 id 即保留）。代价：这类论文不会自动进入 arxiv PDF/解析链；鉴于 arxiv 为绝对主源、corpus-only 摄入罕见，可接受，未来可补。
- **备选（拒绝）**：为 corpus-only 论文加第二个反向服务——两个独立服务名 = 两个独立限流器，合计可能达 2 RPS、超限；需引入共享限流桶等额外复杂度。用户已表示"单 id 不用担心"，故不做。

### 3. 鉴权与退避
- 修正 `config.yml` 服务名为 `semantic_scholar_service`，使配置生效。
- `serviceSchema` 增加可选 `api_key`（字面量；`config.yml` 已 gitignore）与 `api_key_env`（环境变量，沿用 models 习惯）；都存在时优先 `api_key`，都没有则匿名请求。存在时按 `x-api-key` 头发送。
- 新增 `fetchS2WithBackoff`：对 429/5xx 指数退避 + 抖动（若响应带 `Retry-After` 则优先），403（key 无效）直接抛错不退避。
- 默认配置：带 key `rate_limit_interval: 1` / `max_concurrency: 1`；无 key 建议 `interval: 3`（`config.example.yml` 注释）。

### 4. 字段映射与写入安全
- 调用：`GET /paper/{ARXIV:id}?fields=externalIds,title,abstract,authors,citationCount,influentialCitationCount,references.title,references.year,tldr,venue,year,publicationVenue,fieldsOfStudy,publicationDate`。
- 映射：把 `externalIds` 中本论文尚缺的 id 写回（`corpus_id` 数字转字符串 → 顶层列）；`citation_count`/`influential_citation_count`/`references`(`paper_id`,`title`,`year`)/`tldr`(取 `.text`)/`venue`/`year`/`doi`(`externalIds.DOI`)/`fields_of_study`/`s2_url`（由 `data.paperId` 构造 `https://www.semanticscholar.org/paper/{paperId}`）→ `metadata`。**缺失字段跳过**（拿到什么存什么）。基础字段 title/abstract/authors 复用 runner "仅空填充"，不覆盖 arxiv 已填。
- **`corpus_id` 唯一约束**：`papers.corpus_id` 为 UNIQUE。若解析到的 corpus_id 已被他行占用，直接写入会抛错使整次执行失败。决策：写入前查重，冲突则**跳过 corpus_id 写入但仍保存其余富化**并记录，不让整次执行失败。
- **多字段写入累积（runner 修复，实测发现）**：`service_runner` 旧逻辑对每个 metadata 键都**重新读库**再写回 `updates.metadata`，导致一次执行写多个 metadata 键时只有**最后一个**键存活（实测中 `citation_count`/`tldr` 等被最后的 `s2_url` 覆盖、变为 null）。改为执行前读论文**一次**、循环内累积到单个 `metadata`/`contents` 对象、最后只写一次。此为对所有服务通用的正确性修复。

### 5. 存量回填
- **机制**：新增内部接口 `POST /api/services/backfill/semantic_scholar_service`，查询"`arxiv_id` 非空且 metadata 缺 `citation_count`（即未富化或仅部分富化）"的论文，逐篇 `serviceRunner.executeServiceForPaper('semantic_scholar_service', id)`（fire-and-forget；runner 的信号量 + 限流器保证按 1 RPS 串行）。返回入队数量。
- **为何按"缺 citation_count"过滤**：`executeServiceForPaper` 不检查 `produces` 是否已存在、会直接发请求；以 `citation_count`（成功富化必写的键）是否存在为准，既避免对已富化论文重复请求，又能**自愈**只拿到 corpus_id 但富化不全的论文。（对照：`triggerForPaper` 会按 `produces` 跳过，但也会顺带触发 `papers_cool` 等其它服务带来副作用，故不用它做 S2 专项回填。）
- **入口**：服务管理页 `ServiceDashboard.vue` "回填 S2 数据"按钮；进度经既有 `service_executions` 列表可见。（亦可做成 CLI 脚本，可选。）

### 6. 前端 S2 来源标签与富化展示
- 新增 `S2Badge.vue` 组件：有 `corpus_id` 时渲染可点击标签（类似 `SourceTag`），跳转 `metadata.s2_url`，回退 `https://www.semanticscholar.org/paper/CorpusID:{corpus_id}`。
- 用于：`PaperList.vue` 卡片（`SourceTag` 旁）、`PaperDetail.vue` 宽/窄屏（把现有纯文本 `Corpus: {id}` Badge 换成可点击 S2 标签）。列表 API 已返回 `corpus_id` 与 `metadata`，无需后端改动。
- 详情页 metadata 区展示 `citation_count` / `influential_citation_count` Badge 与 `tldr` 小块；字段缺失则不渲染。

### 7. 引用图抓取与存储（按用户要求）
- **数据**：调用 S2 `/paper/ARXIV:{id}/references` 与 `/citations`（只有这对 dedicated 边端点才返回 `contexts`/`intents`/`isInfluential` —— 即"是在哪里进行的引用"），各取**一页**（`limit=1000`，按用户"第一页所传的那些"决定，不翻页）。每条边存：对方论文 title/authors/year/venue/externalIds(arxiv/doi/corpus)/url，及 contexts/intents/is_influential。
- **存储**：新建 `paper_citations` 表（迁移 `0009`），每行一条边、`direction` 区分方向；不放进 metadata（避免拖慢论文列表，且可查询/可扩展）。读取接口 `GET /api/papers/:id/citations`。
- **限流**：一次执行发 3 个 S2 请求（主 + refs + citations）；引入模块级共享限流门 `rateGate()`（按 `rate_limit_interval`），保证所有 S2 调用合计 ≤ 1 RPS（在 runner 的 per-execute 限流之外再加一道，覆盖单次执行内的多请求）。
- **健壮性**：引用图抓取 best-effort（每方向 try/catch），失败只记日志、不影响主富化；重跑按方向先删后插，幂等。
- **回填衔接**：回填资格改为"缺 `citation_count` **或** 无 paper_citations 行"，使已富化的存量论文也会被重跑以补全引用图。

## Risks / Trade-offs

- **[Trade-off] 引用图只存第一页**：高被引论文（如 17 万次）只保留前 ~1000 条被引；真实总数见 `citation_count`，未翻页（响应 `next` 可见但不追）。
- **[Risk] 单次执行 3 个 S2 请求**：经共享 `rateGate` 串行（≥1s/请求），回填每篇约 3s。
- **[Risk] 带 key 仅 1 RPS** → 单服务 + `max_concurrency: 1` + `interval: 1`；回填经 runner 串行不突发。
- **[Risk] 回填量大耗时（1/sec）** → 合规且可接受；进度经 `service_executions` 可见，失败可重试。
- **[Risk] 无 key 落入匿名共享池频繁 429** → 强制指数退避 + 默认 `interval: 3`；失败照常记入 `service_executions`。
- **[Risk] `corpus_id` 唯一约束冲突** → 写前查重，冲突跳过该字段、保留其余富化，不失败整次执行。
- **[Risk] S2 网站 URL 形式** → 优先存并使用 `s2_url`（由 `paperId` 构造），回退 `CorpusID:` 形式；实现时验证可达。
- **[Risk] S2 标题/摘要与 arxiv 不一致** → 基础字段仅空填充，不覆盖 arxiv 论文。
- **[Trade-off] corpus-only 论文不解析 arxiv_id** → 不进入 PDF/解析链；corpus-only 摄入罕见，用户接受。
- **[Trade-off] 富化存 `metadata` JSON 而非规范化列** → 满足展示，不可排序/筛选；可接受。
- **[Risk] API key 是密钥** → `config.yml` 已 gitignore（`.gitignore:11`），保留 commit 安全检查；同时支持 `api_key_env` 以便不落盘。

## Migration Plan

- **DB 迁移**：新增 `paper_citations` 表（迁移 `0009`，启动时 `migrate()` 自动应用）；`corpus_id`/`metadata` 列已存在、无改动。
- **部署**：服务器重启会把遗留 `pending`/`running` 执行重置为 failed（`index.ts` 既有逻辑）；旧 `blocked` S2 执行不再产生。新加论文自动富化；**手动触发一次回填**补全存量。
- **回滚**：还原 `semantic_scholar_service.ts` 与 `config.yml` 服务名即可；`metadata` 写入是增量的，无数据损失。

## Open Questions

- 超大论文库的回填是否需要分批/断点续跑/进度汇总？当前依赖 runner 串行 + `service_executions` 可见即可；如确有需要可后续增强。
- 是否进一步抓取入引（`citations`）或把 `openAccessPdf.url` 作为非 arxiv PDF 兜底？（未来可选，非本次范围。）
