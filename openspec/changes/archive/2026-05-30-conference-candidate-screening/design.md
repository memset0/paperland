## Context

会议详情页(`ConferenceDetail.vue`)的候选行经过 `add-conference-view`(导入/分组/三态)与 `add-staged-paper-ingest`(`listed` 两层、S2 解析、候选状态派生)两次叠加,目前一行里同时有:来源 badge、`pending/candidate/ingested` 状态 badge、arXiv badge、S2 badge、`#主题`、"来源"外链、"打开论文/仅元数据·已索引"文本,右侧还有 加入列表 / 确认 / 退回 / 删除。`add-staged-paper-ingest` 的 spec 已声明"去掉 pending/candidate、状态派生",但 UI 侧并未落实,于是新旧两套状态并存。

同时,解析候选时 `semantic_scholar_service` 已对 `listed=false` 论文抓取并存储 abstract / tldr / citation_count / fields_of_study(实测 conference 1:53 篇关联论文中 51 篇有 abstract、48 篇有 tldr),但会议页完全没展示——无法就地筛选。

本设计在不改 DB schema 的前提下,统一候选行为筛选卡片并显示 S2 信息。

## Goals / Non-Goals

**Goals:**
- 候选行收拢为单一"筛选卡片":标题 / 元信息 / TL;DR / abstract / 统一外链 / 主题,信息无重复。
- 把已抓取的 S2 abstract、TL;DR、引用数、领域显示出来,支持就地筛选。
- 候选状态在 UI 上统一为派生三态(待添加 / 仅元数据 / 已在库),去掉 `pending/candidate` 工作流。
- 复选框语义改为"选择以加入列表",支持批量 promote;已在库行锁定。

**Non-Goals:**
- 不抓取/显示论文配图(S2 API 不提供;PDF 首页缩略图留待后续)。
- 不改 `papers` / `conference_papers` 表结构;`status` 列保留不删。
- 不改导入流程、不改 `listed` 两层模型与服务门禁(沿用 `add-staged-paper-ingest`)。
- 不动 `SourceTag` 组件本身(正被独立重构)。

## Decisions

### D1. S2 筛选字段在 API 层"附带",不落库到 conference_papers
`GET /api/conferences/:id/papers` 已对关联论文做一次批量查询以附带 `paper_listed/paper_arxiv_id/paper_corpus_id`。在同一次查询里取出 `abstract` 与 `metadata`,派生附带 `paper_abstract`、`paper_tldr`(`metadata.tldr`)、`paper_citation_count`(`metadata.citation_count`)、`paper_fields_of_study`(`metadata.fields_of_study`)。
- **为何不存到 `conference_papers`**:关联论文是唯一真相源,且会被后续富集更新;复制一份会产生陈旧数据。附带式零冗余、零迁移。
- 备选:在 `conference_papers.abstract` 回填——否决,导入时常为空且会和论文真相源分叉。

### D2. 候选状态:UI 完全派生三态,丢弃 pending/candidate
派生规则:`paper_id == null` → `待添加`;`paper_id != null && paper_listed === false` → `仅元数据`;`paper_listed === true` → `已在库`(`status === 'ingested'` 也归入已在库以兼容旧数据)。
- DB `status` 列保留(`ingestOne` 仍会写 `ingested`),但前端不读不写 `pending/candidate`。
- 落实 `add-staged-paper-ingest` 早已声明、但 UI 未完成的简化。

### D3. 复选框 = 选择以"加入列表";新增批量 promote 端点
复选框不再用于 `pending↔candidate`,而是"选择要 promote 到论文库的候选"。
- 可勾选:`仅元数据`(有 `paper_id`、未 `listed`)。`已在库`:默认勾选 + 禁用(锁定)。`待添加`:禁用(无 `paper_id`,需先"解析")。
- 批量动作"加入选中到列表 (N)" → 新增 `POST /api/conferences/:id/papers/promote { ids: number[] }`:对每个候选的关联论文置 `listed=1` 并 `serviceRunner.triggerForPaper`(复用现有 promote 逻辑),返回每条结果。
- **为何加专用端点而非前端循环**:批量 N 篇逐个 PATCH 会发 N 个请求且无事务性;单端点一次完成、错误聚合返回,和现有"一键添加"风格一致。
- 顶栏保留 解析 / 导入 / 刷新;移除"本次会议一键添加(candidate)"(其语义被批量 promote 取代)。

### D4. 统一外链行用显式 chip,不依赖 SourceTag
行内用显式小链接 chip 渲染 arXiv(`arxiv.org/abs/{id}`)、S2(`semanticscholar.org/paper/CorpusID:{id}`,可继续用 `S2Badge`)、OpenReview(`conference_papers.link`)。
- **为何不复用 SourceTag**:`SourceTag` 正被独立重构、且其"无 link 即显示 `-`"的行为正是当前 arXiv 渲染成 `-` 的根因。显式 chip 自包含、避免耦合。
- id 取值优先级(沿用现有 `displayArxivId/displayCorpusId`):关联论文 id → 候选 `source`/`external_id` → 缓存 `metadata.s2_match`。

### D5. 卡片布局与可展开 abstract
每行三区:① 复选框;② 内容(标题 → 元信息 → TL;DR → abstract `line-clamp` 2~3 行,点"展开/收起"切换 → 外链行 + 主题 chip);③ 右侧状态药丸 + 主操作 + `⋯` 菜单(编辑主题、删除)。展开态用行级 `Set<number>` 或 `reactive` map 记录。

## Risks / Trade-offs

- [移除 pending/candidate UI 后,旧数据里 `status='candidate'` 的候选语义丢失] → 派生三态以 `paper_id`/`listed` 为准,与 `status` 无关;`status` 列保留,不破坏后端/外部依赖。
- [批量 promote 对几十篇同时触发完整管线,可能压到服务调度] → 复用 `serviceRunner.triggerForPaper` 既有限速/并发;promote 仅置位 + 触发,重活在调度层既有节流。
- [abstract 默认占高度,长列表变长] → `line-clamp` 截断 + 默认折叠长摘要(展示 TL;DR + 摘要前 2~3 行),点开才全展开。
- [与未归档的 conference-management/conference-paper-resolution 重叠] → 本变更归档时其候选展示/状态相关需求以本能力为准;在 design 注明衔接,避免规格冲突。

## Migration Plan

1. 后端:扩展 `GET /:id/papers` 附带字段;新增批量 promote 端点。无 DB 迁移。
2. 前端:重构 `ConferenceDetail.vue` 行;`stores/conferences.ts` 加 `promoteMany`。
3. 文档:更新 `docs/frontend-architecture.md`。
4. 回滚:纯加法(API 附带字段 + 新端点)+ 单组件 UI 重构;回退即还原组件与移除端点,数据无影响。

## Open Questions

- "全部加入(把本会议所有 `仅元数据` 一次性 promote)"是否需要顶栏快捷入口?暂以多选 + 批量按钮覆盖,后续按需添加。
- 元信息行的"venue/year"用会议本身还是 S2 venue?本期用会议上下文已知信息,S2 venue 暂不显示。
