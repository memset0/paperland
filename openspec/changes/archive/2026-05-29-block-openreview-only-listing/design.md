## Context

`papers.listed`（integer 1/0）是全局可见性开关：`listed=true` 表示进入列表并跑完整抓取 pipeline，`listed=false` 表示仅元数据（隐藏，主要由 Semantic Scholar 填充）。论文的规范来源身份有两个一等字段：`papers.arxiv_id` 与 `papers.corpus_id`。**OpenReview 链接不在 `papers` 表上**，而是存于 `conference_papers.link`（一篇论文可对应多行 / 多次投稿），仅在 `GET /api/papers/:id` 中以 `openreview_links[]` 返回。

会议候选解析流程（`add-staged-paper-ingest` / `conference-paper-resolution`）的设计是：候选先以 `listed=false` 落库，解析到 S2 的 `corpus_id`（可能附带 `arxiv_id`）后再人工提升为 `listed=true`。但存在一条 bug 路径，使得只有 OpenReview 链接、没有 `arxiv_id`/`corpus_id` 的论文（如 paper 217）被置为 `listed=true`。这类论文没有可抓取的规范来源，pipeline 无法推进，进入列表是错误状态。

设置 `listed=true` 的代码路径（均需被守卫覆盖）：
- `PATCH /api/papers/:id`（`packages/backend/src/api/papers.ts:175`）—— 用户提升，且 `listed=true` 时触发 `serviceRunner.triggerForPaper`。
- 外部 API `PATCH /external-api/v1/papers/:id` —— 同样接受 `listed`。
- `packages/backend/src/services/ingest_paper.ts` —— 创建时显式传入 `listed`，以及"新 ingest 命中既有 `listed=0` 论文时自动翻转为 1"的分支。
- `packages/backend/src/api/conferences.ts` —— 批量 ingest（`:390`）与候选关联提升（`:469`）。

## Goals / Non-Goals

**Goals:**
- 把 paper 217 以及所有相同问题状态的现存论文修正为 `listed=false`。
- 从源头堵住：任何"OpenReview-only"论文（有 OpenReview 链接、且无 `arxiv_id`/`corpus_id`）都不能被设为 `listed=true`，覆盖全部提升路径。
- 在 API 响应中暴露派生的 `listable` 标志，前端据此禁用"加入列表"操作。

**Non-Goals:**
- **不**改成"任何论文都必须有 arxiv/s2 才能列出"的更严格规则 —— 手动添加的纯标题 / 纯链接论文（无 OpenReview 链接）保持现状，仍可被列出（已与用户确认采用"仅拦 openreview-only"方案）。
- 不改动 `conference_papers` schema、候选解析逻辑或 S2 抓取。
- 不引入 DB 迁移（无需新增列；`listable` 是运行时派生，不落库）。

## Decisions

### 决策 1：判定谓词 —— 何为 "OpenReview-only / 不可列出"
定义一个共享 helper（放在 backend 工具层，如 `packages/backend/src/utils/listing.ts`）：

```
isOpenreviewOnly(paper, openreviewLinkCount):
  hasArxiv  = paper.arxiv_id != null || hostOf(paper.link) === 'arxiv.org'
  hasS2     = paper.corpus_id != null
  return openreviewLinkCount > 0 && !hasArxiv && !hasS2

canList(paper, openreviewLinkCount) = !isOpenreviewOnly(paper, openreviewLinkCount)
```

- "有 arxiv 链接"既认 `arxiv_id`，也认 `link` 主机名为 `arxiv.org`（与 `SourceTag.vue` 的来源识别一致），避免误伤 `link` 指向 arxiv 但 `arxiv_id` 尚未回填的论文。
- "有 OpenReview 链接" = 该论文在 `conference_papers` 中存在 `link` 非空的行（`openreviewLinkCount > 0`）。
- **替代方案（否决）**：直接要求"必须有 arxiv_id 或 corpus_id 才能列出"。更简单，但会拦下手动纯标题论文，与用户意图不符。

### 决策 2：守卫的施加位置 —— 集中谓词、分散校验
不试图用一个中间件拦截所有路径（各路径数据来源不同、有的批量），而是让每条把 `listed` 置 true 的路径在写库前调用同一个 `canList` helper：
- `PATCH /api/papers/:id`：当请求 `listed === true` 且当前 `paper.listed === 0`（即真正发生提升）时，查询该论文的 OpenReview 链接数，`!canList` 则返回 **HTTP 422**（错误码 `LISTING_NOT_ALLOWED`），不写库、不触发 pipeline。`listed === false` 始终放行。
- 外部 API edit 端点：同上。
- 会议批量 ingest / 候选关联：对每个待提升候选用 `canList` 过滤；不可列出的候选保持 `listed=false`（跳过提升），并在结果中如实反映被跳过的数量，而非静默丢弃。
- `ingest_paper.ts` 自动翻转分支：仅当 `canList` 为真时才把既有 `listed=0` 翻转为 1。

### 决策 3：`listable` 派生标志进入 API 响应
- `GET /api/papers/:id`：已查询 `openreview_links`，直接据此计算 `listable` 并返回。
- `GET /api/papers`（列表）：当前不查 OpenReview 链接。仿照 `userTagsByPapers` 的批量做法，对当前页 paper id 一次性查询 `conference_papers` 中 `link` 非空的计数，再为每篇计算 `listable`。避免 N+1。
- `listable` 仅在运行时计算，不落库、不加列、不需要迁移。

### 决策 4：现存问题数据的回填
应用阶段先以只读查询列出"`listed=1` 且 OpenReview-only"的论文清单（含 217）供确认，再批量 `UPDATE papers SET listed=0`。回填针对的就是守卫所禁止的同一条件，逻辑自洽。

### 决策 5：前端
- 列表/详情拿到 `listable=false` 时，把"加入列表"按钮禁用并加 tooltip（说明：仅有 OpenReview 链接、缺少 arxiv/S2，无法加入列表）。
- `stores/papers.ts` 的 `promote` 捕获 422，向用户提示后端返回的错误信息，并保持本地状态不变。

## Risks / Trade-offs

- **[回填误伤合法论文]** 某些论文也许本该有 arxiv_id 但尚未被 S2/arxiv 回填，被误判为 OpenReview-only 而下架 → 缓解：回填前打印受影响清单供人工确认；且这类论文当前确实无法跑 pipeline，下架后一旦补上 `corpus_id`/`arxiv_id` 即可正常提升。
- **[列表查询多一次 join]** 列表响应需额外查询 `conference_papers` 计数 → 缓解：按页批量单查（与 user-tags 同模式），开销可忽略。
- **[多路径遗漏]** 新增的提升路径若未走 helper 会绕过守卫 → 缓解：谓词集中在单一 helper，新增 `conferences.test.ts` 等覆盖各路径；docs 注明"凡置 `listed=true` 必经 `canList`"。
- **[错误码语义]** 选用 422（语义校验失败）而非 403/409 → 与现有 `POST /api/papers` 的 422（`VALIDATION_ERROR`）风格一致。

## Migration Plan

1. 合并守卫与 `listable` 代码后部署。
2. 在目标环境（托管 paper 217 的实例）执行回填：先 SELECT 列出受影响论文，确认后 UPDATE 置 `listed=0`。
3. 回滚：守卫为纯只读校验，回滚仅需还原代码；被回填下架的论文如需恢复可手动 `PATCH {listed:false→true}`（前提是其已具备 arxiv/s2）。

## Open Questions

- 回填是否需要扩展到 217 之外的其他同状态论文？设计默认"是"（同一条件统一修正），但应用时会先输出清单，由用户最终拍板范围。
