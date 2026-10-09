## Context

- QA 运行时（`api/qa.ts`）：`serviceRunner.executePureService()` 负责调度、并发、限流、取消和 `service_executions` 行；`createPartialAnswerWriter` 按 200ms 批量追加流式内容；`QAResultStreamBroker` 负责广播；SSE 端点内联在 qa.ts 中；启动时由 `recoverInterruptedQAResults` 把中断的结果标为 failed。其中 Semaphore、pure service 和 broker 逻辑通用，其余绑定 `qa_results`。
- Codex provider：`stream: true` 走 app-server（JSON-RPC over stdio），`thread/start` 的 `config` 字段可以传配置覆盖（目前只传了 `web_search`）；`stream: false` 走 exec。当前 `config.yml` 中的 Codex 模型都是 `stream: true`。项目中还没有任何 MCP 代码。
- 后端只监听 127.0.0.1:3000，没有内部 token 机制。
- 可复用的部分：`add-s2-paper-cache` 的 `resolveS2Ids()`（批量解析，共享限流）；`add-qa-cite-list` 的 `PaperRefList`（支持 sections 和 comment）与 `useS2Papers`。
- 共享开关：`SharingDataType` 与 `SHARING_DATA_TYPES` 两处定义；`ownerVisibilityFilter()` 负责可见性过滤。

## Goals / Non-Goals

**Goals：** 见 proposal 和 specs。

**Non-Goals：**
- 不支持非 Codex 模型。
- 不提供专门的检索工具（S2 MCP 等）：给 Codex 提供哪些工具另行讨论，作为后续变更。本变更只开启联网搜索。
- 不做导入论文库。
- 不支持分叉或编辑历史轮次。
- External API 不暴露 research。

## Decisions

### D1. 运行时：照着 QA 的模式另写一份，只复用通用部件
新建 `services/research_runtime.ts`：
- 不走 `serviceRunner.executePureService`：它写入的 `service_executions.paper_id` 是指向 `papers` 的非空外键，而 research 回合不属于任何论文。改为在模块内用同样的 `Semaphore` / `RateLimiter` 调度（参数取自 `services.research`，未配置时并发 1、无间隔），每个排队/运行中的步骤保存一个 AbortController 用于取消。因此 research 回合不会出现在 Services 面板的执行记录中，`research_steps` 也不需要 `execution_id` 列。
- 复用 broker 类（新建一个实例，避免与 QA 的 id 冲突）。
- partial writer、SSE 处理和启动恢复按 QA 的写法针对 `research_steps` 实现。
- 列表格式的所有知识集中在 `services/research_list.ts` 这一边界模块（解析回答、给 agent 的序列化、标题编辑），运行时、路由和输入组装只通过它访问列表，列表在库中以不透明 JSON 存储。

暂不把 QA 运行时抽象成通用模块：qa.ts 正被其他变更修改，重构风险高。代价是一些重复代码，日后可以统一。

### D2. paperlist 解析与校验（`services/paperlist.ts`）
1. 用正则找出最后一个 ```` ```paperlist ```` 块，用 zod 校验其结构。
2. 对整份列表中的 id 一次性调用 `resolveS2Ids` 批量解析。
3. 解析不到的论文保留并标为 unverified，不做标题匹配（agent 从 semanticscholar.org URL 取 id 已足够可靠）。论文条目只保存 `s2_id` 与 comment，模型给出的标题等多余字段会被忽略，元数据展示时由 resolver 提供。链接条目校验 URL 为 http/https，`citation.title` 必填，不做解析。
4. 只在同一 section 内去重（论文按 s2_id，链接按规范化 URL）；同一条目可以出现在多个 section，各自带 comment。
5. 校验失败时自动修复一次（见 D2a）。

存储形态：

```json
{
  "title": "<列表总标题>",
  "changes": "<本轮改动说明，可选>",
  "sections": [
    {
      "title": "…",
      "description": "…",
      "items": [
        { "kind": "paper", "s2_id": "<规范化 paperId>", "comment": "…", "verification": "verified|unverified" },
        { "kind": "link", "url": "https://…", "citation": { "title": "…", "author": ["…"], "year": 2024, "howpublished": "…" }, "comment": "…" }
      ]
    }
  ]
}
```

报告（`report`）为去掉该块后的文本，必须非空；列表块与报告缺一不可，否则本轮不产生新版本（记录 parse_error，原始 answer 仍可在时间线中查看）。`changes` 存入 `changes_note`。解析和校验在 round 标为 `done` 之前完成：校验期间状态仍为 `streaming`，前端继续显示占位，完成后一次性推送 `done`（附带 paper_list），避免出现「done 了但列表还没出来」的中间状态。

### D2a. 自动修复
- 第一次解析不合法时，在同一个 round、同一个 service 执行内，再调用一次同一模型（非流式、不开联网搜索），输入为：校验错误 + 原始输出（或只有原 paperlist 块）+ 输出规则摘要。
- 只有列表有问题时，要求只输出合法的 `paperlist` 块，沿用原报告；缺报告时要求输出完整的报告和列表。
- 修复期间 round 保持 streaming，通过 SSE 发送 `repairing` 事件，前端占位文案切换为「Fixing paper list…」。成功后写入 `repaired = 1`。修复仍失败，或修复请求本身报错，则按「不产生新版本」处理。取消操作同样会中断修复请求。

### D3. 输入组装（`services/research_prompt.ts`）
- system：`prompts/system/research.md`（新增），复用 qa_prompt 的按名称加载机制（放在同一目录）。
- user 中各部分用 XML 风格标签包裹（与 QA 提示词风格一致；长文本无需转义，且与 JSON 输出在形式上区分开，降低模型照抄元数据的倾向）：`<topic>`、`<seed>`、`<history>`（每步的用户文本 + `changes` 说明 / 标题编辑记录；按步骤倒序填入，直到达到 `history_char_budget`，超出部分只保留用户文本）、`<current_version>`（含 `<report>` 与 `<paper_list>`）、`<request>`。旧版报告不进入 history，只有当前版报告放在 `<current_version>` 中，以节省预算。
- `<paper_list>` 示例：

```xml
<paper_list title="…">
  <section index="1" title="…">
    <description>…</description>
    <paper s2_id="…" verified="true" arxiv_id="…" year="2020" venue="…" citation_count="3200">
      <title>…</title>
      <authors>A, B, C</authors>
      <tldr>…</tldr>
      <abstract truncated="true">…（截断到 abstract_char_limit）</abstract>
      <comment>…</comment>
    </paper>
    <link url="https://…">
      <citation title="…" author="…" year="2024" howpublished="…"/>
      <comment>…</comment>
    </link>
  </section>
