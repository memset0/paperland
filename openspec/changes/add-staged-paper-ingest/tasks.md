## 1. Schema 与 ingest 入参

- [x] 1.1 `packages/backend/src/db/schema.ts`：`papers` 表新增 `listed: integer('listed').notNull().default(1)`
- [x] 1.2 生成迁移：`cd packages/backend && bunx drizzle-kit generate`，确认是 `ALTER TABLE papers ADD COLUMN listed INTEGER NOT NULL DEFAULT 1`（存量行自动回填 1）
- [x] 1.3 `packages/shared/src/types.ts` 的 `Paper` 增 `listed: boolean`
- [x] 1.4 `services/ingest_paper.ts`：`IngestPaperInput` 增 `listed?: boolean`（默认 `true`）；插入新论文时写入 `listed`；合并到已有论文时**不**降级其 `listed`（已列出的不因再次 metadata-only ingest 变隐藏）

## 2. 服务定义：requires_listed

- [x] 2.1 `services/base_service.ts`：`PaperBoundServiceDef` 增可选 `requires_listed?: boolean`
- [x] 2.2 标记 `arxiv_metadata_service`、`arxiv_pdf_service`（`arxiv_service.ts`）、`papers_cool`（`papers_cool_service.ts`）、`pdf_parse_service`（`pdf_parse_service.ts`）为 `requires_listed: true`
- [x] 2.3 确认 `semantic_scholar_service` **不**标 `requires_listed`

## 3. 调度门禁与提升重触发

- [x] 3.1 `services/service_runner.ts`：`triggerForPaper` 调度时新增门禁——`requires_listed` 服务在 `paper.listed` 为假时记为 `deferred`（新状态）、不执行；其余逻辑（depends_on/produces、skip-already-complete、blocked）不变
- [x] 3.2 `executeServiceForPaper` 的依赖级联触发处同样尊重该门禁（不把 deferred 服务当作可触发依赖）
- [x] 3.3 `deferred` 状态接入 `service_executions` 展示（服务管理页/重试逻辑不把 deferred 当失败）
- [x] 3.4 提升流程：`listed` false→true 时调用 `triggerForPaper(paperId)` 重跑（deferred 服务此时执行；produces 已存在的被跳过）

## 4. S2 优先元数据

- [x] 4.1 `services/semantic_scholar_service.ts`：富集时把 S2 返回的 `title`/`authors`/`abstract` 在论文对应字段为空时填入（不覆盖已有）
- [ ] 4.2（可选）支持以 `corpus_id` 为 key 取 S2 数据（应对无 arxiv 的论文）；否则文档标注此类暂留手动

## 5. arxiv 退兜底

- [x] 5.1 `services/arxiv_service.ts`：`arxiv_metadata_service` 仅补缺（S2 已填则不覆盖）并产出 `link`
- [ ] 5.2（可选）`arxiv_pdf_service` 优先用 `paper.metadata` 中 S2 的 `openAccessPdf.url` 作为 PDF 来源，无则回退 arxiv 下载

## 6. 列表按 listed 过滤

- [x] 6.1 `api/papers.ts`：`GET /api/papers` 增 `listed` 模式参数（`listed`(默认) / `unlisted` / `all`）——默认仅 `listed=1`，`unlisted` 仅 `listed=0`，`all` 不限；搜索/标签筛选在所选模式内生效（`GET /api/papers/:id` 直链**不**过滤）
- [x] 6.2 `external-api/papers.ts`：`GET /papers`、`/papers/full`、`/papers/batch` 的列表查询加 `listed` 过滤
- [x] 6.3 `api/idea-forge.ts` paper dump 候选选取按 `listed=1` 过滤
- [x] 6.4 核对其它论文列表出口（如有）补过滤

## 7. 提升（加入列表）端点

