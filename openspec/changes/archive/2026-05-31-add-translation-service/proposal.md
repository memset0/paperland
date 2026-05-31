## Why

Paperland 的论文摘要、TLDR 等核心文本目前只有英文原文，国内用户阅读时缺少中文对照。我们需要一个**通用的「英译中」翻译服务**：给定一段文本（Markdown 或纯文本），调用 AI 翻译并保留原有格式，把结果按输入内容缓存到数据库，相同文本再次出现时直接命中缓存、不重复花费 token。它是后续「摘要 / TLDR 自动翻译」与前端「中英双语展示」的底座，本变更先把这个底座（服务 + 缓存 + 可配置 prompt 接口 + API）建好。

## What Changes

- **新增通用翻译服务** `translation_service`（pure service，类似 `qa_service`：手动 / 程序化触发，不进依赖图）：输入一段英文文本（Markdown 或纯文本），调用配置的 AI 模型翻译为简体中文，**要求保留原文格式**（Markdown 标记、代码块、LaTeX、列表、换行等原样保留），只输出译文。
- **预留可配置的翻译 prompt 接口**：在 `config.yml` 新增 `translation` 配置块，含可选 `model` 与带 `{TEXT}` 占位符的 `prompt` 模板（先给一份保留格式的默认 prompt，具体文案后续替换，不改代码）。
- **新增翻译结果缓存表** `translations`：按「源文本内容 hash + 目标语种」缓存源文 / 译文 / 所用模型；命中即直接返回缓存结果。
- **「重新翻译」覆盖语义**：对同一条文本触发重新翻译时，**绕过缓存**重新调用 AI，并**覆盖**数据库中原有记录（同一 hash 行原地更新译文 / 模型 / 更新时间）。
- **新增内部 API**：触发翻译（命中缓存或现翻并缓存）、强制重新翻译（覆盖）、按 hash 查询已缓存译文。
- **新增服务配置**：`config.yml` 的 `services.translation_service` 下配置 `max_concurrency` / `rate_limit_interval`，复用既有限流 / 并发控制约束 AI 调用。
- **新增前端「双语文本」组件** `BilingualText`：接收一段**纯文本**（当前不做 Markdown 渲染），默认只展示英文原文，在文本下方追加一个小按钮；**仅登录用户**点击后才把该文本喂给翻译服务（前端发起 `POST /api/translate`），翻译完成后在英文下方**追加显示**中文译文。翻译缓存对全体用户共享（缓存表不按用户隔离）。
- **接入论文详情页摘要**：在 `PaperDetail.vue` 用 `BilingualText` 包裹论文 `abstract` 的展示，使摘要支持按需中英双语。

## Capabilities

### New Capabilities
- `text-translation`: 通用「英译中」文本翻译服务——保留格式的 AI 翻译、可配置的翻译 prompt 模板（`{TEXT}` 占位符 + 可选模型）、按内容 hash 的数据库缓存（命中即返回、全体用户共享不按用户隔离）、「重新翻译」绕过缓存并覆盖原记录、触发 / 重译 / 查询缓存的内部 API（仅登录用户可用）、复用服务并发与限流控制。
- `bilingual-text-display`: 前端可复用的「双语文本」组件——输入纯文本、默认展示英文、文本下方小按钮触发按需翻译（仅登录用户，未登录则唤起登录）、翻译后在原文下方追加中文译文、支持重新翻译；并接入论文详情页摘要。

### Modified Capabilities
- `database-schema`: 新增 `translations` 表（源文本内容 hash、源文 / 译文、源 / 目标语种、所用模型、创建 / 更新时间；`(source_hash, target_lang)` 唯一）。

## Impact

- **Backend**: 新增 `packages/backend/src/services/translation_service.ts`（核心 `translateText()` / `retranslate()` + 缓存读写 + AI 调用，复用 `qa_service` 的 `openai_api` 调用路径 / 限流工具）；新增 `packages/backend/src/api/translation.ts`（触发 / 重译 / 查询缓存路由），并在 `packages/backend/src/index.ts` 注册；修改 `packages/backend/src/db/schema.ts` 新增 `translations` 表；新增 Drizzle 迁移（仅 CREATE TABLE）；修改 `packages/backend/src/config.ts` 增加 `translation` 配置块的 Zod 校验。
- **Config**: `config.yml` / `config.example.yml` 新增 `translation`（`model?` + `prompt`）与 `services.translation_service`（`max_concurrency` / `rate_limit_interval`）配置。
- **Shared**: `packages/shared/src/types.ts` 新增 `Translation` 类型及翻译请求 / 响应类型。
- **Frontend**: 新增 `packages/frontend/src/components/BilingualText.vue`（纯文本展示 + 翻译按钮 + 译文追加 + 登录门禁 + 加载 / 重译态）；`packages/frontend/src/api/client.ts` 新增 `translationApi`（`translate(text, force?)` / `getCachedTranslation(hash)`）；修改 `packages/frontend/src/views/PaperDetail.vue` 用 `BilingualText` 包裹摘要（宽 / 窄两处布局）；复用 `stores/auth.ts` 的 `isAuthenticated` 与 `composables/useLoginPrompt.ts`。
- **Database**: 需要新的 Drizzle 迁移（新增 `translations` 表，不改动既有表）。
- **Docs**: 更新 `docs/external-api.md` / 内部 API 说明（翻译端点）、`docs/frontend-architecture.md`（新增 `BilingualText` 组件）、`docs/tech-stack.md`（如有必要，记录翻译服务与缓存约定）。
- **Non-Goals（本变更不做）**: 摘要 / TLDR 等的**自动**翻译接入（入库时自动翻译）、TLDR 等其它字段的双语接入（本期只接摘要）、组件内 Markdown 渲染（当前只渲染纯文本）、英译中之外的其他语种——这些作为后续变更，本变更提供可被其复用的服务、API 与组件。
