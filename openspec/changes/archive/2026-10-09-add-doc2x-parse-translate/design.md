## Context

- 服务体系：paper-bound 服务通过 `depends_on`/`produces` 进入依赖图。`ServiceRunner.triggerForPaper` 做拓扑调度；每个 `executeServiceForPaper` 完成后会重新检查其他 paper-bound 服务，依赖满足且尚未产出时自动启动。这个重检查对**任何**服务完成都会触发，包括旧论文上的 S2 刷新等。每个服务一个 `Semaphore`（`max_concurrency`）和一个 `RateLimiter`。
- Q&A 文本来源：`qa_service.resolveContent` 按 `content_priority` 在**运行时**从 `paper.contents` 中挑选文本，`askQuestion` 在执行时才读取论文。
- 查看器：`PaperViewerPanel.vue` 由数据驱动的 `modes` 数组渲染 tab；`PdfViewer.vue` 接收 `pdfPath`，经 `/api/files/*` 加载；传入 `paperId` 才会启用页链接、框选截图等锚点功能。
- doc2x CLI 0.2.0 实测（5 页论文 2603_03524）：
  - `doc2x parse <pdf> --to md --formula-mode dollar --out <dir> --name paper --overwrite --json`：14 秒，扣 5 页额度，不扣积分。输出 `paper.md` 和 `images/`，参考文献完整保留。stdout 是 JSON，`outputFiles` / `receipt.artifacts` 中 `format:'md'` 的条目即为文档。
  - `doc2x translate <pdf> --translate-type pdf --target-language zh --target-model 85 --ignore-translate-types reference --pdf-font-strategy page-optimal --out <dir> --name bilingual --overwrite --json`：30 秒，扣 5 页额度和 52.8 积分。输出 5 页 PDF，每页 1224×792（原文 612×792 的两倍宽），左原文、右译文。
  - translate 内部执行的解析与 `doc2x parse` 是同一个服务端解析任务（`createParseTask`，v3），回执 `receipt.taskIds.parseId` 中记录了它的 id。CLI 本身没有导出命令，但它内部使用的网关接口 `POST {gateway}/gateway.v1.TaskService/CreateConvertParseTask {parse_id, formula_mode:'dollar', convert_to:1, ...}`，配合 `GetConvertTaskStatus {output_id}` 轮询，会返回一个 zip 下载地址。实测 zip 中的 md 与 `doc2x parse` 的输出**逐字节一致**，且不扣页数和积分。鉴权方式与 CLI 相同：`Authorization: Bearer <accessToken>`，token 取自 `~/.config/doc2x/cli-oauth-tokens.json`；请求体为 snake_case JSON。
  - 失败时 JSON 写到 stderr，退出码非零；退出码 2 表示认证失败。

## Goals / Non-Goals

**Goals:**
- 新论文自动做 doc2x 精确解析，并把 parseId 入库；Q&A 一旦有 doc2x 文本，就静默优先使用。
- 手动对照翻译：可以在解析完成前排队，不能重复排队，参考文献不翻译；翻译复用已入库的 parseId，不再重复扣页数；提供左右对照和仅译文两种显示方式。
- 两个 doc2x 服务合计并发不超过 5，并且在服务管理页可见。
- 所有可调参数都放在 `config.yml`。

**Non-Goals:**
- 不为旧论文批量补跑（可逐篇手动触发；是否全量补跑由用户小规模确认后再定）。
- 不支持重新翻译已完成的论文，不提供翻译文本层面的 Q&A。
- 不改 External API；不在 Markdown 渲染中使用 doc2x 的图片。
- 未公开的网关接口只用于“用已有 parseId 建翻译任务并导出对照 PDF”，并且总是保留 CLI 回退。

## Decisions

