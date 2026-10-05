## Context

Paperland 当前以单篇论文为核心：`papers` 表存正式入库的论文，前端 `PaperList.vue`（路由 `/`，导航「论文管理」）做列表/筛选，`POST /api/papers` 通过 `arxiv_id` / `corpus_id` / manual 三种方式入库，入库后 `serviceRunner.triggerForPaper()` 触发依赖图服务补全基础字段。没有「会议」实体，也没有「先暂存、后入库」的草稿机制——所有论文一旦添加即进入正式库。

本变更新增一个与「论文管理」同级的会议页面，并引入一个**候选池**：抓取到的会议论文先落在候选池里（不进 `papers`），用户按主题浏览、确认后再「一键入库」。约束沿用项目既有约定：snake_case API、Drizzle/bun-sqlite、Fastify 插件式路由、Pinia store、入库链路复用 `paper_dedup` 与 `service_runner`。

## Goals / Non-Goals

**Goals:**
- 新增 `/conferences` 顶级页面（导航与「论文管理」同级），列表层支持按名称/时间筛选，点击进入详情。
- 会议详情页按 `topic` 分组展示候选论文，每篇展示标题、主题、来源（arxiv/openreview/semantic_scholar）、状态（待确认/候选中/已入库）。
- 上传预抓取 JSON → 候选池（草稿），初始状态「待确认」；支持确认为「候选中」。
- 「本次会议一键添加」批量把「候选中」论文入库，复用既有入库/去重/服务链路，入库后状态变「已入库」并关联 `papers.id`。
- 入库幂等：若候选论文对应的 arxiv/corpus 已存在于正式库，直接关联现有 paper 并标记「已入库」。

**Non-Goals:**
- 不抓取会议官网/榜单生成预抓取文件（文件由外部流程产出，本功能只负责上传解析）。
- 不为 OpenReview 新建专门抓取服务；OpenReview 来源以「manual + link」方式入库，后续仍走现有服务补全。
- 不复用全局 `tags` 系统作为会议主题（见 Decisions）。
- 不做候选论文的去重合并 UI（仅在入库时按 arxiv/corpus 幂等关联）。

## Decisions

### D1. 两张新表：`conferences` + `conference_papers`（候选池），不复用 `papers`
候选论文与正式论文语义不同（未入库、带会议/主题/状态、可能尚无完整元数据），且需要「不污染正式库」。因此用独立的 `conference_papers` 表承载候选池，入库后通过可空外键 `paper_id` 关联到 `papers`。

- `conferences`: `id`、`name`(not null)、`year`(int, nullable)、`start_date`/`end_date`(text ISO, nullable)、`location`(nullable)、`description`(nullable)、`link`(nullable)、`created_at`、`updated_at`。
- `conference_papers`: `id`、`conference_id`(FK→conferences.id, not null)、`title`(not null)、`topic`(text, nullable)、`authors`(text JSON, nullable)、`abstract`(nullable)、`source`(text, nullable: `arxiv`|`openreview`|`semantic_scholar`)、`external_id`(text, nullable)、`link`(nullable)、`status`(text not null default `pending`)、`paper_id`(int, nullable, FK→papers.id)、`metadata`(text JSON, nullable, 原始抓取数据)、`created_at`、`updated_at`。索引：`(conference_id, status)`。

**备选**：在 `papers` 上加 `status`/`conference_id` 列复用同一张表 → 否决：会让正式库混入未确认数据，破坏现有列表/服务/QA 的「papers 即已入库」假设。

### D2. 主题（topic）用 `conference_papers` 上的自由文本，不接入全局 tags
会议主题（生成式模型/对齐/安全/压缩…）来自预抓取文件，是会议内的分组维度，与用户私有的 `tags`（库内论文的标签、带 owner 与颜色）语义不同。用文本字段 `topic` 最简单，详情页按其值 `group by` 展示，`null`/空归入「未分类」。

**备选**：复用 `tags` + `paper_tags` → 否决：tags 绑定 `user_id` 且面向已入库论文，候选论文阶段尚无 `paper_id`，强行复用会引入空悬关联与权限复杂度。后续若需把会议主题沉淀为入库后的标签，可在 D5 入库时按 topic 自动打 tag（列为 Open Question）。

### D3. 状态机：`pending`(待确认) → `candidate`(候选中) → `ingested`(已入库)
- 上传后默认 `pending`。
- 用户「确认」（单个/批量）→ `candidate`；可逆（`candidate`→`pending`）。
- 「本次会议一键添加」只处理 `candidate` → 入库成功后置 `ingested` 并写 `paper_id`。`ingested` 为终态。
- 候选论文可被删除（仅删候选池记录，不影响已入库的 `papers`）。

「一键添加」默认目标是 `candidate`，符合用户「先进候选、确认后一键入库」的流程；UI 上可提供「全部确认」把 `pending` 批量提升为 `candidate`。

