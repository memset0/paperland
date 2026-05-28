## 1. 配置与共享类型

- [ ] 1.1 在 `packages/backend/src/config.ts` 的 `serviceSchema` 增加可选字段 `command`（string）、`auth_mode`（string）、`timeout`（number），保持对现有服务配置向后兼容
- [ ] 1.2 在 `packages/shared/src/types.ts` 的 `ServiceConfig` 同步新增 `command?` / `auth_mode?` / `timeout?`
- [ ] 1.3 在 `config.yml` 与 `config.example.yml` 增加 `doc2x_translate_zh` 与 `doc2x_translate_bilingual` 两个服务配置：`command` 模板含 `--auth-mode oauth --json` 与 `{INPUT}`/`{OUTDIR}`/`{NAME}` 占位符（zh 用 `--translate-type pdf`，bilingual 用 `--to pdf --convert-trans both`），以及 `timeout`、`max_concurrency`、`rate_limit_interval`

## 2. 后端 doc2x 翻译服务

- [ ] 2.1 新增 `packages/backend/src/services/doc2x_service.ts`，导出 `translatePaperPdf(paperId, mode)`：读取该服务的 `command` 模板，用 `Bun.spawn(['bash','-c', cmd])` 调用 doc2x，沿用 `qa_service.ts` 的超时竞速 + 退出码/stderr 处理范式
- [ ] 2.2 实现占位符替换与确定性命名：`{INPUT}`=源 PDF 绝对路径、`{OUTDIR}`=`data/pdfs/translated`（用 `mkdirSync` 确保存在）、`{NAME}`=`p{paperId}_{mode}`
- [ ] 2.3 实现输出路径发现：优先解析 doc2x `--json` stdout 的导出路径，兜底用 `{OUTDIR}/{NAME}.pdf` 的存在性检查；把相对 cwd 的路径写入 `paper.metadata.doc2x.zh_pdf_path` / `bilingual_pdf_path`
- [ ] 2.4 实现缓存逻辑：翻译前若 `metadata.doc2x.<mode>_pdf_path` 文件存在且非 `force` 则直接返回缓存；`force` 时重翻并覆盖
- [ ] 2.5 实现错误映射：spawn ENOENT→「未检测到 doc2x CLI，请先安装」；退出码 2→「请先在终端运行 doc2x login」；其他非零→截断 stderr；超时→杀进程并标记失败
- [ ] 2.6 新增 `packages/backend/src/services/doc2x_service.test.ts`，覆盖占位符替换、缓存命中跳过、`--json` 路径解析、错误映射；**mock CLI 与文件系统，不调用真实 doc2x（避免消耗额度）**

## 3. 后端服务注册与 API

- [ ] 3.1 在 `packages/backend/src/index.ts` 注册 `doc2x_translate_zh` 与 `doc2x_translate_bilingual` 为 pure 服务（`type:'pure'`，no-op `execute`），确认它们不被 `triggerForPaper` 的 paper-bound 依赖图纳入
- [ ] 3.2 新增 `packages/backend/src/api/translations.ts`，实现 `GET /api/papers/:id/translations`：按缓存路径 + 该 paper 各 service 最新 `service_executions` 合成 `{ zh:{status,pdf_path,error}, bilingual:{...} }`（状态 idle/pending/running/done/failed）
- [ ] 3.3 实现 `POST /api/papers/:id/translations`（body `{ mode, force? }`）：缓存命中直接返回 `{status:'done',pdf_path}`；否则经 `serviceRunner.executePureService(serviceName, paperId, () => translatePaperPdf(...))` 触发并返回 `execution_id`；对已有 pending/running 的 paper+mode 去重复用；论文不存在返回 404
- [ ] 3.4 在 `index.ts` 注册 translations 路由
- [ ] 3.5 （可选）在 `api/papers.ts` 与 `external-api/papers.ts` 的级联删除中按 `metadata.doc2x` 路径清理翻译产物文件

## 4. 前端查看器与 tab

- [ ] 4.1 `components/PaperViewerPanel.vue`：`ViewerMode` 增加 `type:'doc2x'` 与 `mode:'zh'|'bilingual'`；在 modes 数组中于 `幻觉翻译` 之前插入「中文翻译」「中英对照」两项，`available = !!pdfPath`，保持顺序 `PDF 原文 → 中文翻译 → 中英对照 → 幻觉翻译`
- [ ] 4.2 新增 `components/Doc2xPdfTab.vue`：接收 `paperId`、`mode`、初始状态/缓存路径，渲染四态——idle（「开始翻译」按钮）/ running（spinner+轮询）/ done（内嵌 `PdfViewer`）/ failed（错误信息+「重试」）
- [ ] 4.3 在 `PaperViewerPanel.vue` 内容区为 `type:'doc2x'` 渲染 `Doc2xPdfTab` 并传入 `paperId`/`mode`
- [ ] 4.4 `views/PaperDetail.vue`：向 `PaperViewerPanel` 传入 `:paper-id` 与 `:metadata`（首屏即可判断是否已有缓存）
- [ ] 4.5 新增前端 translations API 调用（`api/` 下）与短轮询：参照 `stores/qa.ts` 的 `setInterval` 模式，仅在进行中轮询，done/failed 时停止；点击「开始翻译」/「重试」调用 POST

## 5. 文档

- [ ] 5.1 更新 `docs/frontend-architecture.md`：多模式查看器表新增「中文翻译」「中英对照」两行，更新详情页布局示意中的 tab 顺序
- [ ] 5.2 更新 `docs/tech-stack.md`：新增 doc2x CLI 依赖与前置（Node ≥ 22、`doc2x login` OAuth）、`data/pdfs/translated/` 目录、config 中 doc2x 服务字段
- [ ] 5.3 在 `config.example.yml` 注释中写明 doc2x 安装与 `doc2x login` 一次性登录步骤

## 6. 验证

- [ ] 6.1 从项目根 `bun run packages/backend/src/index.ts` 启动后端，确认 `/api/services` 列出两个 doc2x pure 服务，且新建一篇论文不会自动产生 doc2x 执行记录
- [ ] 6.2 对一篇有 `pdf_path` 的论文 `POST /api/papers/:id/translations {mode:'zh'}`：确认产物落在 `data/pdfs/translated/`、`/api/files/...` 能加载、`GET` 返回 done+path；再次触发命中缓存不重复调用
- [ ] 6.3 前端验证：详情页左侧出现四个 tab 且顺序正确；中文翻译 tab 走「按钮 → 进行中 → PDF」流程；未登录场景显示明确错误并可重试
- [ ] 6.4 仅运行 doc2x 相关（已 mock）的测试：`bun test packages/backend/src/services/doc2x_service.test.ts`，确认通过（不要盲跑全部测试）
