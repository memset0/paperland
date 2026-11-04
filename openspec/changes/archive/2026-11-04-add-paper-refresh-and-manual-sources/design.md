## Context

- PDF 下载由 paper-bound 服务完成：`arxiv_pdf_service`（`data/pdfs/<arxiv>.pdf`，固定文件名，覆盖写）、`s2_pdf_service`（`s2_<corpus>.pdf`）、用户上传（`upload_<id>_<hash8>.pdf`）。`/api/files` 对 PDF 有 24h 私有缓存，所以"同名换内容"会让浏览器拿到旧 PDF。
- 服务调度：`triggerForPaper` 按 `produces` 是否已存在决定跑不跑；`executeServiceForPaper` 是显式执行（不看 `produces`）。完成后的 live-key re-check 会跳过"已经有 `done` 执行记录"的服务（防止空产出服务死循环）。
- PDF 高亮按 PDF 指纹（`pdf:<fingerprint>:<page>`）存储，指纹不同的高亮本来就不绘制，所以换 PDF 不需要迁移高亮。
- doc2x 解析默认受 `auto_since` 限制，翻译只在 `doc2x_translate_requested` 时跑。
- `/mcp` 已有只读工具 + `upload_image`；研究轮次 `attachAgentTools` 不传 `tools` → 拿到全部工具。

## Goals / Non-Goals

**Goals:** 用户手动触发 PDF 重新抓取与 S2 刷新；非 preprint 论文 / 网页文章可通过前端和 MCP 添加、上传 PDF、编辑元数据；Code Video Model 作为验收样例。

**Non-Goals:** 自动定时刷新、批量刷新；抓取网页正文转 PDF / Markdown（agent 可自行抓取后用 `content` 提交）；External API 扩展新字段（保持现状，后续可加）；arXiv 元数据（标题/摘要）随新版本更新；旧 PDF 版本切换 UI。

## Decisions

1. **刷新 = 显式执行源服务。** `executeServiceForPaper(name, id)` 本来就不看 `produces` / `eligible`，下载服务也不检查已有 `pdf_path`，所以直接复用：同一 semaphore / rate limiter、执行记录天然出现在服务面板，`pdf_status` 的 "fetching" 判断无需新逻辑。来源选择（arXiv → `pdf_url` → `open_access_pdf_url`）放在 `pdfSourceService(paper)`，端点与 MCP 共用。`REFRESH_IN_PROGRESS` 通过 `serviceRunner.isServiceActive` 判断。
   - 备选：单独的 `pdf_refetch` 纯服务——会绕开 arXiv 限流器，弃用。

2. **版本化文件 + 内容比较集中在 `pdf_store.ts`。** 所有 PDF 写入（三个下载服务 + 上传）都走 `writePdfFile(prefix, bytes)` → `data/pdfs/<prefix>_<sha256[:8]>.pdf`（同内容同名，天然幂等）。下载服务返回 `{ pdf_path, pdf_fetched_at }`；runner 应用结果时如果当前 `pdf_path` 非空且与新值不同，就调用 `applyReplacedPdf`：比较两个文件的 sha256，相同则丢弃新路径（执行结果 `unchanged`），不同则在同一次 update 里写新 `pdf_path` 并清派生产物。新文件名与旧文件相同（同 hash）时直接 `unchanged`。旧文件保留。
   - 执行记录的 `result` 写 `updated` / `unchanged`（首次下载仍为 `OK`），前端据此显示结果。

3. **派生产物失效（`invalidatePdfDerived`）：** 删除 `contents.pdf_parsed`、`contents.doc2x_parsed`、`metadata.doc2x_parse_id`、`metadata.doc2x_translation`，删除 doc2x 输出目录；若之前存在 doc2x 解析 → `doc2x_parse_requested=true`；存在翻译 → `doc2x_translate_requested=true`。写入 `metadata.derived_reset_at = now`，然后 `triggerForPaper`。
   - live-key re-check 改为：忽略 `created_at < derived_reset_at` 的 `done` 记录。这样 doc2x 解析完成后，翻译能再次被链式调度，同时保留原来的防循环语义。

