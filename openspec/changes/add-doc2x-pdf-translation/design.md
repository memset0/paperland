## Context

论文详情页左侧 `PaperViewerPanel.vue` 用一个数据驱动的 `modes` 数组渲染 tab：当前有 `PDF 原文`（`type:'pdf'` → `PdfViewer` iframe 指向 `/api/files/<pdf_path>`）和 `幻觉翻译`（`type:'iframe'` → hjfy.top）。后端 `/api/files/*`（`index.ts`）把 cwd 下任意文件以 `Content-Type: application/pdf` 返回。

服务体系分两类：**paper-bound**（声明 `depends_on`/`produces`，论文创建时由 `ServiceRunner.triggerForPaper` 依据依赖图**对每篇论文自动调度**）和 **pure**（手动触发，经 `executePureService` 跑，写入 `service_executions`，受 `max_concurrency`/`rate_limit_interval` 约束，在服务管理页可见）。`qa` 即注册为 pure 服务。CLI 子进程的既有范式见 `qa_service.ts`：`Bun.spawn` + 超时竞速 + 退出码/stderr 处理；codex 模型用 **config 里的命令模板**（`shell` 字段）驱动 CLI——本设计沿用同一思路。

doc2x CLI 能力（已核实其文档）：
- `doc2x translate <pdf> --target-language zh --translate-type pdf` → 保留排版的**中文单语 PDF**。
- `doc2x translate <pdf> --target-language zh --to pdf --convert-trans both` → **双语 PDF**（文档翻译模式，重排版，非保留原版式；`--convert-trans` 仅在 `--translate-type md` 文档模式下生效）。
- OAuth 登录：`doc2x login` 一次，凭证缓存于 `~/.config/doc2x/`，token 自动刷新；调用时加 `--auth-mode oauth`。退出码：`0` 成功、`2` 认证失败、`3` 输入文件错误、`4` 任务失败、`5` 导出失败。`--json` 输出机器可读结果（含导出路径）。

用户已确认：**手动按钮触发** + **OAuth 终端登录**。

## Goals / Non-Goals

**Goals:**
- 在左侧查看器新增「中文翻译」「中英对照」两个 PDF tab，顺序为 `PDF 原文 → 中文翻译 → 中英对照 → 幻觉翻译`。
- 后端按需调用 doc2x CLI 把论文 `pdf_path` 翻译为 PDF，结果落盘缓存，二次打开秒开。
- 复用既有 `service_executions` 做状态/并发/限流，并在服务管理页可见。
- doc2x 命令、认证模式、超时均通过 `config.yml` 配置，无需改代码即可调参。
- CLI 缺失 / 未登录 / 翻译失败时给出明确中文错误，可重试。

**Non-Goals:**
- 不自动为每篇论文翻译（不进 paper-bound 依赖图）。
- 不自动安装 doc2x CLI、不代替用户 `doc2x login`。
- 不把翻译后的 PDF 文本接入 Q&A 上下文（`contents.*`）或重新解析。
- 不实现双语「原文页+译文页交替」版式（doc2x PDF 模式不提供；双语为重排版）。
- 不改动 External API。

## Decisions

### D1. 用 pure（手动）服务，而非 paper-bound（自动调度）
doc2x 消耗账户额度且耗时长，是「读哪篇翻哪篇」的阅读辅助。paper-bound 服务会在每篇论文创建时经依赖图自动跑，必然产生大量无谓额度消耗。故注册为 pure 服务，仅由用户在 tab 内点击触发。
- **备选**：paper-bound 自动（驳回：批量烧额度）；新增「手动 paper-bound」服务类别（驳回：要改 `ServiceRunner` 调度语义，过重）。pure 服务带 `paperId` 已是既有用法（`qa`）。

### D2. 两个服务名：`doc2x_translate_zh` / `doc2x_translate_bilingual`
每种模式各一个服务名，各自独立的 `service_executions` 记录、信号量、限流器，服务管理页分别可见，前端按 `service_name` 轮询互不混淆。共享同一实现模块 `doc2x_service.ts`。
- **备选**：单服务 `doc2x` + 在记录里编码 mode（驳回：`service_executions` 无 mode 列，要么加列要么塞进 result，轮询区分变脏）。

### D3. config 驱动的命令模板（沿用 codex `shell` 范式）
在 `serviceSchema` 增可选字段：`command`（命令模板字符串）、`auth_mode`、`timeout`。模板用占位符 `{INPUT}`（源 PDF 绝对路径）、`{OUTDIR}`（输出目录）、`{NAME}`（输出文件名，无扩展名）。执行时 `Bun.spawn(['bash','-c', resolved])`。doc2x 双语 PDF 的精确 flag 组合存在版本差异，放 config 可随时调而不动代码。

```yaml
services:
  doc2x_translate_zh:
    max_concurrency: 1
    rate_limit_interval: 5
    timeout: 600
    command: 'doc2x --auth-mode oauth --json translate {INPUT} --target-language zh --translate-type pdf --out {OUTDIR} --name {NAME} --overwrite'
  doc2x_translate_bilingual:
    max_concurrency: 1
    rate_limit_interval: 5
    timeout: 600
    command: 'doc2x --auth-mode oauth --json translate {INPUT} --target-language zh --to pdf --convert-trans both --out {OUTDIR} --name {NAME} --overwrite'
```
- **备选**：硬编码 flag（驳回：脆弱、难随 doc2x 版本演进）。

