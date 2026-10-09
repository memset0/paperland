## Why

想在阅读 PDF 时直接就「选中的一个段落」「框选截图的一块区域」或「上一轮回答」继续提问（参考 Moonlight），并让追问形成一棵树。现有 QA 只有「全文 + 一个问题字符串」这一种形态：`qa_service` 把 `{PAPER}`/`{PROMPT}` 拼成单个字符串，provider 接口只接受 `prompt: string`，无法表达图片、选段或对话历史。与其为每种提问各开一条管线，不如把 QA 重构为「instruction + 有序 inputs + question」的通用模型，所有提问都走现有 QA 接口与 runtime。

> 状态：**仅设计**。用户明确要求停留在设计阶段，未经允许不进入 apply；具体设计细节待与用户讨论。

## What Changes

- **QA 通用化**：每个 QA entry = `instruction`（config.yml 中具名的 system prompt）+ 有序 `inputs` + `question`。input 类型：
  - `text_selection`：PDF 选中的段落（文本 + page/ts/te 锚点）
  - `image`：PDF 框选区域截图（图床 URL + page/rect 锚点）
  - `history`：之前的对话历史（追问树，指向父 entry 的某个具体 Result）——同样是 inputs 的一项
  - 论文全文仍按 `content_priority` 自动作为上下文（无全文时降级）
- 现有 preset/free QA 成为该模型的特例（default instruction + 无额外 inputs），旧请求保持兼容。
- **Provider 接口**由单个 prompt 字符串升级为结构化输入（system + 多轮 messages + 文本/图片 parts），OpenAI 与 Codex provider 各自映射；模型配置新增图片能力声明，不支持图片的模型拒绝 image input。
- **追问树**：`qa_entries` 增加父子关联。用户可在任一回答下自己点「追问」输入问题，也可点回答中模型建议的 `[💬 …](#moonlight)` 链接（预填问题）；两者都创建子 entry（自动带上对话历史），并提供树状浏览。
- **提问框多输入**：QAInput 可加入多个选段/截图附件（排在输入框上方，带标号），光标处插入 `@Image1`/`@Quote1` 等英文 `@` 引用；组装 prompt 时图片 → 选段 → 历史 → 问题，整条链的输入只发一次，历史只引用标号。
- **直接提问**：在 PDF 中对选区/截图点「提问」不需输入问题，立即以「引用 token + config 中的预设问题」提交；instruction 只保留通用部分，任务性内容移入预设问题。
- **前端入口**：PDF 选区工具栏新增「提问」（选段）；框选截图模式新增「截图提问」（在既有复制链接之外，复制拆成「复制图片链接」和带定位的「复制 Markdown」）；回答浮层用 Markdown + KaTeX 渲染。
- **config.yml**：新增具名 instruction（含用户提供的 Moonlight 风格 prompt 原文，见 design.md），与现有 `system_prompt` 统一组织。
- **QA 删除改为软删除**：删除只隐藏，后端生成追问 prompt 时仍可读取，追问链不会断。
- **全局 QA ID**：所有 QA 以跨论文唯一的 `qa_entries.id` 作为全局 ID（显示为 `QA-<id>`），引用链接 `paperland://paper/<paperId>?qa=<id>[&result=<rid>]`：生成时带论文 id，解析时只看 `qa`/`result`。
- 存储为 Free Q&A，可见性继承 `unify-multiuser-visibility` 的 `qa` 共享开关。
- 暂缓：Semantic Scholar `#cite:` 解析、`[📄](url)` 用户库论文链接注入、Markdown 内容中的选段提问。

## Capabilities

### New Capabilities
- `contextual-qa`: QA 的 instruction + 多类型 inputs（选段 / 截图 / 对话历史）模型、追问树，以及 PDF 中的选段提问与截图提问入口。

### Modified Capabilities
- `template-yaml-config`：移除顶层 `system_prompt` 模板（还在时启动报错）；preset 可指定 `system_prompt`；loader 改为按名字读 system prompt 文件。
- `config-loading`：新增 `qa_prompt` 配置块并校验引用的 prompt 文件存在；模型新增 `vision`。
- `codex-cli-qa`：exec 模式用 `developer_instructions` + `--image`；app-server 用 `developerInstructions` + `localImage`，可开联网搜索。
- `database-schema`：`qa_entries` 增加 `instruction`/`inputs`/`parent_entry_id`；`qa_results` 增加 `deleted_at`（软删除）；新表 `qa_result_cites`；删除论文的级联包含新表。
- `paper-delete`：级联删除顺序加入 `qa_result_cites` 和软删除的回答。
- `qa-streaming-runtime`：多模型提交按列表逆序创建 Result；不存完整模型输入。
- `qa-display-split`：默认选中的 tab 按创建时间判定；不显示软删除的回答；追问的重试复用 inputs 和历史。
- `qa-feed-page`：feed 返回 `instruction`/`inputs`/`parent_entry_id`/追问数，排除软删除的回答。
- `qa-input-floating`：提问框增加附件栏；草稿按用户+论文保存在本地，刷新后恢复。
- `pdfjs-viewer`：选区工具栏增加「提问」「加入提问框」（支持跨页）；截图后弹出操作菜单（复制图片链接 / 复制 Markdown / 加入提问框 / 截图提问）。
- `image-host`：去掉删除图片功能（页面和接口）；新增「被 QA 引用次数」，笔记引用次数保留。
- `markdown-anchors`：新增 `?qa=<id>[&result=<id>]` 链接目标，按 QA id 解析；拦截 `#moonlight` 和 `#cite:` 链接。

## Impact

- Backend：`db/schema.ts` + migration（qa_entries 扩展）、`qa_service.ts`/`qa_runtime.ts`（输入组装、多轮 formatter）、`model_providers/*`（结构化输入与图片）、`api/qa.ts`（free 创建接口扩展、树查询）、`config.ts`。
- Frontend：`PdfViewer.vue`（选区工具栏「提问」、截图提问）、QA 展示组件（标题栏 inputs 类别 icon + 数量、追问树）、`api/client.ts`、shared 类型。
- Config：`config.yml` / `config.example.yml`。
- Docs：`docs/frontend-architecture.md`、`docs/external-api.md`、`docs/tech-stack.md`。
- 依赖：`add-qa-all-users-scope`、`unify-multiuser-visibility` 须先归档；复用 `pdf-selection-translate-on-demand` 的选区工具栏。
