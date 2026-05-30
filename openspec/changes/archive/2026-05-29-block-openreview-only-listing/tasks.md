## 1. 共享判定 helper

- [x] 1.1 在 `packages/backend/src/utils/listing.ts` 新增 `isOpenreviewOnly(paper, openreviewLinkCount)` 与 `canList(paper, openreviewLinkCount)`：`hasArxiv = arxiv_id != null || host(link) === 'arxiv.org'`；`hasS2 = corpus_id != null`；`isOpenreviewOnly = openreviewLinkCount > 0 && !hasArxiv && !hasS2`
- [x] 1.2 增加一个统计某 paper OpenReview 链接数的查询 helper（`conference_papers` 中 `link` 非空、`paper_id = :id` 的行数），以及一个按一组 paper id 批量返回计数 Map 的版本（仿 `userTagsByPapers`）

## 2. 后端守卫：所有提升路径

- [x] 2.1 `PATCH /api/papers/:id`（`packages/backend/src/api/papers.ts`）：当 `listed === true` 且 `paper.listed === 0` 时，查 OpenReview 链接数；`!canList` 则返回 HTTP 422 `{ error: { code: 'LISTING_NOT_ALLOWED', message } }`，不写库、不触发 pipeline。`listed === false` 始终放行
- [x] 2.2 `PATCH /external-api/v1/papers/:id`：施加与 2.1 相同的守卫
- [x] 2.3 `packages/backend/src/services/ingest_paper.ts` 自动提升分支：仅当 `canList` 为真时才把既有 `listed=0` 翻转为 1
- [x] 2.4 `packages/backend/src/api/conferences.ts` 批量 ingest（约 `:390`）与候选关联提升（约 `:469`）：对每个待提升候选用 `canList` 过滤，不可列出者保持 `listed=false`（跳过），并在响应中返回被跳过的数量

## 3. API 派生 `listable` 字段

- [x] 3.1 `GET /api/papers/:id`：复用已查询的 `openreview_links`，计算并返回 `listable`
- [x] 3.2 `GET /api/papers`（列表）：对当前页 paper id 批量查 OpenReview 链接计数（单次查询，无 N+1），为每篇计算并返回 `listable`

## 4. 前端

- [x] 4.1 `packages/frontend/src/views/PaperList.vue`：未列出论文若 `listable === false`，禁用/隐藏"加入列表"控件并加 tooltip（说明仅有 OpenReview 链接、缺 arxiv/S2）
- [x] 4.2 `packages/frontend/src/stores/papers.ts`：`promote` 捕获 HTTP 422，提示后端返回的错误信息，保持本地状态不变
- [x] 4.3 （如详情页也有提升入口）`PaperDetail.vue` 同步处理 `listable` 与 422

## 5. 数据修正（回填）

- [x] 5.1 编写只读查询，列出当前 `listed=1` 且 OpenReview-only 的论文（含 217）：输出 id/title 清单供确认
- [x] 5.2 在托管 paper 217 的目标实例上，确认清单后将这些论文 `UPDATE papers SET listed=0`（217 必须被修正）

## 6. 测试

- [x] 6.1 在 `packages/backend/src/api/conferences.test.ts`（或新增 `papers.test.ts`）中覆盖：OpenReview-only 提升被拒（422）、有 corpus_id/arxiv_id 可提升、降级始终放行、纯标题论文不受影响、`listable` 字段在列表与详情中的取值。仅运行本地、不触达外部 API 的用例

## 7. 文档

- [x] 7.1 更新 `docs/external-api.md`：`PATCH /external-api/v1/papers/:id` 的 422 `LISTING_NOT_ALLOWED` 语义，以及响应中的 `listable` 字段
- [x] 7.2 更新 `docs/frontend-architecture.md`：列表/详情依据 `listable` 禁用提升控件、422 错误处理；并注明后端约定"凡置 `listed=true` 必经 `canList`"
