## Why

Agent 的回答里常常带有大量 `#cite:` S2 链接，目前只能在正文中逐个悬停查看。不在本论文 `paper_citations` 里的 id 还会直接降级成纯文本，用户没法集中查阅一个回答引用了哪些论文。`add-s2-paper-cache` 已经提供了统一的解析接口和缓存，现在可以在每个回答下给出它自己的引用列表。这个列表组件也将被后续的 Deep Research 论文列表复用。

## What Changes

- 每个已完成（done）的 QA 回答下方显示「References · N」引用列表，只包含**该回答自己**出现的 `#cite:` 论文，按首次出现的顺序排列，并按 id 去重。默认折叠，点击展开。
- 每行显示：标题（解析不到时用回答里的链接文字）、作者（前 3 位 + et al.）、年份 · venue、被引数，以及「在论文库中」标记（链接到站内论文）和 Semantic Scholar 外链。解析中、找不到、暂不可用都有对应状态。
- **不提供导入论文库的功能**（既没有一键导入全部，也没有单篇加入）。
- 新增可复用的论文列表组件，支持可选的分段标题和每篇论文的 comment，供后续 Deep Research 使用。本变更只用到无分段、无 comment 的形态。
- 正文中的 `#cite:` chip 一律通过统一解析接口（S2 paper id）获取元数据，**不依赖回答所属论文的参考文献**：解析成功渲染成 chip 和卡片，失败保持纯文本。`usePaperReferences` 不再使用并删除（`s2Url` 移入 `lib/cite-links.ts`）。
- 前端批量解析：同一时刻多个回答、多个 chip 需要的 id 合并成一次 `POST /api/s2/papers/resolve`，结果在前端按 id 缓存。
- 文档：`docs/frontend-architecture.md` 同步；`docs/tech-stack.md` 补充组件与 composable 说明；`docs/external-api.md` 无变化，确认即可。

## Capabilities

### New Capabilities

- `qa-cite-list`: QA 回答的引用论文列表、可复用的论文列表组件，以及 `#cite:` chip 对列表外 id 的解析展示。

### Modified Capabilities

（无。`#cite` chip 的现有行为来自尚未归档的 `add-contextual-qa`，本变更在 `qa-cite-list` 中以新增需求的方式描述扩展后的行为。）

## Impact

- **Frontend**：新 `components/PaperRefList.vue`、新 `composables/useS2Papers.ts`；`components/QAResultBody.vue`（挂载引用列表）；`components/MarkdownContent.vue`（chip 对列表外 id 的回退解析）。
- **Backend**：无改动（复用 `POST /api/s2/papers/resolve`）。
- **依赖**：`add-s2-paper-cache` 已实现，尚未归档。
