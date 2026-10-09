## Why

做文献调研时，用户需要 agent 帮忙找出几类相关论文，并且能通过多轮对话不断完善这份列表。现有 QA 是「一问一答 + 追问树」，回答里的论文散落在正文的 `#cite:` 链接中，没有可迭代的结构化列表。需要一个独立的 Deep Research 功能：agent 输出分段、带 comment 的论文列表，每轮可以依据用户反馈产出新版本，历史保持线性。

## What Changes

- **独立的 Deep Research 功能**：侧边栏新增 Research 管理页（`/research`，使用 AppPage），列出研究会话；详情页 `/research/:id` 自管布局。
- **研究会话（session）**：包含研究主题和可选的起点快照；显示标题取当前列表版本的总标题。可以从 0 创建；也可以在任一 QA 回答上点「Deep Research」创建，此时把该回答的正文、问题及所属论文信息复制成快照，与原 QA 不再耦合。
- **线性历史（step）与版本**：历史是一串不分叉的步骤，分两种：agent 回合（用户自由文本 + 单个 Codex 模型 + agent 回答：自由文字说明 + 一个 fenced ```paperlist``` JSON 块）和用户的标题编辑。每个产出列表的步骤都生成一个新版本，所有版本都保留，可点开查看。
  - 只有最新一步（且是 agent 回合时）可以「重试」，重试会替换该轮。
  - 没有进行中的回合时才能提交新一轮；每轮默认沿用上一轮的模型，提交前可以切换。
  - **从历史版本继续**：用户可以选择任一历史版本继续，该版本之后的所有步骤和版本会被永久删除。操作前必须弹出确认框，写明将丢失多少个版本，且不可撤销。
- **用户只改标题**：论文列表的内容（增删论文、comment）完全交给 agent。用户可以修改当前版本的列表总标题和各段标题，保存后生成一个新版本（「标题编辑」步骤），论文和 comment 原样复制。在历史版本上编辑，需要先走「从该版本继续」（同样有删除提醒）。
- **报告 + 列表**：agent 每轮必须同时输出一份完整的 deep research 报告（Markdown，可像 QA 回答一样用 `#cite:<s2_id>` 引用任意论文，包括列表外的）和完整的 paperlist；二者共同构成一个版本，缺一则本轮不产生新版本。报告的渲染与 QA 回答一致（cite chip、卡片、References 列表）。
- **列表协议**：`paperlist` JSON 包含列表总标题和多个 section，条目可以是论文（S2 paperId）或非论文链接（如博客文章，只有 URL）；每个 section 有标题和可选说明。
  - 每轮输出完整的新版本，而不是增量。
  - 论文条目只包含 `s2_id` 和 comment，标题、作者等元数据由后端按 id 从 S2 获取；链接条目由 agent 按 BibTeX @misc 风格填写引用信息（title、author、year、howpublished 等）。
  - 回答完成后后端解析并校验：id 经 `add-s2-paper-cache` 批量解析，解析不到的保留并标为未验证（不做标题匹配）。
  - comment 和 section description 是 Markdown，可用 `#cite` 引用论文；同一条目可以出现在多个 section（各自带 comment），只在段内去重。
  - 输出不合法时自动修复一次：把错误和原输出交给同一模型重新输出列表（缺报告时要求完整输出）；仍失败就记录解析错误，当前版本保持上一版。
  - 下一轮输入中把未验证的 id 标为 `verified="false"`，让 agent 更正或删除。
- **流式展示**：回答流式输出时隐藏 `paperlist` 块，显示「Generating paper list…」占位；完成后刷新为新版列表。
  - 列表用 `add-qa-cite-list` 的可复用列表组件渲染，带分段标题和 comment。
  - 可以切换查看任一轮的版本，并与上一版对比，标出新增和移除的论文。
- **每轮输入**：用类 XML 标签组装：研究主题、起点快照、历史步骤（用户文本 + 本轮改动说明 + 标题编辑记录，做压缩）、当前版本（完整报告 + 列表；列表中每篇论文附上系统抓取的 S2 元数据：标题、作者、年份、venue、arXiv id、被引数、TLDR、截断到 `abstract_char_limit` 的摘要），以及本轮用户文本。提示词明确要求 agent 不要在输出中重复这些元数据。system prompt 使用 `prompts/system/` 下新增的 research 提示词，通过 `config.yml` 的 `research` 块配置。
- **仅限 Codex 模型**：Research 只能选择 `type: codex` 的模型，每轮开启联网搜索。
- **暂不提供专门的检索工具**：给 Codex 提供哪些工具（如 S2 检索 MCP）另行讨论，作为后续独立变更；本变更让 agent 通过联网搜索、从论文的 semanticscholar.org URL 获取 paperId，后端再批量校验，解析不到的标为未验证（不做标题匹配）。
- **运行时**：按 QA 的模式在后台调度（`services.research` 配置并发与限流；因 `service_executions` 必须关联论文，不复用 pure service 执行记录）、取消、状态机（queued → awaiting_output → streaming → done/failed/cancelled）、SSE 流式推送和重启恢复。
- **可见性**：新增可选共享类型 `research`，默认关闭（私有）。用户开启后，其他登录用户可以在 `/research` 的 all 视图中只读查看；只有所有者能继续提交、重试和删除，admin 可以删除。
- 文档同步：`docs/frontend-architecture.md`、`docs/tech-stack.md`、`docs/external-api.md`（External API 不变）；`config.example.yml` 增加 `research` 与 `services.research`。

## Capabilities

### New Capabilities

- `deep-research`：研究会话、线性步骤与版本（含从历史版本继续、标题编辑）、paperlist 协议与解析校验、每轮输入组装、运行时与流式、Research 页面与列表版本对比、从 QA 回答起步。

### Modified Capabilities

- `data-sharing-preferences`：新增可选共享类型 `research`（默认关闭）。
- `database-schema`：新增 `research_sessions`、`research_steps` 表。

## Impact

- **DB**：新增两张表，纯增量迁移。
- **Backend**：新 `api/research.ts`、`services/research_runtime.ts`、`services/research_prompt.ts`、`services/research_list.ts`（列表格式边界）、`services/paperlist.ts`（解析与校验）；`auth/visibility.ts`、`api/sharing.ts`；`services/qa_result_stream.ts`（导出 broker 类、`repairing` 事件）；`config.ts`；`index.ts`；`prompts/system/research.md`。
- **Shared**：research 相关类型；`SharingDataType` 增加 `research`。
- **Frontend**：新路由 `/research`、`/research/:id` 与侧边栏条目；新 `views/ResearchList.vue`、`views/ResearchDetail.vue`、`stores/research.ts`、`components/ResearchPaperList.vue`、`lib/research-list.ts`；`api/client.ts`（`researchApi`）；`QAResultBody.vue` 增加「Deep Research」入口；`AccountDialog.vue` 增加共享开关；`PaperRefList.vue` 增加版本对比标记。
- **依赖关系**：需要 `add-s2-paper-cache` 与 `add-qa-cite-list` 已实现。
