## 1. 既有行为基线与并发变更对齐

- [x] 1.1 审计 `config.yml`、`config.example.yml`、共享类型、测试与文档中的 `models.available[].type`，确认有效配置只使用 `openai_api` / `codex`；若发现 `claude_cli` / `codex_cli`，先记录迁移目标，并用定向 `rg` 输出验证不存在未处理引用
- [x] 1.2 重新读取并核对进行中的 `isolate-qa-runtime` change 与 `packages/backend/src/services/model_invoke.ts` 最终工作树状态，确定唯一的 optional chunk callback/cancellation 接口；用 diff 审查验证没有覆盖或重复另一 change 的模型调用改动
- [x] 1.3 在重构前为现有 OpenAI JSON 调用、`type: codex + shell` 最终字符串、QA 调用与翻译调用增加 mocked characterization tests，并只运行这些测试证明当前行为基线通过

## 2. 一等 Provider 与 Breaking 配置收敛

- [x] 2.1 定义 provider-neutral 的调用选项/能力接口（最终字符串、可选有序 chunk callback、`AbortSignal`、`streaming` capability），保持 `callModel(prompt, model_name, options?)` 为兼容门面；用路由单测验证按配置名只进入一个 provider
- [x] 2.2 把现有 `/chat/completions` JSON 逻辑原样抽到独立 OpenAIProvider，确保 endpoint、API key env、model name、错误信息和 `stream:false` 默认不变；运行 1.3 的 OpenAI characterization tests
- [x] 2.3 把现有 `type: codex + shell` 逻辑抽到独立 CodexProvider 的 `stream:false` 分支并强制加入 `--ephemeral`，保持 stdin、环境继承、超时和最终字符串语义；用 mocked spawn 验证参数顺序、prompt 未截断、超时 kill 与无 chunk 回调
- [x] 2.4 在 2.2/2.3 回归通过后删除 generic `callCLI`/LegacyCliProvider 与 `claude_cli` / `codex_cli` schema/type 分支；用配置测试验证旧类型给出明确迁移错误，并用 `rg` 验证实现中无残余分派
- [x] 2.5 扩展 Zod/共享模型配置：两 provider 的 `stream` 缺省为 false；Codex `stream:true` 要求 `cli_path`、`codex_home`、`model_id`，并支持 `reasoning_effort`、timeout、working_dir；用临时配置 fixture 验证合法/缺字段/错误类型路径
- [x] 2.6 增加启动期交叉验证：`translation.model` 必须存在、`translation.prompt` 必须含 `{TEXT}`、`codex_home` 必须存在且 `cli_path` 可执行；用配置单测验证失败发生在接收 HTTP 请求之前且不读取/输出认证文件内容

## 3. Provider 原生流式实现

- [x] 3.1 为 OpenAIProvider 实现 `stream:true` Chat Completions SSE 读取，处理任意网络分块、多个/多行 `data:`、`[DONE]`、空 delta、HTTP 错误与 abort；用纯 fixture 测试验证 delta 顺序和最终字符串，不调用真实 API
- [x] 3.2 为 CodexProvider 实现 `stream:true` 的 stdio app-server JSONL 客户端：initialize/initialized、ephemeral read-only `thread/start`、`turn/start`；用 mocked JSONL 测试验证分包/粘包和请求 id 关联
- [x] 3.3 在 CodexProvider 跟踪 `item/started.phase=final_answer` 的 item id，仅转发匹配的 `item/agentMessage/delta`，以 `item/completed.text` 为权威并要求成功 `turn/completed`；用 fixtures 覆盖多 delta、commentary 过滤、最终文本校验、failed/interrupted/empty final
- [x] 3.4 显式以配置的 `codex_home` 设置子进程 `CODEX_HOME`，要求 `thread/start` 返回 `ephemeral:true` 后才启动 turn；用 mocked 响应验证 false/缺失时 fail closed，且任何日志/错误不包含 auth/env 值
- [x] 3.5 完成 Codex app-server 进程生命周期：并行 drain stderr、bounded error tail、timeout、`turn/interrupt`、abort 后 grace kill、成功/失败均 reap 子进程与清理临时 cwd；用 mocked process 测试所有终态无悬挂资源
- [x] 3.6 让无 chunk callback 的调用者在 OpenAI/Codex `stream:true` 下仍得到同一最终字符串契约；同时运行 QA 与非流式翻译回归测试验证调用方无需改写

## 4. 复用翻译核心并新增 SSE API

- [x] 4.1 把 kiss-translator 启发的单文本 prompt 更新到 `config.example.yml` 默认与本机配置候选中，保留现有 `translation.prompt` / `{TEXT}` 装配方式；用 prompt fixture 验证格式保护、只输出译文、源文视为内容等规则存在
- [x] 4.2 仅在 `translateText` 现有 cache-miss 模型调用处透传 `on_chunk`/`signal`，保持 `trim → SHA-256 → (source_hash,target_lang='zh') lookup → gate → call → upsert`；用 DB/mock provider 测试逐步断言 cache hit 不进 provider、首尾空白命中不变、force 仍原行覆盖
- [x] 4.3 验证缓存原子性：delta 期间不写行、成功完成后只写完整 final、首次失败不建行、force 失败保留旧行、取消释放 semaphore；运行定向 `translation_service` 测试
- [x] 4.4 新增登录保护的 `POST /api/translate/stream` 与 SSE encoder，按 `start → delta* → done|error` 输出 snake_case JSON，支持 cache hit、非流式降级、heartbeat、socket backpressure 和断连 abort；用 Fastify inject/受控流测试认证、事件顺序、唯一终态和错误语义
- [x] 4.5 保留 `POST /api/translate`、`cache_only` 与 GET cache API 原响应不变，并补充共享 SSE 事件/状态类型；运行现有 JSON 路由回归与新流式路由测试