### D4. 输出路径发现与缓存
- 输出目录固定 `data/pdfs/translated/`；文件名确定性命名 `p{paperId}_zh` / `p{paperId}_bilingual`（doc2x `--name` 字面量不含 `{}` 占位符，按字面处理）。
- 翻译完成后优先解析 doc2x `--json` stdout 拿到真实导出路径；兜底检查 `{OUTDIR}/{NAME}.pdf` 是否存在。把相对 cwd 的路径（如 `data/pdfs/translated/p42_zh.pdf`）写入 `paper.metadata.doc2x.zh_pdf_path` / `bilingual_pdf_path`。
- **缓存命中**：触发前若 `metadata.doc2x.<mode>_pdf_path` 指向的文件存在，直接返回，不再调用 doc2x。`force:true` 跳过缓存重翻。
- **备选**：新建 `doc2x_translations` 表（驳回：`metadata` JSON 已由 `parsePaper` 暴露，足够，且零迁移）。

### D5. 复用 `/api/files/*` 提供翻译后 PDF
翻译产物放在 cwd 下 `data/pdfs/translated/`，前端 `PdfViewer` 直接用 `/api/files/<path>` 加载，无需新增文件服务代码（该路由已硬编码 `application/pdf`）。

### D6. translations 接口（解耦前端与 service_executions）
- `GET /api/papers/:id/translations` → `{ zh: {status, pdf_path, error}, bilingual: {status, pdf_path, error} }`。后端合成：缓存文件存在→`done`+path；否则取该 service_name + paper_id 最新一条 `service_executions`（`pending`/`running`/`failed`），都没有则 `idle`。
- `POST /api/papers/:id/translations` body `{ mode: 'zh'|'bilingual', force?: boolean }` → 触发，返回 `{ execution_id }` 或缓存命中时直接返回 `{ status:'done', pdf_path }`。
- **并发去重**：若该 paper+mode 已有 `pending`/`running` 执行，触发请求复用之，不重复起进程。

### D7. 认证与子进程环境
默认 OAuth：命令带 `--auth-mode oauth`，`Bun.spawn` 显式 `env: process.env`，后端与用户同 OS 用户运行即可读到 `~/.config/doc2x/` 凭证。退出码 `2` → 明确提示「请先在终端运行 `doc2x login` 登录 doc2x」；`spawn` ENOENT → 「未检测到 doc2x CLI，请先安装」。其余非零退出 → 截断 stderr 作为 error（同 `qa_service`）。

### D8. 前端模式与触发 UX
`PaperViewerPanel` 的 `ViewerMode` 增加 `type:'doc2x'` 与 `mode:'zh'|'bilingual'` 字段；两模式 `available = !!pdfPath`，插入到 `幻觉翻译` 之前。新增子组件渲染单个 doc2x tab：
- `idle` → 占位 + 「开始翻译」按钮（POST 触发）。
- `pending`/`running` → spinner / 进度，按既有短轮询节奏轮询 translations 接口。
- `done` → `<PdfViewer :pdf-path="pdf_path" />`。
- `failed` → 错误信息 + 「重试」（POST `force` 触发）。
`PaperDetail.vue` 向 panel 传入 `paperId` 与 `metadata`（首屏即可判断是否已有缓存）。

## Risks / Trade-offs

- **doc2x 未安装 / 未登录** → spawn 失败或退出码 2。Mitigation：映射为明确中文错误 + docs 写清前置步骤；tab 仍展示，仅在点击触发时报错。
- **翻译耗时长 / 超时** → 阻塞读取。Mitigation：`timeout`（默认 600s）可配 + 运行态轮询展示；超时杀进程标 failed 可重试。
- **双语为重排版而非保留原版式** → 与「对照」直觉略有出入。Mitigation：design/spec 写明；flag 在 config，doc2x 若支持保留版式双语可改配置。
- **输出文件名 / 版式随 doc2x 版本变化** → 路径猜测失败。Mitigation：优先解析 `--json` 输出路径，兜底固定名。
- **重启打断翻译** → 既有启动清理把 pending/running 置 failed。Mitigation：可接受，用户重试即可。
- **`/api/files/*` 无路径约束**（既有问题，不在本次范围）→ 翻译产物统一放 `data/` 内，与原 PDF 同等对待，不引入新暴露面。
- **同一 paper+mode 并发触发** → 重复进程烧额度。Mitigation：D6 去重，复用进行中的执行。
- **删除论文残留翻译文件** → 磁盘垃圾。Mitigation（可选）：级联删除时按 `metadata.doc2x` 路径清理。

## Migration Plan

纯增量、无破坏性：
1. 后端：新增 `doc2x_service.ts`、注册两 pure service、加 translations 路由、扩展 `serviceSchema`（可选字段，向后兼容）。
2. 共享类型：扩展 `ServiceConfig`。
3. 前端：扩展 `PaperViewerPanel` + 新增子组件 + translations API。
4. config：`config.yml` / `config.example.yml` 增 doc2x 配置（缺省时两 tab 触发会报「未配置」可降级）。
5. docs 更新。
无 DB 迁移（`metadata` 为 JSON）。回滚=移除 tab/服务/配置；遗留缓存文件无害。

## Open Questions

- doc2x 双语 PDF 的确切 flag 组合需对照本机所装 CLI 版本验证；已通过 config 命令模板兜底，可不改代码调整。
- 源 PDF 被重新下载后是否自动失效旧翻译缓存？默认不失效，靠 `force` 手动重翻。
- 翻译文件随论文删除清理是否纳入本次？倾向纳入为可选任务。
