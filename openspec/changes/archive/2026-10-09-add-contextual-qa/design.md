## Context

See proposal.md. 现状：

- `qa_entries(paper_id, user_id, type, template_name, prompt, status)` 一对多 `qa_results`（每次模型运行一个 Result，可不同模型多次运行）。
- `qa_service.askQuestion` 用 `system_prompt` 的 `{PAPER}`/`{PROMPT}` 拼成单字符串 → `callModel(prompt: string)`；`ModelProvider.invoke(prompt: string, …)`。OpenAI provider 发 `[{role:'user', content: prompt}]`；Codex provider 经 shell `exec` 或 `app-server` 传文本。
- PDF 已有：选区工具栏（复制链接 + 翻译）、框选截图 → `cropRegionToImage` → 图床 URL + `rx/ry/rw/rh` 锚点。
- 可见性：Free Q&A 走 `unify-multiuser-visibility` 的 `qa` 开关与可见性 helper。

## Goals / Non-Goals

**Goals:** 一个 QA 数据模型和一条运行管线同时承载普通提问、选段提问、截图提问与追问；旧 API/数据兼容。

**Non-Goals（暂缓）:** `#cite:` S2 引用解析；`[📄](url)` 用户库链接注入；Markdown 内容中的选段提问；跨论文提问。

## Decisions（草案，待与用户讨论）

### D1. Entry 模型：instruction + inputs + question
- `qa_entries` 新增：
  - `instruction`（text，config 中的 instruction 名；null = `default_system_prompt`）
  - `inputs`（JSON text，创建后不可变，Zod 校验，snake_case）
  - `parent_entry_id`（由 history input 派生的冗余索引列，仅用于树查询；见 D3）
- `inputs` 为有序数组：
  ```json
  [
    { "kind": "text_selection", "label": "Quote1", "text": "…", "pdf": { "page": 3, "ts": 120, "te": 860 } },
    { "kind": "image", "label": "Image1", "image_hash": "9f2c…", "url": "https://img…/x.png", "pdf": { "page": 4, "rx": 0.1, "ry": 0.2, "rw": 0.5, "rh": 0.3 } },
    { "kind": "history", "result_id": 812 }
  ]
  ```
  **对话历史是 inputs 的一项**（用户已确认）：`history` input 只存父 Result 的 `result_id`，**不复制历史文本**（用户已确认）。运行时由后端沿链展开（D3）。一个 entry 至多一个 `history` input。
- *备选*：独立 `qa_entry_inputs` 表。暂不选：inputs 与 entry 同生命周期、不可变、无需单独查询；以后要按锚点反查再拆表。

### D2. System prompt 配置（instruction = system prompt）

**问题（用户指出）**：现有顶层 `system_prompt` 名不副实。它其实是 **user prompt 模板**，把 `{PAPER}` 和 `{PROMPT}` 拼成一条 user 消息，代码里没有真正的 system 消息；而且全局只有一份，没法给不同场景配不同的 system prompt。

**决定方向（用户提出）**：
- **instruction 就是 system prompt**，只放规则（角色、语言、公式、格式、追问建议等），**不包含论文**。
- **论文、inputs、history、question 全部放在 user prompt 里**，由后端 formatter 按 D10 的固定结构组装（`<paper>` → `<references>`（D11）→ `<inputs>` → `<history>` → `<question>`），不再由 config 字符串模板拼接，`{PAPER}`/`{PROMPT}` 占位符废弃。
- **支持多个具名 system prompt**，以后可以给不同场景配不同的。

草案结构（用户提出：system prompt 拆到单独的文件夹和文件，`config.yml` 里的 `qa` 只负责让用户设置 preset QA）：

```
prompts/                         # 仓库根目录，进 git（config.yml 被 gitignore，prompt 需要版本管理和共享默认值）
  system/
    paper-qa.md                  # 文件名（去掉 .md）就是 system prompt 的名字；全文就是 system prompt
    # 以后可以加：explain-selection.md / kid-friendly.md …
```

```yaml
qa_prompt:
  system_prompts_dir: ./prompts/system     # 相对项目根，可改
  default_system_prompt: paper-qa
  direct_ask:
    system_prompt: paper-qa                # 可省略，省略时用默认
    question: "Explain this in detail in an easy-to-understand way, using bullet points."   # 用户已确认；接在 @Quote1/@Image1 之后

qa:                                        # 只放 preset QA
  - name: research-question
    prompt: "这篇论文试图解决什么问题？"
    # system_prompt: kid-friendly          # 可选，覆盖默认
```

- 文件格式：纯 Markdown 文本，整份作为 system prompt，不做占位符替换。
- 读取时机：启动时扫描目录，校验 `default_system_prompt`、`direct_ask.system_prompt` 和各 preset 的 `system_prompt` 都对应一个存在的文件，缺失就启动失败。**每次运行时重新读文件**（文件很小），所以改 prompt 不用重启；`config.yml` 本身仍是启动时加载一次。运行时文件被删了，就回退到默认；默认也读不到，这次运行失败并记录错误。
- 后续可以用同样的方式把 `translation.prompt` 挪进 `prompts/`，不在本 change 范围内。
- **已确认（用户）**：
  - 追问建议（末尾 3 个 `[💬 …](#moonlight)`）对**所有 QA 都生效**，包括 preset QA；所以 preset 回答里的 `#moonlight` 链接也要能点，并预填追问（D3/D6 的前端处理适用于所有 QA 回答）。
  - 不保留旧 `system_prompt` 里的 `【paperland】` 前缀。
  - 图片直接读本机图床文件，不重新下载（见 D4）。
