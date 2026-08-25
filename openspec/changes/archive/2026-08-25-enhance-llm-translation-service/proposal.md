## Why

Paperland 已有英译中服务和按源文本寻址的共享缓存，但当前模型调用层会等 `codex exec` 退出后一次性读取完整 stdout，导致即使底层模型支持流式输出，用户仍必须等待全部译文生成完成。翻译模型与 prompt 也需要成为清晰、可验证的 `config.yml` 契约，使本机 Codex 模型（尤其 `gpt-5.3-codex-spark`）可以作为翻译专用默认模型，并与 OpenAI-compatible HTTP 模型保持清晰独立的 provider 边界。

## What Changes

- 基于 kiss-translator 的单段 LLM 翻译 prompt 思路，更新默认英译中 prompt：明确翻译角色、目标语言、只输出译文、保持语义/语气，并保护 Markdown、HTML、代码、公式、URL、标识符和占位符；prompt 继续由 `config.yml` 配置。
- 保留 `translation.model` 作为翻译专用默认模型；缺省时仍回退 `models.default`，并在启动时验证所引用的模型存在。本机配置把 `codex-gpt-5.3-codex-spark-xhigh` 设为默认翻译模型，仓库示例只说明选择方式而不强迫其他安装使用 Codex。
- 把 Codex CLI 提升为与 `openai_api` 并列的一等模型 provider：保留 `callModel(prompt, modelName)` 作为现有调用者的兼容门面，内部仅由独立 OpenAI provider 与 Codex provider 负责各自配置、协议、错误和能力，不让 Codex 伪装成 OpenAI-compatible API。
- **BREAKING**：删除未使用的 `claude_cli` / `codex_cli` legacy provider 与配置类型；模型调用层只保留彼此独立的 `openai_api` 和 `codex` 两个一等 provider。实施必须先扫描配置/调用点并通过旧 OpenAI、现有 Codex shell 与 QA/翻译回归测试，再启用新默认。
- 在现有最终字符串契约上增量增加可选 chunk callback 与取消信号，并统一以模型配置的 `stream` 开关表达能力：缺省/`false` 时 OpenAI 使用现有 JSON 响应、Codex 使用 `exec --ephemeral`；`true` 时 OpenAI 解析 Chat Completions SSE、Codex 使用 app-server 的真实 delta。所有旧调用者继续使用一次性最终文本。
- Codex provider SHALL 显式配置 `cli_path` 与 `codex_home`（现有登录 profile 的 `CODEX_HOME`）。`exec` 强制使用 `--ephemeral`，app-server 强制创建并验证 ephemeral thread，避免把 Paperland 请求写入个人 Codex 历史；本变更不另存 Codex transcript，完整成功译文继续只进入现有 `translations` 缓存。
- 新增登录用户可用的流式翻译 API；缓存命中立即返回完成事件，缓存未命中时逐段输出译文，只有模型成功结束后才原子 upsert 完整结果。现有非流式 `POST /api/translate` 与缓存查询接口保持兼容。
- 新增样式透明的 `StreamingTranslationText` 叶子组件：创建时即调用流式翻译 API；每个真实 provider delta 整段追加后让出一次 animation frame，确保持续接收期间定期重新绘制，同时不拆字符、不限速、不增加人为等待。缓存命中和非流式 final 仍立即显示。组件向实际文本根元素透传外部 `class`/`style`/HTML attributes，并提供可选 scoped slot 与状态事件。现有 `BilingualText` 仅在用户点击或缓存 peek 命中时挂载它，从而保留原有按需翻译、登录门禁、展开/隐藏和重译交互。
- 新增不出现在侧边栏的管理员测试页 `/translation-test`：使用 `AppPage` 和独立路由元数据，提供源文输入、force 重译、启动/重置、实时状态与流式译文展示；现有 router admin guard 必须阻止匿名及普通用户直接访问。
- 保持现有全局缓存键 `(source_hash, target_lang)`、`force` 重译覆盖、并发限制和限流语义；失败、超时、中断或客户端取消产生的部分译文不得写入成功缓存。
- 同步更新 `docs/frontend-architecture.md`、`docs/external-api.md` 与 `docs/tech-stack.md`，记录 prompt、模型配置、provider 的 `stream` 行为、SSE 事件与缓存/失败语义。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `text-translation`: 增加翻译专用默认模型验证、KISS 风格可配置 prompt、端到端流式输出、缓存命中流式语义及部分结果不入缓存约束。
- `codex-cli-qa`: 把 Codex CLI 明确为独立于 OpenAI API 的一等 provider，以 `stream:false` 使用缓冲式 exec、`stream:true` 使用 app-server，并通过 agent-message delta 提供真实增量输出，同时保持最终字符串兼容契约。
- `config-loading`: 将支持的模型类型收敛为独立的 `openai_api` / `codex`，增加 HTTP 流式开关与 Codex app-server、`codex_home` 所需字段，并验证 `translation.model` 对 `models.available` 的引用关系。
- `bilingual-text-display`: 新增创建即请求、支持外部样式/slot 的流式译文叶子组件，并让现有双语组件组合它，同时保持缓存命中、重译、登录门槛和非流式降级行为。

## Impact

- 后端：保留 `services/model_invoke.ts` 兼容门面并新增独立的 OpenAI/Codex provider 模块；小幅扩展 `services/translation_service.ts`、translation API、配置 schema/模板加载器，以及针对 provider 路由、SSE、Codex app-server、ephemeral、取消和缓存提交时机的定向测试。
- 前端/共享类型：translation API client、新增 `StreamingTranslationText.vue` 与 `TranslationTest.vue`、小幅组合修改 `BilingualText.vue`、注册隐藏的管理员路由、流式事件类型与取消处理。
- 配置：本机 `config.yml` 选择 Spark 作为 `translation.model`，配置 `cli_path`、`codex_home` 并更新 KISS 风格 prompt；`config.example.yml` 说明同样的选择方式。旧 `type: codex` + `shell` 配置继续作为非流式模式，但 `claude_cli` / `codex_cli` 不再接受。
- 数据库：不新增表或迁移；继续使用现有 `translations` 表，部分输出仅存在于请求内存和响应流中。
- API：新增内部 `/api/*` 流式接口；现有内部接口不破坏，External API 不新增翻译能力但文档明确其不在范围内。
- 本地状态：不创建项目 transcript 或新的 Codex home；所有 Codex 调用必须 ephemeral，且继续读取所配置 `codex_home` 的现有登录状态。
- 与进行中的 `isolate-qa-runtime` 变更共享 `model_invoke.ts` 的可选 chunk callback 契约；实施时必须先核对其最终落地状态，复用而非覆盖并发改动。
