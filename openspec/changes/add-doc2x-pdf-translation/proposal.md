## Why

阅读英文论文时，用户希望在 Paperland 左侧 PDF 浏览区直接看到**中文翻译版 PDF** 和**中英双语对照 PDF**，无需离开网站或手动跑外部工具。doc2x CLI 已能把 PDF 翻译为保留排版的中文 PDF / 双语 PDF；用户只需在终端用 `doc2x login` 登录一次，系统即可按需调用 doc2x 完成翻译并缓存，显著降低阅读门槛。

## What Changes

- 在论文详情页左侧 `PaperViewerPanel` 新增两个查看 tab：**中文翻译**（中文单语、保留排版的 PDF）和 **中英对照**（双语 PDF）。两者排在现有 **幻觉翻译** tab **之前**，最终顺序为 `PDF 原文 → 中文翻译 → 中英对照 → 幻觉翻译`。
- 新增后端 doc2x 翻译能力：通过 `Bun.spawn` 调用 doc2x CLI（命令模板写在 `config.yml`，OAuth 认证模式），把论文 `pdf_path` 翻译为缓存在 `data/pdfs/translated/` 的 PDF。
- 注册两个 **pure（手动触发）服务** `doc2x_translate_zh` / `doc2x_translate_bilingual`，纳入 `service_executions` 的状态 / 并发 / 限流体系并在服务管理页可见；**不**纳入 paper-bound 依赖图（避免对每篇论文自动消耗 doc2x 额度）。
- 新增 internal API：`GET /api/papers/:id/translations`（返回每种模式的状态 + 缓存 PDF 路径）与 `POST /api/papers/:id/translations`（按 `mode` 触发翻译，支持 `force` 重新翻译）。
- 翻译结果路径缓存在 `paper.metadata.doc2x`；翻译后的 PDF 通过**现有** `/api/files/*` 路由直接服务（无需新增文件服务代码）。
- 触发方式为**手动按钮**：首次打开 tab 显示「开始翻译」，点击后调用 doc2x 并轮询进度，完成后缓存、之后秒开；失败可重试。
- `config.yml` 新增 doc2x 服务配置（命令模板、`auth_mode`、`timeout`、并发 / 限流），并在 docs 中补充 doc2x 安装与 `doc2x login` 前置步骤。CLI 缺失或未登录时给出明确中文错误提示。

## Capabilities

### New Capabilities
- `doc2x-pdf-translation`: 通过 doc2x CLI 按需把论文 PDF 翻译为中文 / 双语 PDF 的后端服务、磁盘缓存、config 命令模板与 translations API。

### Modified Capabilities
- `paper-viewer-modes`: 查看器新增「中文翻译」「中英对照」两种 PDF 模式，定义其排在「幻觉翻译」之前的展示顺序，以及各自的「按需触发 / 轮询 / 缓存 / 状态展示」行为。

## Impact

- **Frontend**: `components/PaperViewerPanel.vue`（modes 数组新增两模式、新模式类型 `doc2x`、调整顺序）、新增翻译 tab 子组件（触发按钮 / 进度轮询 / PDF 展示 / 重试）、`views/PaperDetail.vue`（向 panel 传入 `paperId`、`metadata`）、新增 translations API 调用与轮询逻辑。
- **Backend**: 新增 `services/doc2x_service.ts` + 单元测试；`index.ts` 注册两个 pure service；新增 `api/translations.ts`（或并入 `api/papers.ts`）提供 translations 接口；`api/papers.ts` / `external-api/papers.ts` 的级联删除顺带清理翻译文件（可选）。
- **Config**: `config.ts` 的 `serviceSchema` 增加可选字段（`command` / `auth_mode` / `timeout`）；`config.yml` 与 `config.example.yml` 增加 doc2x 配置；`packages/shared/src/types.ts` 的 `ServiceConfig` 同步。
- **External dependency**: 需本机安装 doc2x CLI（Node ≥ 22，GitHub Packages registry）并完成 `doc2x login`（OAuth）。属用户一次性手动前置步骤，系统不自动安装 / 登录。
- **Docs**: 更新 `docs/frontend-architecture.md`（查看器模式表与详情页布局）、`docs/tech-stack.md`（doc2x 依赖、`data/pdfs/translated/` 目录、config 结构）；本次为 internal API，`docs/external-api.md` 预计无需改动。