- **已确认（用户）**：所有 system prompt / instruction 文件**用英文写作**（需要时可以夹带中文，比如引用中文措辞）；回答语言仍由 prompt 要求为简体中文。

`prompts/system/paper-qa.md`（用户已确认定稿，2026-10-09；联网检索相关措辞不按模型区分）：

```markdown
You are an assistant who helps users understand research papers.

## Purpose
- Help the user understand what they are asking about.
- Expand the user's thinking further.

## Input format
The user message is organized into tagged sections, in this order:
- `<paper>`: the full text of the paper the user is reading.
- `<references>` (optional): the papers this paper cites, one per line with a citation id (`cite:<id>`, the paper's Semantic Scholar paperId, or `no id` when unknown), title, first author, year, venue, and `in library: <link>` if the paper is in the user's library.
- `<inputs>` (optional): passages quoted from the paper and screenshots of regions of the paper, each with a label such as `@Quote1` or `@Image1` and the page or page range it comes from.
- `<history>` (optional): earlier turns of this conversation, each with the question and the answer the user chose to continue from. Earlier turns refer to inputs by their labels only; the inputs themselves are in `<inputs>`.
- `<question>`: the current question. It may mention input labels such as `@Quote1`.

## Guidelines
- Answer the question in `<question>`. When it mentions an input label, ground your answer in that input and the surrounding context of the paper.
- Language: Answer in Simplified Chinese (简体中文). Keep proper nouns and technical terms in English.
- Formulas: Write all math in LaTeX, using `$...$` for inline math and `$$...$$` on its own lines for important equations. When the question is about a formula, write it out and explain it term by term.
- Research context: Only when genuinely helpful, connect related work: highlight how cited (or, if you search, citing) works build upon or diverge from this paper, what unresolved issues or open questions they tackle, and how this can inspire further investigation.
- Do not invent citations, links, or details that are not supported by the paper or the inputs.
- Links:
  - Papers marked `in library` in `<references>`: use `[📄 short title](paperland://paper/<id>)` with the link given there. Always start the link text with 📄; never add a library link without it, and never put an emoji in the URL.
  - Other papers you cite: use `[short title](#cite:<id>)`, where `<id>` is the paper's Semantic Scholar paperId (a 40-character hex string). The id MUST be copied exactly from `<references>` or, if you searched, from the last path segment of the paper's semanticscholar.org URL. Never invent, guess, or alter an id; for references marked `no id`, or whenever you are not sure of the id, write the title without a link.
  - Other links: use standard Markdown syntax `[text](url)`.
- Formatting: Use clear headers and structured lists. Keep a helpful and professional tone.

## Follow-up questions
End every answer with exactly three follow-up questions that help the user expand their thinking:
- Put them under a final heading, numbered 1, 2, 3.
- Format each as a Markdown link whose destination is exactly `#moonlight`: `[💬 Your question here](#moonlight)`.
- Make the entire question the link text, so the whole question is clickable.
- Write them in Simplified Chinese.
- Do not include any other links in this section (no library links, `#cite:` links, or `paperland://` anchors).
```

参考另一版 Moonlight prompt（用户提供，2026-10-09）补充（用户已确认）：Purpose 小节；Research context 加入「unresolved issues or open questions」；论文库链接必须以 📄 开头且 URL 不含 emoji；追问整句作为链接文字，追问区禁止其他各类链接；直接提问预设问题加 "using bullet points"。

和 Moonlight 原文相比：
- 「Explain in a detailed but easy-to-understand way, utilizing bullet points」不放进 system prompt（用户已确认）：它只属于直接提问，由 `direct_ask.question` 表达。
- 去掉「the user selects a specific text and asks a question」：这是直接提问的任务描述，移到 `direct_ask.question`。
- 新增 Input format 一节，说明 user prompt 的分段结构和标号约定。
- 合并了旧 `system_prompt` 的公式要求（`$` 行内、重要公式用行间公式）。
- Links 规则（论文库链接、`#cite:` S2 链接）随 D11 加入，数据由 `<references>` 提供。
- **已确认（用户）**：直接提问的预设问题为 `Explain this in detail in an easy-to-understand way, using bullet points.`，最终问题文本形如 `@Quote1 Explain this in detail in an easy-to-understand way, using bullet points.`；直接提问**只用 `models.default`**（当前为 `codex-gpt-6-astra-xhigh`），不读上次选择，`direct_ask` 下不另设模型。
- **已确认（用户）**：`vision: true` 只标在 astra 系列模型上（`codex-gpt-6-astra-max/xhigh/medium`，astra 已实测能看图）；`codex-gpt-5.6-sol-max`、`codex-gpt-5.3-codex-spark-xhigh` 未验证，保持默认 `false`。默认模型 `codex-gpt-6-astra-xhigh` 支持图片，所以截图直接提问可用。
- 生效顺序：预设问题自己的 `system_prompt` → 直接提问的 `direct_ask.system_prompt` → `default_system_prompt`。自由提问用 entry 上记录的名字，没有就用默认值。
- entry 存的是 system prompt 的**名字**（D1 的 `instruction` 列），运行和重新生成时读对应文件的当前内容。
- 迁移：去掉顶层 `system_prompt`。它里面那句中文要求（中文回答、LaTeX、重要公式用行间公式）合进 `paper-qa`。**启动时如果检测到旧的顶层 `system_prompt`，直接报错**（用户已确认），提示该配置已废弃，改用 `prompts/system/*.md` + `qa_prompt.default_system_prompt`，不做兼容。
- Provider 映射（D4）：OpenAI 类模型发真正的 `role: system`。Codex app-server 用 `thread/start` 的 `developerInstructions` 字段；Codex exec 模式用 `-c developer_instructions="…"`（两者 2026-10-09 均实测生效）。不用 `baseInstructions`，那个会替换掉 Codex 自带的基础指令。exec 模式下 prompt 是多行长文本，传参要按 TOML 字符串转义，实现时注意。
- Zod 用显式 `.default({...})`，避免 `.default({})` 坑。

### D3. 追问树与多轮 formatter
- 追问有两种入口，结果完全相同（都创建子 entry）：① 在任一回答（Result）下点「追问」自己输入问题；② 点回答里模型给出的 `[💬 …](#moonlight)` 建议追问（预填问题文本，可编辑后提交）。`#moonlight` 只是快捷方式，不是唯一入口。
- **历史包含模型回答**：每一轮都是「问题 + 该轮被选中的那一个回答」。
- **追问基于哪个回答**（用户已确认）：
  - 在展开的 QA 列表里、某个回答（Result tab）下发起追问 → 就基于当前选中的那个回答。
  - 没有明确选择时（例如从别的入口追问该 entry）→ 默认基于该 entry **最新**的回答。
  - 「最新」按**提问（Result 创建）时间**，不按模型完成时间；同一时间以 result id 兜底。**只有已完成（done）的回答可以被追问**（用户已确认）：排队/生成中（queued/awaiting_output/streaming）、failed、cancelled、已软删除的回答都不行。默认「最新」只在 done 的回答中挑；entry 没有 done 回答时不能追问。前端在非 done 回答下禁用「追问」，后端创建时校验父 Result 为 done，否则 409。
- **多模型同时提问的先后**（用户提出）：模型选择列表里排在前面的通常是更强的模型，希望它成为「最新」。做法：一次多选模型提交时，**按列表逆序依次创建 Result**——列表最后的模型最先创建、第一个模型最后创建，于是排在前面的模型创建时间稍晚、id 更大，默认就被选为最新。这自然产生用户要的「靠后的模型略早一点」的时间差，无需人为 sleep；时间戳同毫秒时由 id 兜底。
  - 现状对照：`api/qa.ts` 目前按列表**正序**逐个 `runQA` 创建，结果是第一个模型最早——需要反过来。
  - **统一现有默认 tab 规则**（用户已确认）：`lib/qa-result-selection.ts` 的 `compareQAResultsNewestFirst`/`latestQAResultId` 目前对 done 回答按 `completed_at` 排序。改为对所有状态一律按 `created_at`（缺失时回退 `completed_at`，历史数据迁移时 created_at 已等于完成时间）+ id 兜底排序，使 QA 列表展开时默认选中的回答 = 最新提问的回答。默认 tab 仍可以落在生成中的回答上（新发起的运行立即成为选中 tab，行为不变）；只有「默认追问对象」额外限定为 done。
- 子 entry 通过 `history` input 的 `result_id` 指向父 Result：父 entry 可能有多个模型的多个 Result，追问必须钉住「基于哪一个回答」。后端据此写入派生列 `parent_entry_id` 以支持树查询。
- formatter 从当前 entry 沿 `history.result_id` 链在数据库中回溯到根（不做可见性过滤），按 D10「Prompt 组装」生成**一次性**的模型输入：整条链上的图片和选段只在 inputs 区出现一次，历史部分只用 `@Image1` 这类标号引用它们，不重复发送图片（用户已确认）。
- 子 entry 的 instruction 默认沿用父 entry；组装时只用当前 entry 的 instruction，祖先轮次的 instruction 不进入 prompt（用户已确认）。owner 为追问者。
- **可以在他人共享的 QA 上追问**（用户已确认）：创建时父 Result 必须对追问者可见（走可见性 helper）；子 entry 属于追问者，可见性只跟随追问者自己的 `qa` 开关。
- **父 QA 之后关闭共享不影响追问**（用户已确认）：
  - 后端生成 prompt 是服务端内部行为，沿 `history.result_id` 链直接读取父 entry/Result，**不经过可见性过滤**，所以运行与 regenerate 不受父可见性影响。
  - 前端查看：历史内容通过可见性规则读取；父对当前查看者不可见时，历史位置只显示「当前不可见」占位（不返回父内容），追问自身的问题、inputs 与回答照常显示。树视图中该子 entry 显示为独立根。
- 历史长度上限进 config.yml：`qa_prompt.max_history_turns`（默认 20），只发送最近 N 轮，更早的轮次在 `<history>` 开头注明省略了几轮；整条链的选段和截图仍全部放进 `<inputs>`。

### D4. Provider 结构化输入
```ts
interface ModelInput {
  system?: string
  messages: { role: 'user' | 'assistant'; parts: ({ type: 'text'; text: string } | { type: 'image'; url: string })[] }[]
}
invoke(input: ModelInput, config, options)
```
- **所有图片输入都必须先上传到本服务自己的图床**（用户已确认）：截图提问、加入提问框的截图，以及以后提问框里粘贴或拖入的图片，一律先上传图床，拿到 `image_hash` 后才能作为 input。后端创建 entry 时校验每个 image input 的 `image_hash` 在 `images` 表中存在，不接受外部 URL 或 data URL，否则 400。这样图片随数据库长期保留，不会因为外部链接失效而导致追问、重新生成或「查看模型输入」时丢图。
- **图片来源**：图床就是本服务自己（`image_host.dir`，默认 `./data/images`），截图上传后文件已经在本机磁盘上，所以 provider 直接按 image input 记录的图床 id/路径读本地文件，**不需要下载**。为此 image input 除 `url` 外还要存图床 `image_hash`（`images` 表主键，SHA-256）。
- OpenAI 兼容 API：图片作为 `image_url` content part 发送。**默认用 data URL（base64）**：不依赖本服务能否从公网访问。`image_host.public_base_url` 可以为空，后端也只监听 127.0.0.1，不能假设模型服务能拉到这个 URL。可选配置：若配置了可公网访问的 `public_base_url`，可改为直接发 URL，以减小请求体（待定，默认关闭）。
- Codex（codex-cli 0.162.0，**2026-10-09 已用一张小图实测通过**，模型 gpt-6-astra）：两种模式都**原生支持图片附件**，把图床文件的绝对路径传进去即可，不需要临时目录：
  - exec 模式：`codex exec -i/--image <FILE>...`，在 shell 命令后追加 `--image <abs path>`。注意 `--image` 会接收多个值，所以问题必须走 stdin（`-`，现有实现就是这样），不能写在 `--image` 后面当位置参数。
  - app-server 模式（项目里 `stream: true` 的模型都走这个）：`turn/start` 的 `input` 支持 `{ type: 'localImage', path }`（也支持 `{ type: 'image', url }`），和 text 一起放进 input 数组。实测图片放在工作目录和沙箱（read-only）之外也能读到，因为附件由 Codex 自己加载，不经过 agent 的沙箱，所以直接传图床目录里的绝对路径即可。
  - 不采用「只在文本里写出路径、让 agent 自己去读文件」的方式：那依赖 agent 主动调用工具和沙箱读权限，不稳定。原生附件更可靠。
  - 如果以后需要隔离（比如不让 Codex 进程看到 data 目录），再把图片复制到每次调用的临时目录，调用结束后删掉。
- 模型配置新增 `vision: boolean`（默认 false）；含 image input 的请求只能选 vision 模型，否则 400。
- QA 的组装结果为 system + 单条 user 消息（D10），图片只出现一次；多轮 `messages` 结构保留给 provider 接口的通用性。
- 旧 `callModel(prompt: string)` 保留为 `{ messages: [user text] }` 的薄封装，translation 等调用方不变。

### D5. API
- 扩展 `POST /api/papers/:id/qa/free`：`{ question, models, instruction?, inputs? }`（追问 = inputs 中含 `history`）；只传 `question/models` 时行为与现在完全一致。
  - 实现补充：`direct_ask: true` 表示从 PDF 直接提问：inputs 必须恰好一个选段或截图，后端把问题定为 `@<label> <qa_prompt.direct_ask.question>`，模型固定为 `models.default`，system prompt 用 `qa_prompt.direct_ask.system_prompt`；请求里的 question/models 被忽略。这样预设问题和默认模型都只在后端配置里，前端不用读取。
  - 响应返回后端分配好标号的 `inputs` 和最终 `question`（客户端给的标号未被占用时保留，被占用时改号并替换问题里对应的 token；指向祖先输入的 token 不动）。
  - 错误码：无全文 409 `NO_CONTENT`；父回答不存在/不可见/已删除 404；父回答未完成 409 `PARENT_NOT_DONE`；图片不在图床 400 `IMAGE_NOT_IN_HOST`；模型不支持图片 400 `MODEL_NOT_VISION`（整条链里有图片就要求所有所选模型都支持）。
- `GET` 列表/详情返回 `instruction`、`inputs`、`parent_entry_id`、子追问数量。
- **树读取接口**（用户已确认需要）：`GET /api/qa/entries/:id/tree`，返回该 entry 所在的整棵追问树（从根开始），每个节点带 entry、它的 results（不含已软删除的）、所接续的父 result id。可见性按 D3：不可见的节点只返回占位（id + 「当前不可见」/「已删除」），不返回内容。供对话视图和树视图使用（D6）。
- `GET /api/qa/results/:id/model-input`：按当前状态重建该回答的模型输入（D12，不存储、全文只给摘要），按需加载。
- `GET /api/qa/entries/:id/locate[?result=]`：QA 链接解析用，只按 entry 定位，返回 `{ state: visible|hidden|deleted, paper_id, … }`；不可见时不返回 paper_id。
- `GET /api/papers/:id/citations` 的每条引用新增 `library_paper_id`（与 `<references>` 的 in library 判断共用同一个匹配函数），供前端引用标签链到站内论文。
- 所有读取仍走可见性 helper（`qa` 开关）；SSE/cancel/regenerate 路径不变。

### D6. 前端
- PDF 选区工具栏：翻译 / **提问** / **加入提问框** / 复制选区链接（「提问」「加入提问框」的区别见 D10）。
- 截图模式：框选后弹出小菜单「复制图片链接 / 复制 Markdown（带定位）/ 加入提问框 / 截图提问」（截图先上传图床拿到 URL）。
- 快速提问浮层（「提问」）：输入引用（选段文本或截图缩略图）+ 流式回答（无问题输入框，问题为预设问题，见 D10）（`MarkdownContent`，`disableHighlights`），与翻译浮层互斥、复用定位算法。
- 每个回答（Result）下有「追问」按钮，用户可自行输入追问；回答中 `#moonlight` 链接是预填问题的快捷方式。两者都创建子 entry。`#cite:` 首期不跳转。
- **QA list 标题栏（折叠态）只显示 inputs 的类别和数量**（用户已确认）：每个类别一个 icon + 数量，不展开内容；对话历史同样只计数，**不在折叠的 QA list 中展示历史内容**。icon 草案（lucide）：
  - `text_selection` → `TextQuote`（选段）
  - `image` → `Image`（截图）
  - `history` → `MessagesSquare`（对话历史）
  - 例：TextQuote 图标 ×2、Image 图标 ×1、MessagesSquare 图标 ×1（此处是图标示意，不是引用 token）；无 inputs 时不显示；icon 带 title tooltip 说明类别。
- **展开态不展开全部内容**（用户已确认）：展开后照常显示问题和回答，inputs 和历史不铺开。
- **「查看模型输入」**（用户已确认）：每个回答提供一个入口，显示模型处理这个问题时拿到的完整输入（system prompt + user prompt 各段，图片显示缩略图）。**只有用户点击时才向后端请求并展开**，默认不加载。详见 D12。
- **新视图本 change 不做**（用户已确认）：对话视图、树视图暂缓，前端只保留现有 QA list。D5 的树读取接口仍然实现，留给以后的视图使用。

### D10. 提问框（QAInput）作为多输入 composer（用户提出，草案）
提问框里的直接提问是选段提问的「简化版」：同一个 instruction + inputs + question 模型，只是 inputs 可以为空，也可以有多个。

**添加输入的两种方式**
- **直接提问**（用户已确认）：在左侧论文（PDF）中对选区/截图点「提问」，**不让用户输入问题，立即提交**：
  - question = 该输入的引用 token 放在开头 + **预设问题**，例如 `@Quote1 <预设问题>`、`@Image1 <预设问题>`。
  - 预设问题写在 `config.yml` 的 `qa_prompt.direct_ask.question`（已确认，见 D2）。
  - 模型：只用 `models.default`（已确认，见 D2）。
  - **doc2x 确认框同样适用**（用户已确认）：与 `add-doc2x-parse-translate` 的 `qa-doc2x-content-gate` 一致，论文当前只能用机械解析文本时，直接提问也先弹「doc2x 精确解析尚未完成」确认框，确认后才提交。
  - 回答在选区旁的浮层中流式显示（无输入框）；需要补充时，在回答下追问，或改用「加入提问框」自己写问题。
- **加入提问框**：点「加入提问框」，输入作为附件加入现有 QAInput 浮动面板（未打开则打开），用户可以继续去选别的段落、截更多图，再补充文字后一起提交。

**附件栏（类似 Cursor 的上下文 chips）**
- 附件按加入顺序排在输入框**上方**，每个显示类别 icon + 标号 + 摘要（选段前若干字 / 截图缩略图）+ 页码，可移除（×）。
- **附件数量不设上限**（用户已确认）。
- **草稿刷新后保留**（用户已确认）：问题文本、附件列表（含已分配的标号）、追问时所接续的父回答，按「用户 + 论文」存在 localStorage（读写包 try/catch，读不到就当空草稿）。截图在加入时就已上传图床，所以草稿里只存 `image_hash`/URL，不存图片本身。提交成功后清空草稿。
- 标号按类别分别递增：`@Image1`、`@Image2`、`@Quote1`……

**文本中的引用 token**（用户已确认：`@` 引用 + 英文标号，不用中文，不用方括号）
- 标号格式：`@Image1`、`@Image2`、`@Quote1`……（图片 = Image，选段 = Quote；按类别分别编号）。
- 每加入一个附件，在输入框**当前光标处**自动插入它的 token，如 `@Image1`。
- token 可以复制、移动、多次出现；输入 `@` 时弹出补全菜单，可选择插入可引用的输入。
- question 原样保存带 token 的文本；后端不做替换，模型通过 inputs 区中同名标号理解 `@Image1` 指什么。
- **页码等元信息不写进用户输入的文本**，只在后端组装 prompt 的 inputs 区给出（见下）。
- 移除附件时：标号**不重排**（避免已有 token 指错），同时删除文本中该附件的 token。

**Prompt 组装**（formatter 输出，草案；用户已确认顺序：图片 → 选段 → 历史 → 当前问题）
~~~
<paper>
（content_priority 选出的全文）
</paper>

<inputs>
@Image1 page 4, region screenshot
<image>
@Image2 page 7, region screenshot
<image>
@Quote1 page 3
"""
（选中的段落原文）
"""
</inputs>

<history>
[User] 解释一下 @Quote1 里的公式
[Assistant] （父链上被选中的回答）
[User] 那 @Image1 的曲线说明了什么？
[Assistant] （……）
</history>

<question>
结合 @Image2，@Quote1 的结论还成立吗？
</question>
~~~
- inputs 区包含**整条对话链（祖先各轮 + 本轮）的全部图片和选段，每个只出现一次**，带标号与元信息（页码；截图注明为区域截图）。图片作为 image part 紧跟其标号行。
- history 区**不重复各轮的 instruction**（用户已确认：历史轮次的 instruction 一律忽略，只发送当前 entry 的 instruction 作为 system），只放各轮的问题与被选中的回答文本，其中对图片/选段的引用就是 `@Image1` 这类标号，**不重新发送图片或选段内容**。
- 整个输入作为 system（instruction）+ 一条 user 消息发送；不按轮次拆成多条带图片的 messages，从结构上避免图片重复。
- **整体顺序 paper → references（D11）→ inputs → history → question，问题放最后**（用户已确认）：
  - 长文档放前、问题放最后，是长上下文下回答质量更好的常见做法；模型读到问题时，全文和输入都在其注意范围内。
  - 全文是同一篇论文所有提问共享的、最长且不变的部分，放最前面才能命中各家模型的前缀缓存（prompt caching），显著降低重复提问的成本和首字延迟；问题放最前会让每次请求的前缀都不同，缓存完全失效。
  - 若希望模型读全文前就知道任务，可在 instruction（system，同样固定可缓存）中说明「问题在最后」，而不是把问题挪到前面。
- 标签和区块措辞实现时可调，但「图片 → 选段 → 历史 → 当前问题」的顺序与「输入只出现一次、历史只引用标号」的规则固定。

**与追问历史的结合**
- 标号在**整条对话链内**唯一且稳定：根提问有 `@Image1`、`@Quote1`，追问里新加的附件从 `@Image2`、`@Quote2` 继续编号，不会重复。
- 追问时 `@` 补全菜单除了本轮附件，还**列出祖先轮次中所有可引用的输入**（显示标号、类别、摘要、所在轮次）。
- 引用祖先输入**不需要重新上传或重新加入本轮 inputs**：本轮 inputs 只存新附件；组装 prompt 时祖先输入自然进入 inputs 区。
- 标号分配由后端在创建时完成（读取祖先链已用的最大编号），前端显示预分配编号，提交后以后端结果为准。

### D7. 选段跨页（用户已确认：支持）
典型选区是一个段落，可能跨页。选段本质上只是文本，所以支持跨页：
- 捕获：选区跨多个 text layer 时，按页拆成多段，分别用现有的 `getSelectionOffsets` 求出每页的 `ts/te`，文本按页顺序拼接。
- 存储：`text_selection` input 的锚点改为 `pdf: [{ page, ts, te }, …]`（单页时数组只有一项）。
- 展示与 prompt：页码写作范围，如 `@Quote1 pages 3–4`。
- 跳回 PDF：定位到第一段并高亮各段。
- 「复制选区链接」和翻译仍按现有单页规则处理（链接格式不变，只能表达单页）；跨页选区的「复制选区链接」只复制起始页那一段，或置灰——实现时按现有锚点格式定。

### D7b. 论文没有全文时 QA 不可用（用户已确认）
- 没有可用全文（`content_priority` 各来源都为空）时，所有 QA 都不能提问：preset、自由提问、直接提问、截图提问、追问。这和现在的行为一致（现在 `askQuestion` 直接报错）。
- 后端：创建时检查，没有全文就返回 409 并给出明确错误，不创建 entry/result。
- 前端：入口按钮置灰，提示需要先解析 PDF 或提供全文。
- prompt 中 `<paper>` 段因此总是存在；system prompt 不需要处理缺失全文的情况。

### D8. QA 删除改为软删除（用户已确认）
- 现状：只有 `DELETE /api/qa/results/:resultId` 一个删除入口，硬删除 Result 并把引用它的 highlight 的 `qa_result_id` 置空；entry 本身没有删除 API。
- 改为：`qa_results` 增加 `deleted_at`（entry 若以后提供删除，同样加 `deleted_at`）。删除 = 写入 `deleted_at`，行保留。
- 所有面向 UI/API 的读取（列表、详情、SSE、搜索、计数）都排除已删除行；权限规则不变（free 仅 owner/admin）。
- 后端生成追问 prompt 时沿 `history.result_id` 链**照常读取已软删除的 Result**，因此删除父回答不会让追问断链或改变后续 regenerate。
- 前端查看追问历史时，已删除的父回答与「当前不可见」同样只显示占位（文案「已删除」）。
- 引用该 Result 的 highlight 处理沿用现状（置空 `qa_result_id`）还是保留——实现时确认，不影响本设计。
- 不提供恢复/清理 UI（以后需要再加）。

### D9. 全局 QA ID 与跨论文引用（用户已确认需要）
- `qa_entries.id`、`qa_results.id` 已是 SQLite `AUTOINCREMENT` 主键，本身就跨论文全局唯一且不复用；配合 D8 软删除，id 永不消失。全局 ID 直接用 `qa_entries.id`，不新增字段。
- 所有 QA（preset/template 与 free，含选段、截图、追问）都有该 ID。
- UI 显示为 `QA-<id>`（QA 卡片标题栏，可点击复制引用）。论文页 `QAList` 折叠标题栏去掉模型名/回答数 badge，`QA-<id>` 放在最右侧（其余元素顺序不变）。
- 存储结构保持现状（用户已确认）：QA 在独立的 `qa_entries`/`qa_results` 表中，由 QA 行的 `paper_id` 指向论文；`papers` 行不存 QA 列表（一对多的标准做法，避免在论文行里维护冗余的 id 数组）。
- 不拆成单独的 SQLite 文件（用户已确认）：跨文件外键不会被检查，删除 QA 时清空高亮引用的事务也无法保证原子性，备份要分开处理，查询还得靠 `ATTACH`。QA 数据量很小，拆分没有收益。
- 链接格式（用户已确认：**生成时保留论文 id，读取时不依赖论文 id**）：
  - `paperland://paper/<paperId>?qa=<entryId>` —— 某条 QA
  - `paperland://paper/<paperId>?qa=<entryId>&result=<resultId>` —— 该 QA 的某个具体回答
  - 生成链接时总是写入当前所属论文 id（可读、与现有 `paperland://paper/...` 一致）。
  - 解析时**只以 `qa`（及 `result`）为准**：由 entry 查到其实际所属论文后导航并定位；链接中的 `paperId` 仅作展示/兜底，与实际不一致或缺失时以 entry 为准，不报错。
  - 与现有 `h/s/e`、`pdf` 目标的组合规则（同一链接中 `qa` 与其他目标是否互斥）在 markdown-anchors delta 中定义。
- 引用目标对当前查看者不可见或已删除时，跳转后显示「当前不可见」/「已删除」，不泄露内容。
- **保持原设计，不再变动**（用户已确认）：
  - QA 链接就是上面的 `?qa=<entryId>[&result=<resultId>]`。
  - 回答内某段文本的定位**沿用现有的 `h/s/e` 锚点**：它按内容 hash 定位 Markdown 块，本来就能定位到 QA 回答里的段落，和 QA id 无关。`qa` 不与 `h/s/e` 组合。
  - 复制格式沿用现有锚点链接的约定（选区复制为 `<文本> [#](paperland://…)`，单纯锚点为 `[#](paperland://…)`）；`QA-<id>` 的复制同样遵循这种紧凑链接写法。

### D11. 引用链接（`#cite:`）与论文库链接（用户提出；已确认在本 change 中一起实现）

思路：加论文时 S2 服务已经把引用图谱存进了 `paper_citations` 表（`direction` 为 reference/citation，带 `s2_paper_id`、标题、作者、年份、venue、arxiv_id/doi、contexts、is_influential）。把它格式化成列表放进 user prompt，模型就有真实的 S2 id 可用；列表之外的文章再允许模型自己搜索。

**数据现状（2026-10-09 本地库）**：266 篇论文中 239 篇有 references（平均约 50 条），205 篇有 citations（平均约 96 条，抓取上限 `EDGE_PAGE_LIMIT = 1000`）。

**User prompt 新增一段 `<references>`**，放在 `<paper>` 之后、`<inputs>` 之前：
```
<references>
[r1] cite:204e3073870fae3d05bcbc2f6a8e263d9b72e776 | Attention Is All You Need | Vaswani et al. | 2017 | NeurIPS | in library: paperland://paper/12
[r2] cite:… | … | … | … | …
[r3] no id | （S2 没解析出 id 的条目，只有标题等信息）| … | … | …
</references>
```
- **只列本论文引用的文献（direction = reference）**，不列引用了本论文的文献（用户已确认：被引数量太多）。
- 每条只给：id、标题、第一作者 + et al.、年份、venue；不给 contexts（太长）。
- **id 用 S2 paperId（40 位十六进制）**（用户已确认）：
  - 数据现状（2026-10-09 本地库）：`paper_citations` 的 reference 行共 12,010 条，其中 10,212 条**同时有** `s2_paper_id` 和 `corpus_id`，1,798 条（约 15%）**两者都没有**（S2 只给了标题等信息）；不存在只有其一的情况。所以前面「corpus_id 缺失时用 paperId 兜底」的说法不对，改为两种 id 任选其一都能覆盖同样的条目。
  - 选 paperId 的理由：它是 S2 的主 id，Codex 联网搜到的 S2 页面 URL 末尾就是 paperId，这样列表里的 id 和搜索得到的 id 是同一种格式，存储和前端处理都统一。代价是每条多十几个 token（约 50 条参考文献共多 1k token 左右），模型抄错的风险由「不在列表中就降级纯文本」兜底。
  - 没有 id 的条目也列出，标 `no id`，模型可以提到它，但只写标题不加链接。
  - 前端解析时两种格式都认（40 位十六进制 = paperId，纯数字 = CorpusId），以防模型从 S2 页面上抄到 Corpus ID。查本论文列表时分别匹配 `paper_citations.s2_paper_id` 或 `corpus_id`。
- **论文库匹配**：按 arxiv_id / doi / corpus_id 和 `papers` 表匹配，命中的标上 `in library: paperland://paper/<id>`。这样 Moonlight 的「论文库链接 `[📄 short title](url)`」规则也能落地。
- 本论文没有 S2 引用数据时，这一段省略。

**system prompt 增加 Links 规则**（已写进 D2 的 `paper-qa.md` 草稿）：
- 标了 in library 的论文：`[📄 short title](paperland://paper/<id>)`。
- 其他引用到的论文：`[short title](#cite:<id>)`。**id 只能原样取自 `<references>` 或自己的检索结果，严禁编造或猜测**；不确定时只写标题、不加链接。
- 其他链接用普通 Markdown 链接。

**联网检索（用户已确认）**：**只对 Codex 模型开放**，让它可以自己在 Semantic Scholar 上搜索列表之外的论文（`codex --search` 启用原生 `web_search`；app-server 下的开法实现时核对）。OpenAI 兼容 API 不提供检索。**默认开启**（用户已确认），保留 config 开关（如 `qa_prompt.codex_web_search: true`）以便关闭。

**前端渲染 `#cite:<id>`（用户已确认）**：
- **id 在本论文的 `<references>` 列表中**：渲染成专门的引用 UI，直接用本地 `paper_citations` 数据，不再请求 S2。样式（用户已确认）：带图标的引用标签，显示短标题；悬停/点击展开卡片，显示标题、作者、年份、venue，提供「在 Semantic Scholar 打开」；在论文库中的直接链到站内论文。
- **id 不在列表中**（包括 Codex 自己搜到的）：**先存储**（用户已确认），前端怎么显示之后再定，目前降级为纯文本，只显示链接文字。
  - 存储：回答完成（done）时，后端解析答案里所有 `#cite:<id>` 链接，把不在本论文 `paper_citations` 中的写进新表 `qa_result_cites`（`qa_result_id`、`paper_id`、`cite_id`、`id_kind` = s2_paper_id/corpus_id、`link_text`、`created_at`），同一回答内同一 id 只存一次。重新生成的新回答各自记录。
  - 这些记录留给以后使用（比如批量去 S2 查元数据、校验 id 是否真实、决定前端展示方式），本 change 不做处理。
- `[📄 …](paperland://paper/<id>)` 走现有的站内链接处理。

**风险**：
- 模型仍可能编造 id：system prompt 明确禁止，前端只对列表内 id 显示引用 UI，其余降级为纯文本兜底。
- prompt 变长：references 约 2k token 量级，相比论文全文占比不大。

### D13. 图床：不再支持删除图片，显示被 QA 引用的次数（用户已确认）
- 图床**去掉删除功能**：管理页不再有删除按钮，`DELETE /api/images/:hash` 接口移除。这样被 QA 输入引用的截图不会被删掉，追问、重新生成、查看模型输入都能一直读到图片。
- 管理页和 `GET /api/images` 在现有的「被笔记引用次数」之外，新增「被 QA 引用次数」：统计所有 `qa_entries.inputs` 中 `image_hash` 等于该图片的 image input 数量（包括软删除回答所在的 entry；论文被删除后其 entry 一并删除，不再计数）。
- 现有的笔记引用次数原样保留（它原本用于删除前提醒，删除去掉后只作展示）。

### D12. 查看模型输入：按当前状态重建，不存储（用户已确认）
- **不存储**任何模型输入：不加 `model_input` 列，不建全文去重表，也不保留旧模板常量。
- 回答下的「查看模型输入」只在用户点击时向后端请求。后端**用当前的 formatter 和当前数据现场重建**：当前 system prompt 文件、当前论文全文和 references、该 entry 的 inputs 和历史链、问题。**不追求还原这个回答产生时的真实输入**（用户已确认）；旧回答也一样按现在的规则重建，界面上注明「按当前配置重建，可能与当时实际发送的不同」。
- **不展开全文**（用户已确认）：返回和显示时，`<paper>` 段只给一行摘要（来源如 `doc2x_parsed`、字符数），不返回全文本身；其余各段（system prompt、references、inputs、history、question）照常显示，图片显示缩略图。
- 接口：`GET /api/qa/results/:id/model-input`，可见性与该回答相同；已软删除的不返回。重建复用实际运行时的同一个 formatter，保证「查看到的」和「现在提问会发出的」一致。

## Default system prompt

（用户提供，原文保存）

```text
Role: You are an assistant who helps users understand papers. The user is reading a paper, selects a specific text and asks a question.

Objective: Given the full context provided by the user, explain the content in a detailed but easy-to-understand way, utilizing bullet points.

Guidelines:

Formulas: Formulas must be written in LaTeX format. If the question is about a formula, write the equation in LaTeX and explain it in detail, term by term.
Language: Answer in Simplified Chinese (except for proper nouns and technical terms which should remain in English).
Research Context: Only connect research progress when deemed necessary. Highlight how cited or citing works build upon or diverge from this paper's findings, and emphasize how this can inspire further investigation.
Links:
Papers saved in the user's library: Use [📄 short title](url).
Citations/references in this paper: Use [short title](#cite:semantic_scholar_paper_id).
Other links: Use standard Markdown syntax [](link url).
Follow-up Questions: Write three follow-up questions to help expand on the user's thinking.
Format as markdown links: [💬 Your question here](#moonlight).
Number them 1, 2, 3.
Destination must be #moonlight.
Do not include other types of links in the follow-up section.
Formatting:

Use clear headers and structured lists.
Maintain a helpful and professional tone.
```

注：prompt 来自 Moonlight 阅读器，`#moonlight` 为其追问链接约定，首期按原文保留；后续可改名为本项目约定（如 `#ask`）。

## Risks / Trade-offs

- [依赖 `add-qa-all-users-scope`、`unify-multiuser-visibility` 未归档] → 本 change 在其后实现/归档，spec 基于新可见性规则。
- [Provider 接口变更面广] → 保留字符串封装，逐个 provider 迁移并补测试（mock，不调用真实 API）。
- [父作者关闭共享后，其内容仍会进入他人追问的模型 prompt] → 用户明确接受；前端不向查看者返回不可见的父内容。
- [软删除后数据仍占空间、仍进入追问 prompt] → 用户确认的取舍；删除仍对 UI/API 读取完全隐藏。
- [长全文 + 多轮历史 + 图片 → 成本/上下文超限] → 历史长度/深度上限进 config；必要时只取选段附近章节。
- [默认共享 → 选段/截图/提问默认对其他登录用户可见] → 与 Free Q&A 一致，由账户 Sharing 的 `qa` 开关控制。
- [图床 URL 可见性] → 已确认无问题：图床列表私有，但图片链接本身对其他用户可访问；共享 QA 与追问链中的截图都能正常加载，无需额外处理。
- [`#cite:` 的 S2 id 模型无从得知] → D11：注入 `paper_citations` 列表，Codex 可选联网检索，前端校验降级。

## Open Questions

- 后续想法（本 change 不做）：让模型链接到本论文中的位置（类似 Moonlight 的 highlights/comments 链接）。模型算不出 `ts/te` 偏移或内容 hash，最多只能链接到页码（`paperland://paper/<id>?pdf=<page>`），且需要全文里带页码标记。

- D11 列表外 `#cite:` id 的前端展示（用户之后告知；本 change 只存储）。