## 5. 前端流式叶子组件与现有双语组件组合

- [x] 5.1 在 frontend API client 增加 native-fetch SSE helper，支持 POST body、same-origin credentials、CRLF/分包/多行 data、named events、HTTP 前置错误与 `AbortSignal`；用不联网的 parser fixtures 验证 start/delta/done/error 顺序
- [x] 5.2 新增 `StreamingTranslationText.vue`：非空 `text` 创建即请求、按 delta 追加、done 权威覆盖、非流式/缓存命中直接完成，并通过 typed emits/scoped slot 暴露 `{ text, status, cached, error }`；用组件逻辑 fixture 与前端 build 验证状态转换
- [x] 5.3 让 `StreamingTranslationText` 使用 `inheritAttrs:false`，以 `as` 选择实际文本元素并把 class/style/ARIA/普通 HTML attributes 透传，默认不加产品字体/颜色/间距且不渲染 Markdown；通过渲染检查或最小组件测试验证无额外 wrapper、父级 class 生效和 scoped slot 完全接管 markup
- [x] 5.4 在 `StreamingTranslationText` 内实现每请求 AbortController 与 generation token，text/force 变化或 unmount 时取消，忽略 stale events；用受控异步 fixture 覆盖 error-after-partial、旧请求晚到和空文本不请求
- [x] 5.5 小幅修改现有 `BilingualText`：登录点击或 cache peek 命中时才挂载流式子组件，re-translate 以 `force:true` 重建请求，同时保留英文原文、peek、登录提示、header、Hide/Show 与按钮布局；通过前端 build 和手动交互清单验证未缓存文本不会自动烧模型
- [x] 5.6 新增 `views/TranslationTest.vue`，使用 `AppPage` 提供 draft/submit 分离的源文输入、force、start/re-run、cancel/reset、状态/cache/error 面板，并通过 scoped slot 展示 `StreamingTranslationText`；用前端 build 验证页面仅在显式提交后挂载流请求
- [x] 5.7 注册 `/translation-test` 路由并设置 `meta.title`、`meta.icon`、`requiresAdmin:true`，不修改 `App.vue` 的 desktop/mobile navItems；用 router guard 定向检查验证匿名用户被登录门禁阻止、普通用户被拒绝、管理员可直达且侧边栏无入口
- [x] 5.8 每个真实 provider delta 整段追加后 await 一次 animation frame，再允许 SSE parser 处理下一 delta；不得拆字符、限速或 sleep，done 等待 callback，缓存命中/无 delta final 立即显示，并用纯 helper fixtures 验证绘制机会、完整 delta、取消与最终一致性

## 6. 文档与示例配置

- [x] 6.1 更新 `docs/tech-stack.md`：两个一等 provider、breaking 移除 legacy 类型、统一 `stream` 语义、`cli_path`/`codex_home`、ephemeral、app-server delta、SSE 与不变缓存流水线；用文档 `rg` 验证没有旧 provider 说明
- [x] 6.2 更新 `docs/frontend-architecture.md`：`StreamingTranslationText` 的创建即请求、attrs/slot 样式契约、状态/取消语义、`BilingualText` 的组合边界，以及隐藏管理员测试路由；核对现有摘要布局说明仍准确
- [x] 6.3 更新 `docs/external-api.md`：明确流式翻译仍是登录态内部 `/api/*`、不属于 Bearer External API，并记录该 change 不改变任何现有 External API 契约
- [x] 6.4 更新 `config.example.yml` 展示独立 OpenAI/Codex provider 与 `stream` 缺省/true 语义、Spark `cli_path`/`codex_home`/`model_id` 示例和 `translation.model` 选择方式；用 config loader fixture 验证示例可解析且默认不强制本机存在 Codex profile
- [x] 6.5 更新 `docs/frontend-architecture.md` 说明“完整 delta 后让出一帧”、无人工 pacing、done callback 排队和缓存/非流式立即完成语义，并核对说明与组件行为一致

## 7. Breaking 变更验证门禁与最终启用

- [x] 7.1 只运行新增/相关 mocked backend tests（provider routing、OpenAI SSE、Codex exec/app-server、translation cache、translation routes）并确认全部通过；不要运行可能访问 arxiv、Semantic Scholar 或 OpenAI 的全量测试
- [x] 7.2 运行 `bun run --filter '@paperland/frontend' build`，确认共享类型、SSE helper、`StreamingTranslationText` 与 `BilingualText` 均通过 Vue/TypeScript 构建
- [x] 7.3 在不改生产缓存的临时环境做一次真实 Spark smoke：`stream:true` 必须收到至少两个 final-answer delta、拼接等于 final、turn completed、thread ephemeral，且配置的 `CODEX_HOME/sessions`/`archived_sessions` 没有新增该 child thread rollout；记录结果但不把认证/完整 prompt 写入仓库
- [x] 7.4 仅在 7.1–7.3 全部通过后，才在本机私有 `config.yml` 把 Spark 定义设为 `stream:true` 并把 `translation.model` 指向它；从项目根做 config/startup smoke，确认失败时可退回原 `type:codex + shell + stream:false`
- [x] 7.5 从项目根运行应用并验证管理员 `/translation-test` 的流式/cache/force/cancel/reset，确认匿名与普通用户无法访问且侧边栏无入口；再验证摘要首次翻译逐段出现、刷新命中缓存、Hide/Show、force 重译、断开/切换文本取消、未登录不调用，并确认 `packages/backend/data/` 未出现且未运行无关付费测试
