## Why

Deep Research 的 Codex 回合目前只有 web search：S2 paperId 只能靠搜索网页猜（MLSys 迁移那轮 135 篇里一篇 id 都没拿到），也读不到本站已入库论文解析好的全文。需要把本站数据和 Semantic Scholar 作为工具交给模型，同时不泄露 S2 key、不冲垮共享的 ~1 RPS 限速。

## What Changes

- 新增本站 MCP 端点 `POST /mcp`（Streamable HTTP，无状态 JSON-RPC），提供只读工具；任何来源都可访问，但必须带有效的 Bearer token。Deep Research 回合自动接入，用户也可以用自己的 personal token 在其他服务里接入。
- **本站数据工具**：`search_papers`（标题 / 作者 / 摘要检索已列出论文）、`get_paper`（元数据、标签、S2 id、链接、全文是否可读）、`read_paper`（分页读取解析后的 Markdown，`outline` 模式返回章节标题与偏移）、`get_paper_qa`（该论文对调用者可见的 QA 回答，按现有共享规则过滤）。
- **S2 工具**（全部经后端现有的 S2 请求通道：同一个 key、共享限速与 429/5xx 退避；模型拿不到 key）：`s2_search`、`s2_match`（按标题补 paperId）、`s2_papers`（批量元数据，走 S2 缓存解析）、`s2_citations` / `s2_references`、`s2_get`（通用 GET 透传，仅允许 `agent_tools.s2_get_path_prefixes` 下的路径，默认 `/graph/v1/`）。搜索、匹配和引用工具拿到的论文顺带写入 `s2_papers` 缓存。
- **鉴权统一用现有 `api_tokens` 表**（不另起一套 token）：`/mcp` 接受 personal 和 agent 两种 token，按 token 所属用户的可见性执行工具；无效、吊销、无属主或非 active 用户的 token 返回 401。
- **`api_tokens` 加 `kind` 列**（`personal` 默认 | `agent`）和 `rotated_at`，附加迁移 `0037_agent_tokens`，部分唯一索引保证**每个用户恰好一个 agent token**，迁移为现有 active 用户回填。
- **Codex agent token**：admin 新建用户、注册审核通过、首启 seeding 时自动创建，启动时为缺失的 active 用户兜底，运行时 get-or-create（幂等）。任何 API 都不返回它的值；用户只能原地重置（旧值立即失效）。只有 `/mcp` 接受它，External API 拒绝。研究回合用会话所有者的 agent token 注入 Codex（子进程环境变量，不进 prompt 或配置）。
- **用户自管 personal token**：账户对话框新增 API Tokens 区块（列表掩码、新建时完整值只显示一次、吊销；显示 MCP URL；Codex agent token 只显示时间和 Reset）。新接口 `GET/POST /api/auth/me/tokens`、`DELETE /api/auth/me/tokens/:id`、`POST /api/auth/me/agent-token/reset`，只能操作自己的 token。admin 全局列表保留，标注类型，agent token 不显示值、不能吊销。
- **注入**：研究回合启动 Codex app-server 时通过 `thread/start` 的配置覆盖注入 MCP 服务器 `paperland`，并用 `skills/extraRoots/set` 把仓库里的 skill 目录加入本次进程的 skill 根目录（不写入全局 `CODEX_HOME`，不影响用户自己的 Codex）。
- **S2 检索 skill**：仓库内新增 `prompts/skills/s2-literature-search/SKILL.md`，教模型如何用上述工具高效检索、按标题补 paperId、做引用追溯、控制调用次数。
- **research prompt**：新增工具使用规则——S2 id 优先用 `s2_match` / `s2_search` 查，已入库论文用本站工具读全文；原有规则（公式、JSON 转义、📄 在库链接等）保留。
- **工具调用进度**：研究回合的 SSE 新增 `tool` 事件（工具名与状态），前端在回合进行中显示当前工具调用，不落库。
- 新配置块 `agent_tools`（开关、本站 MCP 基址、各工具上限、S2 透传允许的路径前缀、skill 目录）。
- 文档：三份 docs 同步；`docs/external-api.md` 写清 token 管理（personal / agent）与 `/mcp` 鉴权。

## Capabilities

### New Capabilities

- `research-agent-tools`: 本站 MCP 端点及其 API token 鉴权、本站数据工具与 S2 工具（含透传路径限制、缓存写入）、研究回合注入（owner 的 agent token + S2 检索 skill）、`agent_tools` 配置。

### Modified Capabilities

- `deep-research`: 回合输入与 prompt 规则增加工具使用说明，回合可用 Paperland 工具与 S2 检索 skill；回合 SSE 增加 `tool` 事件，前端显示工具调用进度。
- `auth`: External API 拒绝 agent token 与属主非 active 的 token（无属主的老 token 仍放行）；admin token 列表带 kind、agent token 不显示值且不可吊销；新增用户自管 personal token 与 Codex agent token。
- `database-schema`: `api_tokens` 增加 `kind`、`rotated_at` 与每用户唯一 agent token 的部分唯一索引。

## Impact

- **Backend**：新 `api/mcp.ts`、`api/tokens.ts`、`services/agent_tools.ts`、`services/api_tokens.ts`（+ 测试）；`auth/token_auth.ts`（拒绝 agent token）、`api/settings.ts`（kind、agent 不显示值不可吊销）、`api/users.ts`（新建 / 审核通过时建 agent token，拒绝注册时删其 token）、`db/index.ts`（启动兜底）、`db/schema.ts` + 迁移 `0037_agent_tokens`；`services/semantic_scholar_service.ts`（导出通用 GET）、`services/s2_paper_cache.ts`（合并写入缓存）、`services/model_providers/codex_provider.ts` 与 `types.ts`（MCP 服务器、skill 根目录、工具调用回调）、`services/research_runtime.ts`（签发 / 作废 token、`tool` 事件）、`services/qa_result_stream.ts`（事件类型）、`config.ts`、`index.ts`（注册 `/mcp`）。
- **Prompts**：`prompts/system/research.md`、新 `prompts/skills/s2-literature-search/SKILL.md`。
- **Frontend**：`api/client.ts`（SSE `tool` 事件、`myTokensApi`）、`stores/research.ts`、`views/ResearchDetail.vue`、`components/AccountDialog.vue`（API Tokens）、`views/Settings.vue` + `stores/settings.ts`（kind 标注）。
- **Shared**：`types.ts`（`AgentToolsConfig`、`ResearchToolEvent`、`ApiToken.kind`、`MyApiTokens`）。
- **Config**：`config.example.yml` 新增 `agent_tools` 块。
- **数据库**：附加迁移 `0037_agent_tokens`（加列 + 部分唯一索引 + 回填），兼容旧数据。依赖：无新 npm 包（MCP 协议子集自行实现）。