### D1. 两个服务都是 paper-bound，用 eligibility 门槛控制“谁会被自动调度”
- `doc2x_parse`：`depends_on: ['pdf_path']`，`produces: ['contents.doc2x_parsed']`，`requires_listed: true`。门槛 `eligible(paper) = doc2x.enabled && paper.pdf_path && (paper.created_at >= auto_since || metadata.doc2x_parse_requested)`。执行结果额外写入 `metadata.doc2x_parse_id`（取自 CLI 回执中的 `taskIds.parseId`）。
- `doc2x_translate`：`depends_on: ['contents.doc2x_parsed']`，`produces: ['doc2x_translation']`，`requires_listed: true`。门槛 `eligible(paper) = doc2x.enabled && !!metadata.doc2x_translate_requested && !!contents.doc2x_parsed`。
- 门槛里额外要求 `pdf_path` / `contents.doc2x_parsed` 已存在，原因是 `triggerForPaper` 会把所有批次同时启动，不会等上一批完成。如果门槛不检查依赖，服务可能先于依赖启动而失败，状态里就会出现虚假的 failed。
- 在 `PaperBoundServiceDef` 上新增可选字段 `eligible?: (paper) => boolean`。`buildExecutionPlan` 和完成后的重检查遇到不满足门槛的服务时静默跳过，既不调用 `markBlocked`，也不调用 `markDeferred`。`executeServiceForPaper` 属于显式调用，不检查门槛。
- “解析完成后自动开始翻译”直接复用依赖图的完成后重检查，不需要另写队列。重检查本来就会过滤掉已有 pending/running/done 执行的服务，正好起到去重作用。
- **备选**：用 pure 服务加自建等待队列（驳回：重复造调度轮子，服务页也看不到依赖关系）；方案 C“导入即翻译、顺带导出解析”（已实测可行，但每篇新论文都会自动扣翻译积分，用户最终驳回）。
- **为何用 `auto_since` 而不是“仅在创建时触发”**：论文的创建路径很多（ingest、External API、会议候选、listed 提升），而且任何服务完成都会触发完成后的重检查。用时间戳判断最稳妥，不需要逐个修改创建路径。默认值设为本功能的上线时间。

### D2. 共享并发：`concurrency_group`
`services.<name>.concurrency_group` 是可选字段。`ServiceRunner.initialize()` 为每个组创建一个 `Semaphore(max_concurrency)`，组内服务共用；`register()` 时若该服务配置了组，也绑定到同一个信号量。`getServiceInfo` 中各成员显示的 running/pending 是组的合计。config：

```yaml
services:
  doc2x_parse:     { max_concurrency: 5, concurrency_group: doc2x }
  doc2x_translate: { max_concurrency: 5, concurrency_group: doc2x }
```
5 是按 Doc2X 账号级并发限制做的假设。CLI 的 batch 模式固定串行，但我们是多个独立进程，所以用信号量控制。

### D3. CLI 调用封装 `doc2x_cli.ts`
- `runDoc2x(args, { timeoutMs, signal? })`：`Bun.spawn([cli_path, '--json', '--no-color', ...args], { env: { ...process.env, DOC2X_NO_UPDATE_CHECK: '1' } })`，用超时竞速并 kill 进程。解析 stdout JSON；失败时尝试解析 stderr JSON 中的错误信息。
- 错误映射：spawn ENOENT → “未检测到 doc2x CLI，请先安装 @noedgeai-org/doc2x-cli”；退出码 2 → “doc2x 未登录或登录已失效，请在服务器上运行 doc2x login”；超时 → “doc2x 运行超时（N 秒）”；其他 → stderr 中的错误信息截断到 500 字符。
- 输出发现：从 JSON 的 `outputFiles` 中取文件（md 按扩展名，pdf 按扩展名），找不到时回退到 `<out>/<name>.<ext>` 是否存在。
- 认证使用默认的 `auto` 模式：0.1.11 起优先使用已保存的 CLI 登录，所以后端必须以完成 `doc2x login` 的同一个 OS 用户运行。

### D3b. 复用 parseId 翻译 `doc2x_gateway.ts`
- `translateFromParse(parseId, outPath)` 依次执行以下步骤：
  1. 读取 token 文件（路径取 `doc2x.token_file`）。如果 `expiresAt` 已过期或即将过期，先运行一次 `doc2x account status --json`，让 CLI 自行刷新 token，再重新读取。
  2. 调用 `CreateTranslateTask`，参数与 CLI 一致：`{parse_id, translate_lang, translate_model, translate_type:2, ignore_translate_types, translate_version:3, font_strategy}`。
  3. 按 2s 起、最长 10s 的退避间隔轮询 `GetTaskStatus`，总时长不超过 `timeout` 秒。
  4. 调用 `CreateExternalPDFMergeTask {translate_id, reverse_order:false, optimize:false}`，从返回的 URL 下载左右对照 PDF。
