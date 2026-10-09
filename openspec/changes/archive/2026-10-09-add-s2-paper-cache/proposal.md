## Why

QA 回答（以及后续的 Deep Research 论文列表）会用 `#cite:<id>` 引用大量 Semantic Scholar 论文，其中很多并不在论文库中，也不在当前论文的 `paper_citations` 里。目前这些 id 只被记录到 `qa_result_cites`，没有任何元数据；要展示它们就只能反复请求 S2（默认 1 RPS）。需要一个持久的 S2 论文元数据缓存和统一的 id 解析接口，作为「回答引用面板」与「Deep Research 页面」两个后续变更的基础。

## What Changes

- 新增 `s2_papers` 缓存表：按 S2 paperId / CorpusId 存储未必入库的论文元数据（标题、作者、年份、venue、摘要、TLDR、被引数、外部 id、开放获取 PDF 链接等），以及抓取时间和状态（`ok` / `not_found`）。
- 新增统一解析接口 `POST /api/s2/papers/resolve`：输入一组 id（40 位十六进制 paperId、纯数字 CorpusId、`CorpusId:<n>`、S2 URL），按「论文库 → 新鲜缓存 → S2 batch API」逐级解析，返回每个 id 的元数据、来源、`library_paper_id`。未命中缓存的 id 合并为一次 S2 `POST /paper/batch` 请求，并经过现有 S2 共享限流与退避。整块 id 都不存在时 S2 会返回 400，此时降级为逐个查询，查不到的记为负缓存。
- 缓存过期策略：成功条目 `ttl_days`（默认 30 天）后视为过期并在下次解析时重新抓取，抓取失败时退回旧数据；`not_found` 负缓存 `not_found_ttl_days`（默认 7 天）内不再请求。配置放在 `config.yml` 新增的 `s2_cache` 块中。
- 匿名请求只读论文库与缓存，不触发外部请求；登录用户的请求会抓取缺失项。
- QA 回答完成时，后台对回答中出现的所有 `#cite:` id 做一次缓存预热（不阻塞回答完成，失败只记日志）。
- **删除 `qa_result_cites` 表**（实现中按用户要求追加）：它只是从回答 Markdown 派生、按论文过滤的「列表外 cite」副本，原本留待以后批量查元数据——现由本缓存与预热取代，且 cite 应独立于所属论文。删除表（迁移 `0033_drop_qa_result_cites`）、`recordUnknownCites`、删论文时的级联清理；`extractCiteLinks` 保留供预热使用。
- 文档：`docs/frontend-architecture.md`、`docs/tech-stack.md`、`docs/external-api.md`（说明 External API 不变）同步更新；`config.example.yml` 增加 `s2_cache`。

## Capabilities

### New Capabilities

- `s2-paper-cache`: 未入库 S2 论文元数据的持久缓存、过期与负缓存策略、统一 id 解析接口，以及 QA 回答完成后的缓存预热。

### Modified Capabilities

- `database-schema`: 新增 `s2_papers` 缓存表；删除 `qa_result_cites` 表及论文级联删除中的对应步骤。
- `paper-delete`: 删除论文的级联顺序去掉 `qa_result_cites`。

## Impact

- **DB**：新迁移（新增表，纯增量）。
- **Backend**：`services/semantic_scholar_service.ts`（抽出可复用的 batch 请求，复用共享限流）、新 `services/s2_paper_cache.ts`、新 `api/s2.ts`、`api/qa.ts`（完成后预热）、`config.ts`、`index.ts`。
- **Shared**：新增 `S2PaperMeta` / `S2ResolveResult` 类型。
- **Frontend**：本变更不改 UI（由后续「回答引用面板」变更使用）。
- **外部**：对 S2 的请求改为批量，整体请求量下降。
