## Why

论文数据会随时间变化：arXiv 作者会发布新版本（PDF 改变），Semantic Scholar 的引用数 / 引用图也会持续增长；而现在 PDF 和 S2 数据一旦抓到就再也不会更新（服务的 `produces` 已满足即跳过）。同时，越来越多值得收藏的工作并没有发在 preprint 网站上——只有项目主页 + 一个 PDF（例如 Code Video Model：`code-video-model.github.io` + `tech_report.pdf`），甚至只是一篇博客文章。现在只能手动添加标题/作者/正文，不能给它挂上远程 PDF，也无法让 agent 通过 MCP 把这类论文和 PDF 上传进来并编辑元数据。

## What Changes

- **手动重新抓取 PDF**：论文详情页提供 "Re-fetch PDF"，从论文的 PDF 来源（arXiv 最新版 / S2 open-access 链接 / 用户提供的 PDF URL）重新下载。新文件以内容哈希命名、与旧文件并存；内容未变则不做任何改动并提示 "unchanged"；内容变化则切换 `pdf_path`，清掉基于旧 PDF 的派生产物（`contents.pdf_parsed`、doc2x 解析/翻译），重新跑 PDF 依赖的服务（之前有 doc2x 结果的论文会自动重新请求 doc2x）。旧 PDF 上的高亮按既有规则不再绘制（高亮绑定 PDF 文件）。**不做任何自动重新抓取**，只由用户触发。
- **手动刷新 Semantic Scholar 数据**：详情页提供 "Refresh Semantic Scholar data"，强制重跑 `semantic_scholar_service`，更新引用数、influential 数、reference 数、tldr、引用图等；论文元数据记录 `s2_fetched_at` 与 `pdf_fetched_at` 以便显示"上次抓取时间"。
- **非 preprint 论文 / 网页文章**：
  - `papers` 新增 `kind` 列（`paper` | `article`，默认 `paper`，纯增量）。
  - 新增可选 PDF 来源 URL（`metadata.pdf_url`）与 paper-bound 服务 `url_pdf_service`：无 arXiv id、无 `pdf_path`、有 `pdf_url` 时自动下载（复用 S2 open-access 下载的校验：重定向、超时、大小上限、`%PDF` 签名）。
  - 手动论文的 `PATCH` 可编辑更多元数据：`abstract`、`year`、`venue`、`kind`、`pdf_url`（arXiv 论文仍锁定 title/authors）。
  - 无任何外部 id 的手动论文按规范化后的 `link` 去重，重复添加返回已有论文（`created:false`）。
  - 已有 PDF 的论文可通过上传接口显式替换（`?replace=1`），走与重新抓取相同的"新文件 + 派生产物失效"流程。
  - 前端 "Add paper" 对话框的 Manual 标签页扩展为：类型（Paper / Web article）、标题、作者、链接、摘要、PDF（URL 或上传文件）、正文、标签；详情页编辑模式同步支持新字段。
- **MCP 写工具**（`/mcp`，仅限 personal token，不暴露给 Deep Research / Q&A 的 agent token 运行）：
  - `add_paper`：按 arXiv id / S2 id 或手动元数据（title、authors、link、abstract、year、venue、kind、content、pdf_url、pdf_data base64、tags）添加论文到调用者的库。
  - `update_paper`：编辑元数据（同 PATCH 规则）。
  - `upload_paper_pdf`：上传（base64）或指定 URL 下载 PDF，可选替换已有 PDF。
  - `refresh_paper`：手动触发重新抓取 PDF 和/或刷新 S2 数据。
  - `/mcp` 的 body 上限放大到可容纳 `pdf_upload.max_file_size_mb` 的 base64 PDF。

## Capabilities

### New Capabilities
- `paper-data-refresh`: 用户手动触发的 PDF 重新抓取（版本化文件、内容去重、派生产物失效与重跑）与 S2 数据刷新，以及抓取时间记录与前端入口。
- `manual-paper-sources`: 非 preprint 论文 / 网页文章：`kind`、`pdf_url` + `url_pdf_service`、扩展的手动添加表单、按 link 去重、PDF 替换上传。

### Modified Capabilities
- `paper-edit`: PATCH 可编辑 `abstract`、`year`、`venue`、`kind`、`pdf_url`；前端编辑模式对应字段。
- `pdf-upload`: 支持 `replace=1` 替换已有 PDF；`pdf_status` 把 `url_pdf_service` 视为 PDF 服务。
- `research-agent-tools`: MCP 新增写工具 `add_paper` / `update_paper` / `upload_paper_pdf` / `refresh_paper`（personal token 专用、正确的写注解），研究轮次不获得写工具；`/mcp` body 上限。
- `database-schema`: `papers.kind` 列（增量迁移）。

## Impact

- **Database**：`papers.kind`（text not null default `'paper'`，增量迁移，不需要 MINOR 升级）。
- **Backend**：`service_runner`（显式强制执行 + PDF 替换的派生失效）、`arxiv_service` / `s2_pdf_service` / 新 `url_pdf_service`（共享下载与版本化写入）、`semantic_scholar_service`（记录 `s2_fetched_at`）、`api/papers.ts`（refresh 端点、PATCH 字段、上传 replace、手动去重）、`ingest_paper.ts`、`agent_tools.ts` + `api/mcp.ts`（写工具与 token 限制）、`agent_attach.ts`（研究轮次只启用只读工具）、`utils/pdf_status.ts`、`config.ts`（`url_pdf_service` 默认值）。
- **Frontend**：`PaperList.vue` 添加对话框、`PaperDetail.vue`（刷新菜单、抓取时间、编辑字段、文章类型标识）、`api/client.ts`、`packages/shared/src/types.ts`。
- **Docs**：`docs/tech-stack.md`、`docs/frontend-architecture.md`、`docs/external-api.md`（MCP 写工具说明）。
- **外部服务**：只有用户主动触发时才会访问 arXiv / S2 / PDF URL；单元测试全部使用 mock fetch。
