## Context

Paperland 当前调用 AI 的链路只有 `qa_service`（pure service）：它在 `packages/backend/src/services/qa_service.ts` 里按 `models.available` 选模型，通过 `callOpenAI` / `callCodex` / `callCLI` 三条路径调用，prompt 用 `config.system_prompt` 里的 `{PAPER}` / `{PROMPT}` 占位符模板拼装（`template_loader.ts` 的 `getSystemPrompt()`）。配置在 `config.yml`，由 `config.ts` 用 Zod 校验；服务的并发 / 限流写在 `services.<name>`（`max_concurrency` / `rate_limit_interval`），由 `service_runner.ts` 的 Semaphore / RateLimiter 执行。数据库是 bun:sqlite + Drizzle，schema 在 `db/schema.ts`，迁移由 `drizzle-kit generate` 生成、启动时自动 apply；`images` 表已经示范了「按 SHA-256 内容寻址」的表（`hash` 作主键，相同字节去重到一行）。

本变更要加的是一个**通用「英译中」翻译服务**：输入一段文本（Markdown / 纯文本）→ 调 AI 翻译并保留格式 → 按输入内容缓存到数据库 → 相同文本直接命中缓存；用户点「重新翻译」则绕过缓存并覆盖原记录。它复用上述既有约定（snake_case API、Drizzle/bun-sqlite、Zod 配置校验、限流原语、AI 调用路径），是后续摘要 / TLDR 自动翻译与前端双语展示的底座。

## Goals / Non-Goals

**Goals:**
- 新增 `translation_service`（pure service），核心导出一个可复用的 `translateText(text, opts?)`：先查缓存命中即返回，否则按配置 prompt 调 AI 翻译、写缓存、返回结果。
- 翻译**保留原文格式**：Markdown 标记、代码块、行内代码、LaTeX 公式、列表、表格、换行等原样保留，只把英文正文译成简体中文，不加解释 / 不改结构。
- **预留可配置 prompt 接口**：`config.yml` 新增 `translation` 配置块（可选 `model` + 带 `{TEXT}` 占位符的 `prompt`），先给一份保留格式的默认 prompt，后续替换文案不动代码。
- 新增 `translations` 缓存表，按「源文本内容 hash + 目标语种」唯一缓存；命中即返回，不重复调 AI。
- 「重新翻译」语义：**绕过缓存**重新调 AI，并**原地覆盖**同一 `(source_hash, target_lang)` 行（更新译文 / 模型 / `updated_at`）。
- 新增内部 API：触发翻译（缓存优先）、强制重新翻译（覆盖）、按 hash 查询已缓存译文。
- AI 调用受 `services.translation_service` 的并发 / 限流约束（复用既有 Semaphore / RateLimiter 原语）。
- 新增前端可复用组件 `BilingualText`：输入一段纯文本，默认只展示英文，下方小按钮触发按需翻译（仅登录用户），翻译后在原文下方追加中文译文；接入论文详情页摘要。翻译缓存对全体用户共享（缓存表不带 `user_id`）。

**Non-Goals:**
- 不接入摘要 / TLDR 的**自动**翻译（入库时自动翻；不改 `papers` / 抓取服务 / 依赖图）——本期摘要走前端按需翻译，自动翻译留作后续。
- 本期前端只接入论文详情页**摘要**；TLDR 等其它字段的双语接入后续再做。
- 组件当前只渲染**纯文本**（`whitespace-pre-wrap` 保留换行），不做 Markdown 渲染。
- 不支持英译中之外的其他语种（`source_lang`/`target_lang` 字段预留，但当前固定 `en`→`zh`）。
- 不做超长文本的分块（chunking）翻译——本期依赖模型自身的 `max_tokens` 上限，超限作为已知限制（见 Risks / Open Questions）。

## Decisions

### D1. `translation_service` 做成 pure service，核心是可复用的 `translateText()` 函数
翻译的是「任意一段文本」，与某篇论文的某个字段无关，因此**不进** `depends_on`/`produces` 依赖图，而是像 `qa_service` 一样的 pure service：手动 / 程序化触发。核心导出 `translateText(text, { force? }): Promise<Translation>`，缓存优先、同步返回结果（便于将来双语展示同步取译文）。后续「摘要 / TLDR 自动翻译」只需在各自链路里 `await translateText(abstract)` 即可，无需改本服务。

**备选**：做成 paper-bound 服务（`depends_on: ['abstract']`, `produces: ['translated_abstract']`）→ 否决：会把「翻译」绑死到 papers 表与依赖图，无法翻译论文字段以外的文本，也和「通用文本翻译」的诉求不符；自动翻译接入留给后续变更按需包装。