### D4. 上传格式：JSON，绑定到已选会议
导入端点 `POST /api/conferences/:id/papers/import`，body：
```json
{ "papers": [
  { "title": "...", "topic": "生成式模型", "source": "arxiv",
    "external_id": "2401.12345", "link": "https://...",
    "authors": ["A", "B"], "abstract": "..." }
] }
```
后端逐条插入 `conference_papers`（status=`pending`），整批放在一个事务里。`title` 必填，其余可空；`source` 不在枚举内则记为 `null` 并仍保留 `link`。前端先创建/选择会议再上传，避免文件里再带会议元数据的二义性。（文件内可选携带 `conference` 字段用于校验名称，但不作为创建来源。）

### D5. 一键入库复用现有 `POST /api/papers` 核心逻辑
把 `papers.ts` 中 `createFn`（dedup 检查 + insert + `triggerForPaper`）抽成可复用函数 `ingestPaper({ arxiv_id?, corpus_id?, title, authors?, link? })`，供 `POST /api/papers` 与会议入库共用。映射：`arxiv`→`arxiv_id`、`semantic_scholar`→`corpus_id`、`openreview`/未知→manual（title+authors+link）。`POST /api/conferences/:id/ingest`：
1. 取该会议 `status='candidate'` 的候选；
2. 对每条用 `withDedup` + `ingestPaper` 入库（命中已存在则取现有 paper）；
3. 置 `conference_papers.status='ingested'`、`paper_id=<id>`、`updated_at`；
4. 返回 `{ ingested: n, skipped: m, errors: [...] }`。
单条入库端点 `POST /api/conferences/:id/papers/:cpId/ingest` 复用同一逻辑。

### D6. Internal API 路由（`/api/conferences`，basic auth，snake_case）
- `GET /api/conferences?search=&year=&page=` — 列表（分页 + 名称/年份筛选），每项附 `paper_count` 与按状态计数。
- `POST /api/conferences` — 创建（name 必填）。
- `GET /api/conferences/:id` — 详情（含会议字段）。
- `PATCH /api/conferences/:id` / `DELETE /api/conferences/:id` — 编辑/删除（删除级联候选池记录，不删 `papers`）。
- `GET /api/conferences/:id/papers` — 候选论文列表（可按 topic/status 过滤；前端据此分组）。
- `POST /api/conferences/:id/papers/import` — 批量导入候选（D4）。
- `PATCH /api/conferences/:id/papers/:cpId` — 改 topic/status 等；支持 `{ status }` 流转、`{ ids:[], status }` 批量。
- `DELETE /api/conferences/:id/papers/:cpId` — 删候选。
- `POST /api/conferences/:id/ingest` — 一键入库（D5）。

### D7. 前端：两页 + 路由 + 导航 + store
- 路由：`/conferences`（name `conferences`）→ `views/ConferenceList.vue`；`/conferences/:id`（name `conference-detail`）→ `views/ConferenceDetail.vue`。
- 导航：`App.vue` 的 `navItems` 增加 `{ path: '/conferences', label: '会议', icon: <lucide icon, 如 CalendarDays> }`，置于「论文管理」之后，保持同级。
- store：`stores/conferences.ts`（fetchConferences / fetchConference / createConference / fetchCandidates / importPapers / updateCandidate(s) / ingestConference / deleteCandidate）。
- 组件：导入对话框（上传 JSON / 粘贴 JSON）、来源徽章、状态徽章、主题分组区块、「本次会议一键添加」按钮（带确认与结果反馈）。沿用现有 shadcn-vue / tailwind UI 风格。

## Risks / Trade-offs

- [候选池与正式库重复] 同一论文可能既在候选池又已在 `papers` → 入库时用 `withDedup` + arxiv/corpus 唯一约束幂等关联现有 paper，不新建；UI 可在列表上标注「库中已存在」。
- [topic 自由文本不一致]（「对齐」vs「Alignment」）导致分组碎片 → 上传时 trim/归一空白，详情页允许编辑 topic；不强制枚举。
- [OpenReview 无专用抓取服务] 以 manual 入库，基础字段可能不全 → 保留 `link` 与 `metadata`，入库后仍触发 service 依赖图按现有能力补全。
- [大文件批量导入] 一次上传上千条 → 单事务批量 insert；必要时分批；导入只写候选池（轻量），不触发服务，开销可控。
- [一键入库为多次外部抓取] 批量入库会排队大量 service 任务 → 复用 `service_runner` 既有并发/限流（`max_concurrency` / `rate_limit_interval`），入库接口异步触发、立即返回计数，不阻塞请求。
- [删除会议] 误删丢失候选池 → 删除需前端二次确认；只级联 `conference_papers`，绝不删除已入库的 `papers`。

## Migration Plan

1. 在 `schema.ts` 增加 `conferences`、`conference_papers` 两表（纯新增，不改既有表）。
2. `cd packages/backend && bunx drizzle-kit generate` 生成迁移；应用时仅 `CREATE TABLE`，对既有数据无影响，无需 backfill。
3. 回滚：删除两张新表 + 撤销前端路由/导航/页面即可，正式库 `papers` 不受影响。

## Open Questions

- 入库时是否按候选 `topic` 自动给正式论文打同名 tag？（默认否；可作为后续增强）
- 时间筛选以 `year` 为主，是否还需 `start_date/end_date` 范围筛选 UI？（schema 预留字段，首版列表筛选先做按年份）
- 预抓取 JSON 是否需要支持除 papers 数组外的多会议批量格式？（首版只支持「单会议 + papers 数组」）