</paper_list>
```

- 元数据来自 `resolveS2Ids`（批量、走缓存）；属性值与文本做 XML 转义。未解析的论文写 `verified="false"`，只有 s2_id 和 comment，提示词要求 agent 重新核对：更正或删除。
- 提示词中写明：每轮必须同时输出完整报告（Markdown，可用 `[短标题](#cite:<s2_id>)` 引用任何论文）和唯一的 `paperlist` 块；`<paper>` 中的元数据由系统提供、仅供参考，输出论文条目时只写 `s2_id` 和 `comment`，绝不重复标题、作者、摘要等；用联网搜索找到论文的 semanticscholar.org 页面，从 URL 取 paperId；非论文来源写成 `url` 条目并按 BibTeX @misc 风格填写 `citation`；可选地在 `changes` 中简述本轮改动；保留用户改过的标题，除非用户另有要求。

### D4. 流式占位
前端在渲染流式 answer 前做预处理：找到 ```` ```paperlist ```` 起始处，截掉其后的内容（如果块已经闭合，块后面还有说明文字，就把块后的文字也保留下来），并插入占位组件。流式过程中，报告部分按 QA 回答的方式渲染（cite chip 等）。round 完成后，展示的是后端返回的 `report`。

### D5. 前端
- `stores/research.ts`：会话列表、详情、round 订阅（借鉴 qa store 中 SSE 订阅与重连的写法）。
- `ResearchDetail.vue`：桌面端两栏（左侧时间线和输入框，右侧为版本视图：版本选择器 + Report / Papers 两个 tab）；< 900px 时改为单栏，版本视图在前。
- 报告渲染：`MarkdownContent` 以 QA 回答模式渲染，cite 一律走统一解析接口（不依赖所属论文，见 add-qa-cite-list 的调整）；报告下方是折叠的「References · N」。
- 版本对比：前端逐 section 比较（按位置 + 标题匹配 section，条目键：论文用 s2_id，链接用规范化 URL）所选版本与上一版本，算出每段新增和移除的条目。
- comment 与 section description 用 `MarkdownContent`（qa-answer 模式，cite 走统一解析）渲染。`PaperRefList` 增加 `addedIds` / `removed` 两个可选 prop。
- QA 入口：`QAResultBody` 操作栏增加「Deep Research」按钮，跳转到 `/research?new=1&seed_result=<id>`，由 ResearchList 打开带预填内容的新建对话框；后端创建时根据 `seed_result_id` 校验可见性并生成快照。

### D6. 步骤、版本与回退
- `research_steps` 中每一行就是一步：`kind = agent | title_edit`，`step_index` 从 1 开始连续递增。「版本」= `paper_list` 非空的步骤，版本号即它在这些步骤中的序号，由前端计算，不单独存储。当前版本 = 最后一个 `paper_list` 非空的步骤。
- 标题编辑：`PUT /api/research/:id/titles` 提交 `{ title, section_titles: string[] }`，长度必须与当前版本的 section 数一致。后端复制当前版本，只替换标题，然后插入一个 `title_edit` 步骤。只接受标题字段，其余字段一律 400。
- 回退：`POST /api/research/:id/truncate` 提交 `{ after_step_index }`，在事务中删除之后的所有步骤。有进行中的回合时返回 409。前端确认框文案写明「将永久删除第 k+1–n 个版本及对应步骤（共 m 步），无法撤销」，用户确认后才发请求。
- 历史版本上的「编辑标题」按钮触发同一个确认框，确认后先回退再进入编辑。
- 时间线展示：title_edit 步骤显示为一条简短记录，例如「Renamed list title / section 2」，不显示模型和状态。
- 输入组装：title_edit 步骤在 `<history>` 中写成「The user edited titles: …」，提示词要求保留用户改过的标题，除非用户另有要求。

### D7. 可见性
在 `SHARING_DATA_TYPES` 中增加 `research`，并为它单独设置默认值 `false`。`sharedFlagsFor` 和读取有效值的逻辑需要支持按类型设置默认值。列表和详情查询使用 `ownerVisibilityFilter(viewer, 'research', …)`。写操作只允许 owner；admin 可以删除。

## Risks / Trade-offs

- [没有专门检索工具时模型更容易编造 id] → 提示词要求 id 只能取自联网搜索得到的 semanticscholar.org URL；解析器批量校验 id，解析不到的标为 unverified 并在 UI 上醒目标出。
- [与 QA 运行时代码重复] → 换来低耦合，日后可以统一。
- [迁移编号与其他 agent 并发] → 与 add-s2-paper-cache 一样，生成迁移前后都确认编号连续，提交前确认依赖的迁移已经提交。

## Migration Plan

纯增量的新表、新路由和新配置（都有默认值）。回滚时移除路由和侧边栏入口即可，表可以保留。