4. **S2 刷新：** 直接 `executeServiceForPaper('semantic_scholar_service', id)`（已不看 `produces`）；服务结果新增 `s2_fetched_at`。现有 metadata 合并本来就是覆盖写，引用图本来就是替换写，basic fields 只补空——符合规格。

5. **`url_pdf_service`：** `depends_on: ['pdf_url']`，`produces: ['pdf_path']`，`requires_listed`，`eligible: !arxiv_id && !pdf_path && pdf_url`。下载与校验抽出为共享的 `downloadPdf(url, limits)`（从 `s2_pdf_service` 迁出，错误文案参数化），配置读 `services.url_pdf_service`（缺省 60s / 100MB，并在 `config.yml` 加条目）。`s2_pdf_service` 的 eligible 增加 `!metadata.pdf_url`，保证 `pdf_url` 优先。
   - PATCH 设置 `pdf_url` 后对无 PDF 的论文 `triggerForPaper`；`pdf_url` 是 metadata 键，runner 的 `getExistingKeys` 自动识别。

6. **`kind` 是真实列**（不是 metadata），因为列表要显示徽标、将来可能筛选；增量迁移 default `'paper'`，按版本策略不升 MINOR。`year`/`venue` 存 metadata，与 S2 写入的键一致（S2 刷新会覆盖手动值——对有 S2 id 的论文这是期望行为）。

7. **按 link 去重：** 在 `ingestPaper` 中，无任何 id 且有 link 时，规范化（小写 scheme/host、http≡https、去 `www.`、去尾 `/` 与 fragment）后在"无 id 论文"中查找；用 `withDedup('link:<norm>')` 防并发。比较在 JS 侧做（无 id 手动论文数量很少）。

8. **MCP 写工具：** 放在 `agent_tools.ts`，handler 复用从路由中抽出的服务函数（`createPaperForUser`、`updatePaperFields`、`storeUploadedPdf`、`startPdfRefetch`/`startS2Refresh`），保证与网页端点同规则。`AgentToolContext.token_kind !== 'personal'` → 工具错误。研究轮次改为 `attachAgentTools(..., { tools: READ_TOOL_NAMES + upload_image })`。`/mcp` bodyLimit 取 image 与 PDF 两者 base64 上限的较大值。

9. **前端：** `PaperList.vue` Manual 标签扩展（类型分段按钮、摘要、PDF URL / 文件二选一）；`PaperDetail.vue` 增加刷新按钮（放在元数据操作区的下拉 "Refresh" 菜单）、上次抓取时间、编辑字段、Article 徽标。刷新进度通过轮询 `/api/papers/:id/services` 中该服务的最新执行（2s 间隔，结束后 reload 论文并 toast 结果）。PDF 查看器在 `pdf_path` 变化后会以新 URL 重新加载（文件名已变，绕开缓存）。

## Risks / Trade-offs

- 旧 PDF 文件保留会占磁盘 → 只在用户手动刷新且内容变化时产生，量很小；以后可加清理。
- 换 PDF 后旧高亮不可见（数据保留）→ 确认对话框中明确告知。
- doc2x 重新解析会消耗页数配额 → 只对原本已有 doc2x 结果的论文自动重新请求，且仅在 PDF 实际变化时。
- S2 刷新覆盖手动填写的 year/venue → 只发生在有 S2 id 的论文上，S2 数据更权威。
- MCP 写工具让外部 agent 可修改全站共享的论文元数据 → 与网页 PATCH 权限一致（任何登录用户），且仅 personal token。

## Migration Plan

`drizzle-kit generate` 生成 `ALTER TABLE papers ADD kind text DEFAULT 'paper' NOT NULL`；无需回填脚本。回滚：列可保留不用。