- `doc2x_translate` 服务：`metadata.doc2x_parse_id` 存在时先走网关；没有 parseId，或网关调用抛错时，回退到 `doc2x translate` CLI（会重新解析）。翻译结果里记录这次实际使用的 `parse_id` 和 `translate_id`。
- token 只用于发往 doc2x 的请求，不写进日志，也不出现在任何错误信息里。

### D4. 产物与数据落点
- 目录 `data/doc2x/<paperId>/parse/`（`paper.md` + `images/`）和 `data/doc2x/<paperId>/translate/`（`bilingual.pdf`、`translated.pdf`）。路径以相对项目根的形式存储，通过现有 `/api/files/*` 提供。
- `contents.doc2x_parsed` 存放 Markdown 全文，与 `pdf_parsed` 同级，Q&A 直接使用。
- `metadata.doc2x_parse_requested`、`metadata.doc2x_translate_requested` 存 ISO 时间戳，作为请求标记；完成后保留，不影响状态判断。
- `metadata.doc2x_parse_id` 存放最近一次成功解析的 doc2x parseId（`op_…`），供翻译复用。
- `metadata.doc2x_translation` = `{ bilingual_pdf_path, translated_pdf_path, parse_id, translate_id, model, target_language, translated_at }`。
- 删除论文时一并删除 `data/doc2x/<paperId>/`，尽力而为，失败忽略。

### D5. 仅译文 PDF：pdf-lib 裁右半边
翻译成功后，用 `pdf-lib` 加载 bilingual.pdf。对每一页，按 `{ x: w/2, y: 0, width: w/2, height: h }` 同时设置 MediaBox 和 CropBox（基于页面实际的 MediaBox 原点），保存为 translated.pdf，页数与原 PDF 相同。只设置 CropBox 的话，部分阅读器仍会显示全宽，所以 MediaBox 也一起改。pdf.js 按 MediaBox/CropBox 渲染。
- **备选**：前端渲染时裁剪（驳回：要改动正被其他变更修改的 `PdfViewer.vue`，而且划选、缩放、页宽计算都要跟着适配）。

### D6. 状态 API 与触发 API（`api/doc2x.ts`）
- `GET /api/papers/:id/doc2x` 汇总以下状态：
  - parse：`contents.doc2x_parsed` 存在 → `done`；否则取该论文最新一条 `doc2x_parse` 执行记录：pending/running/failed 原样返回，其余情况（无记录、blocked、deferred、旧的 done）→ `none`。
  - translate：`metadata.doc2x_translation` 存在 → `done`；否则取最新一条 `doc2x_translate` 执行记录：pending/running 原样返回；requested_at 晚于最新失败记录 → `queued`；最新记录为 failed → `failed`；有请求标记但没有执行记录 → `queued`；其余 → `idle`。
  - `qa_source`：按 `content_priority` 找到的第一个非空键。
  - `text_sources = { pdf_parsed, doc2x_parsed }`：表示哪些全文版本存在，决定“复制全文”按钮能否点击。
  - `qa_needs_confirm = enabled && has_pdf && qa_source !== 'user_input' && qa_source !== 'doc2x_parsed'`。`qa_source` 为 null 时也会提示：这种情况下提问本来就会因为没有内容而失败，提示不会误导用户。
- `POST .../doc2x/parse`：按 spec 返回 409/422/404；否则写入 `doc2x_parse_requested`，调用 `executeServiceForPaper('doc2x_parse')`，返回 202。
- `POST .../doc2x/translate`：状态为 queued/pending/running/done 时返回 409。例外：状态是 queued 但 parse 已失败时，允许重新提交，并重新启动解析。其余情况写入 `doc2x_translate_requested = now`：parse 为 done → 直接启动翻译；parse 为 pending/running → 只排队；parse 为 none/failed → 同时写入 parse 请求并启动解析。返回 202 和最新状态。
- 两个 POST 都要求 `requireUser`；GET 跟随论文本身的读权限（与 `/api/papers/:id` 一致）。

