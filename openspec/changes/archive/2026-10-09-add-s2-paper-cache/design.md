## Context

- `semantic_scholar_service.ts` 已有模块级共享限流 `rateGate()` 与带退避的 `s2Get()`，只支持 GET。S2 的 batch 接口是 `POST /graph/v1/paper/batch?fields=...`，body 为 `{"ids": [...]}`，单次最多 500 个 id。id 可以写成 40 位 paperId 或 `CorpusId:<n>`，返回数组与请求一一对应，查不到的位置是 `null`。
- `utils/s2_ids.ts` 已有 S2 id/URL 的规范化工具（add-s2-paper-id）。
- `qa_cites.ts` 的 `extractCiteLinks()` 能提取回答中的 `#cite:` id；`api/qa.ts` 在回答 done 后调用 `recordUnknownCites()`。
- 论文库 `papers` 表已有 `s2_paper_id` / `corpus_id`（唯一），年份、venue、被引数等在 `metadata` JSON 中。

## Goals / Non-Goals

**Goals:**
- 一个可被后续「回答引用面板」与「Deep Research」复用的后端解析服务 + HTTP 接口。

**Non-Goals:**
- 不改前端，也不改 `#cite` chip 的渲染（交给变更 ②）。
- 不把缓存论文自动入库；不缓存引用图谱（references/citations 边）。
- 不改 `qa_result_cites` 的写入逻辑。

## Decisions

- **独立缓存表 `s2_papers`，而非复用 `papers`（listed=0）**：`papers` 行会进入服务调度、去重、用户库等流程，把被引论文都塞进去会污染论文库，也会触发不该有的抓取。缓存表只存元数据，没有副作用。
- **以 `s2_paper_id` / `corpus_id` 两个唯一列定位，并用 `status` 区分负缓存**：S2 返回的成功记录同时带两种 id，写入时按任一 id upsert。查不到的 id 只记录被请求的那一种 id，`status = 'not_found'`。
- **每次请求把缺失 id 合并成一次 batch 调用**：相比逐个 GET，1 RPS 下延迟从 N 秒降到约 1 秒。新增 `s2Post()`，复用 `rateGate()`、API key 和退避逻辑（把共用部分抽成内部函数），保证所有 S2 调用共用同一个限流。
- **batch 请求的字段**：`paperId,externalIds,title,authors,year,venue,abstract,tldr,citationCount,influentialCitationCount,referenceCount,publicationDate,url,openAccessPdf`。
- **同一个 id 的并发解析去重**：服务内维护 `inflight: Map<key, Promise>`，避免预热和前端请求同时抓同一个 id。
- **论文库优先**：命中论文库时直接从 `papers` 行映射元数据（`metadata.year/venue/citation_count` 等），不读缓存也不发请求，保证与站内论文数据一致。
- **匿名不出网**：接口对匿名开放，因为回答本身对匿名可读；但只有登录用户的请求会触发外部抓取，防止被匿名滥用。
- **预热**：在 `api/qa.ts` 现有 `recordUnknownCites` 之后，fire-and-forget 调用 `warmCites(answer)`，有 `.catch` 记日志。所有 cite id 都预热（包括已在 `paper_citations` 中的），这样后续面板拿到的是完整元数据（被引数、摘要）。
- **配置**：在 `config.ts` 中新增 `s2_cache`，用 `.default({ttl_days: 30, not_found_ttl_days: 7, max_ids_per_request: 200})` 显式写出默认值（避开 Zod `.default({})` 不填内层默认值的坑）。

## Risks / Trade-offs

- [缓存中的被引数会过时] → 30 天 TTL 可配置；论文库论文仍以库内数据为准。
- [单次 resolve 请求中缺失很多 id 时需要等 S2] → batch 一次最多 500 个，`max_ids_per_request` 默认 200，最坏情况约为一次请求加退避的耗时。
- [与其他 agent 并行开发的迁移编号冲突（工作区中已有未提交的 `0031_user_papers`）] → 用 drizzle-kit 生成下一个编号；提交前确认 0031 已提交，若未提交则先报告，不连带提交。

## Migration Plan

新增表的迁移为纯增量，可直接上线；回滚时删除该表即可，不影响其他数据。