### D2. 新增 `translations` 表，按内容 hash 寻址，`(source_hash, target_lang)` 唯一
仿照 `images` 表的「内容寻址」思路，用源文本的 SHA-256 做缓存键。表结构：
- `id`(integer PK autoincrement)
- `source_hash`(text, not null) —— `sha256(normalize(source_text))` 的十六进制
- `source_text`(text, not null) —— 规范化后的源文（便于排查与「重新翻译」时重放）
- `source_lang`(text, not null, default `'en'`)
- `target_lang`(text, not null, default `'zh'`)
- `translated_text`(text, not null) —— 译文
- `model_name`(text, nullable) —— 实际使用的模型名
- `created_at`(text, not null, ISO 8601)
- `updated_at`(text, not null, ISO 8601)
- 唯一约束 / 唯一索引：`(source_hash, target_lang)`

缓存查询、覆盖、未来多语种都靠这条唯一键。`source_hash` 单列也建索引以便按 hash 查询。

**备选**：把译文塞进 `papers.contents` JSON（如 `translated_abstract`）→ 否决：那样只能服务论文字段、无法缓存任意文本，且无法跨论文复用相同文本的译文；本变更要的是「通用文本缓存」。

### D3. 缓存键的规范化（normalize）：去首尾空白，内部格式原样
为提升命中率，hash 前对源文做**最小规范化**：仅去除整段文本的首尾空白（`trim`），**不动内部的任何格式 / 换行 / 缩进**（因为我们要保留格式）。`source_text` 存的是规范化后的文本，hash 也基于它计算，保证「同一段文本」稳定命中同一行。

**备选**：完全不规范化（hash 原始字节）→ 命中率低（尾随换行差异就 miss）；或做激进规范化（折叠空白、统一换行）→ 可能改变 Markdown 语义、破坏「保留格式」。取最小规范化折中。

### D4. 可配置翻译 prompt：`config.yml` 新增 `translation` 块（`{TEXT}` 占位符 + 可选 `model`）
新增配置：
```yaml
translation:
  model: gpt-4o            # 可选；缺省回退到 models.default
  prompt: |
    You are a professional translator. Translate the following English text into Simplified Chinese.
    Strictly preserve the original formatting: keep all Markdown syntax, code blocks, inline code,
    LaTeX math, lists, tables, and line breaks exactly as in the source. Translate only the natural-language
    text; do NOT translate code, math, URLs, or identifiers. Output only the translation, with no extra
    explanation or wrapping.

    {TEXT}
```
`template_loader.ts` 增 `getTranslationPrompt()` / `getTranslationModel()` 读取它；翻译时 `prompt.replace('{TEXT}', sourceText)` 拼装（与 qa 的 `{PAPER}`/`{PROMPT}` 同构）。`config.ts` 增 `translationSchema`（`model` 可选 string、`prompt` string）并挂到 `configSchema`。**先给可用默认 prompt，具体文案后续替换、不改代码**——满足「预留 prompt 接口」。

### D5. 抽出共享的模型调用工具 `model_invoke.ts`，qa 与翻译共用
`qa_service.ts` 里的 `callOpenAI` / `callCodex` / `callCLI` 及「按 `modelConfig.type` 分派」逻辑是自包含的纯函数。抽到 `packages/backend/src/services/model_invoke.ts`，导出 `callModel(prompt: string, modelName: string): Promise<string>`（内部按 `config.models.available` 找 modelConfig 并分派）。`qa_service` 改为调用它（行为不变），`translation_service` 也调用它。避免复制三段调用代码。

**备选**：翻译服务内部复制一份 OpenAI 调用 → 否决：重复代码、后续维护两处。抽取是低风险的纯搬移。

### D6. AI 调用受并发 / 限流约束，配置走 `services.translation_service`
翻译会打 AI API，需限流。复用 `service_runner.ts` 已有的并发 / 限流原语（Semaphore + RateLimiter），按 `config.yml` 的 `services.translation_service.{max_concurrency, rate_limit_interval}` 配置，在 `translateText` 真正发起 AI 调用前 acquire / await。`services.translation_service` 走既有 `serviceSchema`（已含这两个字段），无需改配置 schema。

### D7. API 形态：同步「缓存优先」翻译 + 强制重译 + 按 hash 查询
内部 API（`/api/*`，HTTP Basic Auth，`requireUser`）：
- `POST /api/translate` body `{ text: string, force?: boolean, cache_only?: boolean }` → `{ source_hash, source_text, translated_text, source_lang, target_lang, model_name, cached }`。
  - 缺省：命中缓存直接返回（`cached: true`）；未命中则翻译、写入、返回（`cached: false`）。
  - `force: true`：**绕过缓存**重新翻译，**覆盖**原行（`updated_at` 刷新），返回新结果（`cached: false`）——即「重新翻译」。
  - `cache_only: true`：**peek**——只查缓存、**不调 AI、不报 404**：命中返回 `cached:true`+译文，未命中返回 `cached:false`+`translated_text:null`（HTTP 200）。供前端在挂载时判断「这段文本是否已翻译过」以决定是否默认展开，**由后端做判断、前端无需自己算 hash**。