### D7. Q&A 确认（前端）
- 在 `stores/qa.ts` 的 4 个触发入口（`triggerTemplates`、`regenerateTemplate`、`askFree`、`regenerateFree`）之前统一调用 `ensureDoc2xConfirmed(paperId)`：请求 `GET /api/papers/:id/doc2x`；如果 `qa_needs_confirm` 为 true，就用 `window.confirm('doc2x 精确解析尚未完成，本次回答将基于机械解析的文本。仍要提问吗？')`（仓库已有使用 `window.confirm` 的先例）。用户取消时抛出一个可识别的取消标记，调用方不清空输入框。
- 不做“本会话内只提示一次”的记忆，严格按需求每次提问都确认；doc2x 解析完成后自然就不会再弹出。
- 后端不加强制拦截，External API 的行为也不变。

### D8. 查看器「对照翻译」tab 与复制全文
- `stores/doc2x.ts` 统一维护当前论文的 doc2x 状态：`PaperDetail` 加载论文时调用 load、卸载时调用 release；在 settling 状态（解析或翻译进行中，或有 PDF 但机械解析尚未产出）下每 5 秒轮询一次。对照翻译 tab 和复制全文按钮共用这一份状态。
- `PaperFullTextCopy`：放在宽、窄两套布局的信息卡中；按钮是否可用由已加载论文的 contents 或状态里的 `text_sources` 决定；点击时如果本地没有对应文本，会先拉取最新论文再复制。
- 在 `PaperViewerPanel` 的 `modes` 中，于 `PDF 原文` 之后插入 `{ id: 'doc2x', label: '对照翻译', type: 'doc2x', available: !!pdfPath && doc2xEnabled }`。`doc2xEnabled` 来自 `GET /api/papers/:id/doc2x` 的 `enabled` 字段，由新组件或父组件获取。`pickDefault` 仍然先选 `pdf`。
- 新组件 `Doc2xTranslationTab.vue` 负责按钮和显示切换（状态与轮询来自 `stores/doc2x.ts`）。显示方式 `左右对照 | 仅译文` 存在 `localStorage['paperland.doc2x.view']` 中，读写都包在 try/catch 里。
- 完成态渲染 `<PdfViewer :pdf-path="…" :paper-id="null" />`：译文 PDF 的坐标系与原文不同，所以不启用锚点和框选截图，避免生成指向错误位置的链接。
- 顶部显示 doc2x 解析状态；状态为 none 或 failed 时提供“开始解析”按钮，旧论文可以只做解析、不翻译。

## Risks / Trade-offs

- **未公开的网关接口**：doc2x 升级后接口可能失效 → 自动回退到 `doc2x translate` CLI。功能不受影响，只是会多扣一次页数；回退时会写日志，便于发现。
- **parseId 在服务端的保留期未知**：parseId 过期后，复用会失败 → 同样回退到 CLI。
- **并发上限 5 只是假设** → 实际上限更低时会报 “task limit exceeded” 并标记 failed，可重试；值放在 config 中，可以调低。
- **右半裁剪假设页面严格对半** → 实测宽度正好是两倍。若 doc2x 版式变化导致裁剪错位，用户仍可使用“左右对照”；裁剪逻辑集中在一个函数里，容易修改。
- **登录失效** → 错误信息明确提示运行 `doc2x login`，失败的任务可重试。
- **服务器重启** → 启动时会把 pending/running 统一标记为 failed。翻译请求标记仍在，但 parse 或 translate 已失败，状态显示为 failed，用户手动重试即可。
- **contents 体积变大**：每篇论文多存一份 Markdown（数十 KB 级别），影响可以接受。

## Migration Plan

纯增量变更，不需要数据库迁移（contents/metadata 都是 JSON 字段）。`config.yml` 增加 `doc2x` 块并把 `enabled` 设为 true；`config.example.yml` 同步更新，但默认 `enabled: false`。回滚时把 `enabled` 设为 false 即可，已生成的产物不受影响。

## Open Questions

- Doc2X 实际的账号并发上限（暂定 5）。
