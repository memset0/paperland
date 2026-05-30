## Why

会议详情页的候选行信息混乱:同一个"出处/链接"被拆成 4 处(来源 badge、arXiv badge、S2 badge、"来源"链接)且重复;`pending/candidate` 工作流状态与 `仅元数据/已加入` 派生态两套并存;操作分散在行内链接与右侧图标之间。同时,我们解析候选时**已经**从 Semantic Scholar 抓到了 abstract / TL;DR / 引用数(51/53 有 abstract、48/53 有 TL;DR),却没有展示出来。结果是这个页面无法用于"就地筛选论文"。本变更把候选行收拢成一张筛选卡片,并把已抓到的 S2 信息显示出来。

## What Changes

- **候选行改为筛选卡片**:标题 → 元信息行(作者 · 引用数 · 领域)→ S2 **TL;DR** → **abstract**(2~3 行截断、可展开)→ **一条统一的外链行**(arXiv / S2 / OpenReview,只显示存在的)+ 可编辑的 `#主题`。取代当前重复/分散的来源 badge + arXiv/S2 badge + "来源"链接。
- **后端补充 S2 筛选字段**:`GET /api/conferences/:id/papers` 在每条候选上附带其关联论文的 `paper_abstract`、`paper_tldr`、`paper_citation_count`、`paper_fields_of_study`(与现有 `paper_listed` / `paper_arxiv_id` / `paper_corpus_id` 并列)。
- **BREAKING(仅 UI)**:会议详情页**去掉** `pending/candidate` 的"确认/退回"工作流与"本次会议一键添加(candidate)"按钮。候选状态统一为派生的三态生命周期:`待添加`(无 `paper_id`)→ `仅元数据`(有 `paper_id` 且 `listed=false`)→ `已在库`(`listed=true`)。DB 的 `status` 列保留以向后兼容,但 UI 不再呈现。
- **复选框语义变更**:复选框表示"选择以**加入列表**(promote)"。`仅元数据` 行可勾选;`已在库` 行默认勾选且锁定;`待添加` 行禁用(需先"解析")。新增批量动作"加入选中到列表 (N)",取代批量确认/退回。
- **每行右侧**:状态药丸(待添加/仅元数据/已在库)+ 主操作按钮(`仅元数据`→加入,`已在库`→打开论文)+ `⋯` 溢出菜单(编辑主题、删除)。
- **新增后端批量 promote 端点**,供"加入选中"使用。
- **修复 arXiv 链接当前渲染成 `-` 的问题**:用显式链接 chip,不再依赖正在被独立重构的 `SourceTag` 组件。
- **图片暂缓**:Semantic Scholar Graph API 不提供论文配图,本期不做;以 abstract + TL;DR + 引用数 作为筛选信号。

## Capabilities

### New Capabilities
- `conference-candidate-screening`: 会议详情页的候选行以"筛选卡片"呈现,展示从 Semantic Scholar 已抓取的 abstract / TL;DR / 引用数 / 领域;合并为一条统一外链行;复选框语义为"选择以加入列表"并支持批量 promote、已在库行锁定;以派生的三态生命周期取代 `pending/candidate` 的 UI 工作流。

### Modified Capabilities
<!-- 本变更精化的 `conference-management`(会议详情候选展示)与 `conference-paper-resolution`(候选三态派生 + S2 解析)目前尚在未归档的 add-conference-view / add-staged-paper-ingest 变更中、未同步到 openspec/specs/。为避免对未同步基线写 delta,这里以单一新能力承载,并在 design.md 中说明其与上述能力的关系与衔接。 -->

## Impact

- **Backend**:`packages/backend/src/api/conferences.ts` —— `GET /:id/papers` 附带 S2 筛选字段;新增批量 promote 端点(如 `POST /api/conferences/:id/papers/promote { ids }`)。
- **Frontend**:`packages/frontend/src/views/ConferenceDetail.vue` —— 候选行重构为卡片、复选框/批量语义变更、移除确认/退回与一键添加 UI;`packages/frontend/src/stores/conferences.ts` —— 批量 promote action。
- **Shared**:`packages/shared/src/types.ts` —— 候选响应可选扩展字段(或前端以派生字段读取)。
- **Docs**:`docs/frontend-architecture.md`(会议详情候选卡片 / 三态 / 筛选字段)。
- **数据/兼容**:不改 schema;`status` 列保留但 UI 不再使用;仍兼容 `add-staged-paper-ingest` 的 `listed` 两层模型与 `add-conference-view` 的导入/分组。