- `GET /api/translations/:hash`（可选 `?target_lang=zh`）→ 按 hash 仅查缓存：命中返回该行，未命中返回 404，不触发 AI（保留作按-hash 查询/工具用；前端的「是否已翻译」改用上面的 `cache_only` peek，避免前端算 hash 与 404 报错 toast）。

「重新翻译」用同一端点的 `force` 标志、「是否已翻译」用 `cache_only` 标志实现，集中在一个端点。

### D8. 前端 `BilingualText` 组件：纯文本 + 按需翻译 + 登录门禁 + 译文追加
新增 `packages/frontend/src/components/BilingualText.vue`（`<script setup lang="ts">`，遵循 `TagBadge.vue` 等叶子组件写法）：
- **Props**：`text: string`（英文原文）。不在组件里做 Markdown 渲染——用 `<p class="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{{ text }}</p>` 渲染纯文本（Vue 插值天然转义，`whitespace-pre-wrap` 保留换行）。
- **默认态**：只显示英文原文 + 下方一个小按钮（`<Button variant="ghost" size="sm">` + lucide `Languages` 图标，文案 **Translate**，英文 UI 文案）。
- **触发翻译**：点击按钮 → 调 `translationApi.translate(props.text)`（即 `POST /api/translate {text}`，**前端把文本喂进去**）。后端缓存优先，命中即秒回；返回 `translated_text` 后在原文下方追加一段中文译文块（带一行 muted 的 **Translation** 小标签）。
- **登录门禁**：点击时若 `useAuthStore().isAuthenticated` 为 false，则调 `useLoginPrompt().openLogin()` 唤起登录、不发请求（与 `QAInput.vue` 既有模式一致）；登录用户才真正翻译。后端 `requireUser` 是硬门禁，前端这层是体验。
- **加载 / 错误态**：翻译中按钮禁用并显示 `Loader2` 旋转图标；错误由 api client 统一 toast，组件复位按钮态。
- **译文显示后**：译文区头部为一行——**Translation** 标签 + 紧随其右、同一行的 **Hide / Show** 折叠开关与 **Re-translate**（调 `translate(text, true)`，`force` 覆盖刷新）；按钮用更小的 `size="xs"`。译文（中文）显示在该头部行下方。（UI 文案用英文，遵循项目「功能页 UI 用英文」约定。）
- **已翻译过默认展开**：挂载时（及 `text`/登录态变化时）对登录用户调 `translationApi.peek(text)`（`POST /api/translate {cache_only:true}`）——**后端判断**该文本是否已翻译：命中则把译文设上并默认展开，未命中则保持折叠（只显示原文 + Translate 按钮）。前端不算 hash；`cache_only` peek 不调 AI、miss 返回 200 不报错，避免挂载时误触发翻译或弹错误 toast。未登录不 peek（避免触发登录弹窗）。
- **缓存共享**：组件不持有跨页缓存，直接打后端；因 `translations` 表无 `user_id`，任意登录用户翻译过的同一段文本，其他用户进来即由 peek 命中、默认展开，不重复花 token。

**接入摘要**：`PaperDetail.vue` 宽 / 窄两处的 `<p>{{ abstract }}</p>` 替换为 `<BilingualText :text="store.currentPaper.abstract" />`。

**备选**：建一个 Pinia `translation` store 做前端侧缓存 → 否决：后端已是缓存优先，叶子组件直接调 api 更简单（参考 `QAInput` 直接取数据的做法），无需引入额外状态层。

## Risks / Trade-offs

- **超长文本超出模型上下文 / `max_tokens`** → 本期不做分块，依赖模型上限（沿用 qa 的 `max_tokens: 8192`）；超限时返回模型错误。Mitigation：文档标注为已知限制，分块列入 Open Questions / 后续变更。
- **模型未严格保留格式（破坏 Markdown / LaTeX）** → prompt 明确强约束格式保留 + 只译自然语言；并提供「重新翻译」兜底。Mitigation：可配置 prompt，便于后续按用户给的方案迭代文案。
- **缓存键不含 prompt / 模型版本，prompt 改了旧缓存仍命中旧译文** → 这是有意的简化（键只含 `source_hash + target_lang`）。Mitigation：「重新翻译」覆盖即为逃生口；是否把 prompt 版本纳入键见 Open Questions。
- **并发请求同一段未缓存文本** → 都 miss、都翻译、都 upsert 到同一唯一键，最后写入者胜，仅多花一次 token，无数据损坏。Mitigation：可接受；如需可加 in-flight 去重，列为后续优化。
- **抽取 `callModel` 触及 qa 关键路径** → 纯函数搬移、保持签名与行为；用现有 qa 流程验证。Mitigation：仅移动不改逻辑，回归验证 qa 模板与自由提问。
- **共享缓存 + 仅登录可翻译** → 缓存全局共享（无 `user_id`）是有意设计，节省 token；翻译入口仅登录用户（后端 `requireUser` 为硬门禁，前端登录门禁为体验层）。未登录用户即便能看到摘要原文，点「翻译」也会被引导登录、不能消耗 AI。Mitigation：门禁双层（API + UI），缓存读写不暴露用户身份。
- **按需翻译按钮每次点击都可能触发一次 AI 调用** → 仅首次（缓存未命中）真正调用，之后全体用户命中缓存秒回；「重新翻译」是显式覆盖。Mitigation：缓存优先 + 限流（D6）。

