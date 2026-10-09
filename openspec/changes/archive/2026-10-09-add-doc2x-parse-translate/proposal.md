## Why

论文目前只有一种文本来源：`pdf_parse_service` 用 unpdf 机械抽取的纯文本，公式、表格、版面结构都会丢失，直接影响 Q&A 质量。本机已安装并登录 doc2x CLI（OAuth），它能把 PDF 精确解析为带 `$` 公式的 Markdown，也能生成保留排版的左右对照中英 PDF。把这两项能力做成服务接入 Paperland，可以提升 Q&A 的上下文质量，并在左侧查看器里直接阅读译文。

## What Changes

- 新增 paper-bound 服务 **`doc2x_parse`**：依赖 `pdf_path`，用 doc2x CLI 把 PDF 解析成 Markdown（含参考文献，公式用 `$`），写入 `contents.doc2x_parsed`，并把这次解析的 doc2x **parseId 存入数据库**（`metadata.doc2x_parse_id`）。新论文（`created_at` ≥ `doc2x.auto_since`）有 PDF 后自动运行，与现有 `pdf_parse_service` 并行；旧论文不自动补跑，可在详情页手动触发。
- 新增 paper-bound 服务 **`doc2x_translate`**：手动排队，依赖 `contents.doc2x_parsed`。解析完成前就可以排队，解析完成后由依赖图自动开始；同一篇论文已在排队或进行中时拒绝重复请求。翻译时**复用已存的 parseId**，通过 doc2x 网关直接建翻译任务并导出左右对照 PDF，**不再重新解析、不扣页数，只扣翻译积分**（实测 5 页约 53 积分）。参考文献不翻译；翻译模型可配置，默认 `85` gemini-3.1-flash-lite-preview。完成后后端用 pdf-lib 把每页裁成右半边，另存一份“仅译文”PDF，页数与原文相同。
- 复用 parseId 用到的网关接口是 doc2x CLI 内部使用、未公开文档的接口。没有 parseId 或网关调用失败时，回退到 `doc2x translate` CLI，由它重新解析，会额外扣页数。
- 服务调度新增两项通用能力：paper-bound 服务可声明 `eligible(paper)` 门槛，不满足时自动调度静默跳过；服务可通过 `concurrency_group` 共享同一个并发信号量。两个 doc2x 服务共享 `doc2x` 组，并发上限 5（按 Doc2X 账号级并发限制的假设值）。
- `content_priority` 改为 `[user_input, doc2x_parsed, pdf_parsed]`：doc2x 解析完成后，所有新提问、重新生成和后续追问都会静默改用 doc2x Markdown。
- Q&A 提问确认：如果论文当前只能用机械解析文本（无 user_input、doc2x 已启用、doc2x 解析未完成），提问前（自由提问、模板提问、重新生成）弹窗提醒“doc2x 精确解析尚未完成”，确认后才提问。
- 新增 API：`GET /api/papers/:id/doc2x`（状态汇总）、`POST /api/papers/:id/doc2x/parse`（手动解析）、`POST /api/papers/:id/doc2x/translate`（排队翻译）。
- 左侧查看器新增 **「对照翻译」** tab：未翻译时显示“开始翻译”按钮和 doc2x 解析状态，排队、进行中、失败分别显示对应状态（失败可重试）；完成后可在 **左右对照 / 仅译文** 两种显示方式间切换。
- 详情页新增「复制全文（直接解析）」「复制全文（doc2x）」两个按钮，各自对应的解析完成后才可点击。
- `config.yml` 新增 `doc2x` 配置块，并补充 `services.doc2x_parse` / `services.doc2x_translate` 两项服务配置。

## Capabilities

### New Capabilities
- `doc2x-parse`: doc2x 精确解析服务：新论文自动运行、手动触发、输出存储、parseId 入库、错误映射。
- `doc2x-translation`: doc2x 对照翻译服务：排队与去重、复用 parseId（失败时回退 CLI）、生成左右对照与仅译文 PDF、状态 API。
- `paper-fulltext-copy`: 详情页按版本复制全文（直接解析 / doc2x），未解析完成时按钮不可点击。
- `qa-doc2x-content-gate`: Q&A 在 doc2x 解析未完成时的提问确认，以及完成后静默切换到 doc2x 文本。

### Modified Capabilities
- `paper-viewer-modes`: 查看器新增「对照翻译」模式，支持左右对照和仅译文两种显示方式。
- `service-dependency-graph`: paper-bound 服务可声明 eligibility 门槛，不满足时自动调度跳过、不记录 blocked。
- `service-runner`: 支持 `concurrency_group`，同组服务共享一个并发信号量。
- `config-loading`: 新增 `doc2x` 配置块；`content_priority` 默认值加入 `doc2x_parsed`。

## Impact

- **Backend**: 新增 `services/doc2x_cli.ts`（CLI 调用、错误映射）、`services/doc2x_parse_service.ts`、`services/doc2x_translate_service.ts`（含 pdf-lib 裁剪）、`services/doc2x_gateway.ts`（复用 parseId 翻译）、`api/doc2x.ts`；修改 `services/base_service.ts`、`services/service_runner.ts`、`services/qa_service.ts`（默认优先级）、`config.ts`、`index.ts`。新增依赖 `pdf-lib`。
- **Frontend**: 修改 `components/PaperViewerPanel.vue`，新增 `components/Doc2xTranslationTab.vue`；修改 `stores/qa.ts`（提问前确认）；新增 doc2x 状态请求。
- **Shared**: `packages/shared` 新增 doc2x 状态类型。
- **Storage**: 产物存放在 `data/doc2x/<paperId>/{parse,translate}/`，通过现有 `/api/files/*` 提供。
- **External**: 本机需安装 `@noedgeai-org/doc2x-cli` 并完成 `doc2x login`。新论文自动解析会扣页数额度；手动翻译只扣积分（约 10.6 积分/页）。复用 parseId 时直接调用 doc2x 网关，使用 CLI 保存的 OAuth token 文件；这些接口没有公开文档，升级后可能失效，因此保留了 CLI 回退。
- **Docs**: `docs/tech-stack.md`、`docs/frontend-architecture.md`、`docs/external-api.md`（External API 不变，注明内部 API）。
