## Context

- `MarkdownContent.vue` 用 `decorateQALinks()` 把 `#cite:` 链接替换成 chip（在本论文引用中的）或纯文本，卡片数据来自 `usePaperReferences(paperId)`。
- `QAResultBody.vue` 渲染单个 Result（正文 + 底部操作栏），被 `QAResultView` 的 Tabs 或单结果分支复用。PaperDetail 的 QAList 和 `/qa` feed 都经过它。
- 后端 `POST /api/s2/papers/resolve`（add-s2-paper-cache）：按请求顺序返回 `{id, status, source, paper, library_paper_id}`，上限 `max_ids_per_request`（默认 200）；匿名不出网。
- 后端 `extractCiteLinks()` 已有 `#cite:` 提取正则；前端需要同样的逻辑。

## Goals / Non-Goals

**Goals:** 每个回答的引用列表；可复用的列表组件；chip 对列表外 id 的回退解析。

**Non-Goals:** 导入论文库；论文级的引用汇总；分段和 comment 的实际使用（留给 Deep Research）；后端改动。

## Decisions

- **引用 id 在前端从 `result.answer` 提取**，不新增后端字段。正则与后端 `extractCiteLinks` 一致（链接文字 + id，40 位十六进制转小写，纯数字视为 CorpusId，`CorpusId:` 前缀也规范化）；放到 `lib/cite-links.ts`，供列表与 chip 共用。
- **`useS2Papers` composable**：模块级 `Map<id, Ref<S2ResolveResult | null>>` 缓存，外加一个待解析队列；`queueMicrotask` 批量 flush，按 200 分块 POST。请求失败时把这些 id 标记为 `unavailable`，但不写入永久缓存，以便下次重试。匿名用户拿到的 `unavailable` 同样不永久缓存，登录后刷新页面即可重新解析。
- **列表组件 `PaperRefList.vue`**：props `items?: PaperRefItem[]`、`sections?: { title: string; items: PaperRefItem[] }[]`，`PaperRefItem = { id: string; fallback_text?: string; comment?: string }`。组件内部调用 `useS2Papers` 获取元数据。样式沿用 shadcn（紧凑行、muted 元信息），在 QA 卡片里不显得突兀。
- **挂载位置**：在 `QAResultBody` 的正文与操作栏 Separator 之间，用 `Collapsible` 包一个「References · N」触发器，默认折叠。只有展开时组件才挂载，从而才发请求，避免长 feed 一次解析全部 id。
- **chip 统一解析**（实现中按用户要求调整）：`decorateQALinks` 对所有 `#cite:` id 经 `useS2Papers` 解析，不再读取本论文参考文献（`usePaperReferences` 删除）；`resolved` 时渲染为 chip，否则保持纯文本。卡片使用统一展示模型 `{title, authors, year, venue, library_paper_id}`，与列表共用同一缓存。
- **chip 的文字不变**：升级时只改 class/dataset，不改 textContent，保证高亮偏移不变（沿用现有约定）。

## Risks / Trade-offs

- [每个可见回答的 chip 都会发解析请求] → 同一 tick 内合并成一次请求，前端有会话缓存；回答完成时后端已预热缓存，解析基本命中缓存不出网；匿名用户不出网。
- [`MarkdownContent` 正在被 `add-contextual-qa` 等其他变更修改] → 改动集中在 `decorateQALinks` 和卡片的数据映射，尽量小。