## Migration Plan

- 纯增量：仅新增 `translations` 表（`CREATE TABLE` + `(source_hash, target_lang)` 唯一索引 + `source_hash` 索引），不改任何既有表，无回填。
- `bunx drizzle-kit generate`（在 `packages/backend/`）生成迁移，启动时自动 apply。
- 配置增量：`config.example.yml` / `config.yml` 新增 `translation` 块与 `services.translation_service`；`translation` 为必填块（无默认），需在部署前补上（或在 schema 给安全默认 prompt 以兼容旧 config——见 Open Questions）。
- 回滚：删除新表与新路由 / 服务文件即可，对既有功能无影响。

## Open Questions

- `translation` 配置块是否给默认值以兼容尚未更新 `config.yml` 的环境？倾向：`prompt` 给一份安全默认（`.default(...)`），`model` 可选回退 `models.default`，使整块可选，避免现有部署因缺 `translation` 启动失败。（实现时确认）
- 缓存键是否纳入 prompt / 模型版本（prompt 变更后自动失效）？本期不纳入，靠「重新翻译」覆盖。
- 是否同时在 External API（`/external-api/*`，Bearer）暴露翻译端点？本期只做内部 API，按需再加。
- 超长文本分块翻译策略（按段落 / 标题切分后分别缓存再拼接）留待后续。

## Apply notes (resolved decisions)

- **`translation` 配置块做成可选 + 带默认**（Open Question 已定为「是」）：`translationSchema = z.object({ model?, prompt: z.string().default(DEFAULT_TRANSLATION_PROMPT) }).default({})`，整块缺省即用安全默认 prompt（含 `{TEXT}`），旧 `config.yml` 无 `translation` 也能启动。默认 prompt 已落到 `config.ts` 的 `DEFAULT_TRANSLATION_PROMPT`，并同步进 `config.example.yml` / `config.yml`，待用户给出正式 prompt 后只改配置。
- **模型调用抽取**：`services/model_invoke.ts` 导出 `callModel(prompt, modelName)`（搬 `qa_service` 的 openai_api/codex/cli 三路 + 分派；删了未用的 `shellQuote`），`qa_service.askQuestion` 改为调用它，行为不变。
- **并发/限流**：`translation_service` 直接复用 `semaphore.ts` / `rate_limiter.ts` 原语，按 `services.translation_service` 懒初始化，未改 `service_runner` 内部。
- **缓存写入用 upsert**：`insert(...).onConflictDoUpdate({ target: [source_hash, target_lang], set: {...} })` 同时覆盖「未命中插入」「`force` 重译」「并发同文本插入」三种情况——`force`/冲突时原地更新译文/模型/`updated_at`，保留 `created_at`，不产生重复行。
- **前端 UI 文案用英文**（Translate / Translation / Hide·Show / Re-translate），遵循项目「功能页 UI 用英文」约定（任务文里曾写中文占位，实现以英文为准）。
- **手动验证结果**（一次性真实 `codex-gpt-5.5` 调用，隔离临时 DB，未纳入每次重跑的单测）：首译 `cached:false`（~23s）→ 二次 `cached:true`（不再调 AI）→ `force` 覆盖同一行（`updated_at` 前进、行数仍为 1）→ `getCachedTranslation` 命中 + 缺失 hash 返回 null；格式保留样本完整保留 `#` 标题、`**加粗**`、`$...$` LaTeX、无序列表、URL，仅翻译自然语言。零成本侧另验了 config 解析、模块导入、normalize/hash、路由 401/400（Fastify inject）、前端类型检查。
- **上线提示**：需重启后端以加载新路由并应用迁移 `0018`（启动时自动 apply）；前端浏览器点击通路（任务 8.2）留给运行环境验证，避免为此重启共享后端而把其他 agent 尚未完成的迁移一并 apply 到共享库。