- [x] 7.1 `api/papers.ts`：支持 `PATCH /api/papers/:id { listed: true }`（或新增 `POST /api/papers/:id/list`），`requireUser`，置 `listed=1` 并 `triggerForPaper`；幂等

## 8. 会议候选解析

- [x] 8.1 `services/`：新增按标题调用 S2 `paper/search/match?query=&fields=title,externalIds,corpusId,matchScore` 的解析函数，复用 S2 的 `x-api-key` 与限速（经 service runner 限速通道，避免 429）
- [x] 8.2 `api/conferences.ts`：新增 `POST /api/conferences/:id/resolve`（`requireUser`）——对 `paper_id IS NULL` 的候选逐条解析；命中且分数达标 → `ingestPaper({arxiv_id,corpus_id,title,authors,link,listed:false})` → 回填 `conference_papers.paper_id`、把 `matchScore`/匹配标题写入 `metadata`；未命中保持 `paper_id` NULL
- [x] 8.3 会议候选状态改为派生（读 `GET /api/conferences/:id/papers` 时 JOIN `papers.listed`）：`paper_id` NULL→待添加；`listed=0`→已索引（仅元数据）；`listed=1`→已加入。弃用/停写 `pending/candidate`
- [x] 8.4 "加入列表"动作：对候选的 `paper_id` 论文走第 7 步 promote

## 9. 前端（会议页 + 论文详情）

- [x] 9.1 `views/ConferenceDetail.vue` + `stores/conferences.ts`：候选列表展示派生状态（待添加 / 仅元数据 / 已加入）、匹配分数/标题；"解析"按钮（触发 resolve）、单条/批量"加入列表"按钮
- [x] 9.2 `views/PaperList.vue`：新增视图模式切换（listed 默认 / unlisted / 全部，传 `listed` 参数）；`listed=false` 行**不可点击进详情**，改为行内"抓取"按钮（调 promote → 抓取后可进详情）；`listed=true` 行行为不变
- [x] 9.3 `views/PaperDetail.vue`：对经直链/会议进入的 `listed=false` 论文显示"加入列表/抓取"动作（promote）

## 10. 文档

- [x] 10.1 `docs/tech-stack.md`：Drizzle schema 概览 `papers` 增 `listed` 列说明
- [x] 10.2 `docs/frontend-architecture.md`：新增"两层论文（已列出 vs 仅元数据）/ 会议候选 S2 解析 / 全局可见性 / 服务按 listed 门禁与提升"章节
- [x] 10.3 `docs/external-api.md`：注明 `GET /papers` 等列表仅返回 `listed=true` 论文

## 11. 验证

- [x] 11.1 从项目根 `bun run packages/backend/src/index.ts` 启动，确认迁移加上 `papers.listed`、存量论文均为 `listed=1`、`packages/backend/data/` 未被误创建
- [x] 11.2 兼容性：常规添加一篇 arxiv 论文（默认 listed=1）→ 完整管线照常跑、出现在列表；现有论文行为不变
- [x] 11.3 metadata-only：以 `listed:false` ingest 一篇 → 只跑 S2（basic fields/abstract/引用图就位）、arxiv/pdf/papers.cool 为 `deferred`、不在论文列表出现、可直链访问
- [x] 11.4 提升：对该隐藏论文 promote → deferred 服务触发、PDF/解析就位、进入列表；S2 不重复跑
- [x] 11.5 会议解析：对已导入的 "MLSys 2026"（id=1，77 条候选）跑 `resolve`，确认大部分命中并建出 `listed=false` 论文 + 回填 `paper_id` + 缓存 matchScore；相同论文去重合并；未命中留待添加（限速无 429）
- [x] 11.6 列表过滤核对：External API `GET /papers`、idea-forge dump、标签筛选均不返回 `listed=0` 论文
- [x] 11.7 仅运行本次涉及且不烧外部额度的后端单测；**不要盲跑全部测试**（部分会调用真实 arxiv/S2/OpenAI）
