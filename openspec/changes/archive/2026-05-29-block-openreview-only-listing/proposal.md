## Why

由于一个 bug，paper 217（`https://paperland.dev.mem.ac/papers/217`）被错误地设置为 `listed=true`，但它只有 OpenReview 链接、既没有 `arxiv_id` 也没有 `corpus_id`。这类"只有 OpenReview 连接"的论文没有可抓取的规范来源，无法跑完整 pipeline（arxiv metadata/PDF、papers.cool、S2），不应进入列表。需要把 217 修正回 `listed=false`，并从源头堵住这类论文再次被列出。

## What Changes

- **数据修正**：把 paper 217 改回 `listed=false`；同时把所有处于相同"问题状态"的现存论文（`listed=true` 但只有 OpenReview 链接、无 `arxiv_id`/`corpus_id`）一并修正为 `listed=false`（应用时先列出受影响清单再执行）。
- **新增列表资格规则（后端守卫）**：当一篇论文有 OpenReview 链接、且既无 `arxiv_id` 也无 `corpus_id`（也无指向 arxiv.org 的 `link`）时，禁止把它设为 `listed=true`。该规则覆盖所有会把 `listed` 置为 `true` 的路径：`PATCH /api/papers/:id`、`PATCH /external-api/v1/papers/:id`、会议批量 ingest、会议候选关联提升、以及 `ingestPaper` 的"匹配既有元数据后自动提升"分支。
- **API 派生标志**：在论文 API 响应（列表与详情）中暴露一个派生布尔字段 `listable`，标识该论文是否允许被设为 `listed=true`，供前端使用。
- **前端体验**：对 `listable=false` 的论文，禁用/隐藏"加入列表"操作并给出提示；当提升请求被后端拒绝（HTTP 422）时显示明确错误。
- 设置 `listed=false`（降级/隐藏）始终允许，不受此规则限制。

## Capabilities

### New Capabilities
- `paper-listing-eligibility`: 论文能否被设为 `listed=true` 的资格规则 —— 后端在所有提升路径上的守卫、API 响应中的 `listable` 派生标志、对现存问题数据的回填修正，以及前端对不可列出论文的禁用提示。

### Modified Capabilities
<!-- 引入 listed/promote 行为的 add-staged-paper-ingest 变更尚未归档，openspec/specs/ 中没有可修改的归档 spec；本变更以新 capability 承载该规则。 -->

## Impact

- **后端**
  - `packages/backend/src/api/papers.ts` —— `PATCH /api/papers/:id` 提升守卫；列表与详情响应增加 `listable`。
  - 外部 API 论文编辑端点（`PATCH /external-api/v1/papers/:id`）—— 同样的守卫。
  - `packages/backend/src/api/conferences.ts` —— 批量 ingest 与候选关联提升路径的守卫。
  - `packages/backend/src/services/ingest_paper.ts` —— "匹配既有元数据后自动提升 listed=true"分支的守卫。
  - 新增一个共享判定 helper（如 `canList(paper, openreviewLinkCount)` / `isOpenreviewOnly(...)`），各路径复用。
- **前端**
  - `packages/frontend/src/views/PaperList.vue`、`packages/frontend/src/stores/papers.ts` —— 依据 `listable` 禁用"加入列表"按钮并处理 422 错误。
- **数据**：一次性回填，把现存"问题状态"论文（含 217）修正为 `listed=false`。
- **文档**：更新 `docs/external-api.md`（新增 422 拒绝语义、`listable` 字段）与 `docs/frontend-architecture.md`（前端禁用逻辑）。
