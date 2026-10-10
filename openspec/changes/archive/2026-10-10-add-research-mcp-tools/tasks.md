## 1. Config and shared types

- [x] 1.1 `config.ts`: `agent_tools` block (no token TTL) (zod, explicit `.default({...})`), shared `AgentToolsConfig` type in `packages/shared/src/types.ts`; `config.example.yml` documents the block (minimal edit)

## 2. S2 client and cache

- [x] 2.1 `semantic_scholar_service.ts`: export `s2ApiGet(path, params)` through `s2Request` (key, rate gate, backoff)
- [x] 2.2 `s2_paper_cache.ts`: export `cacheS2Records(records)` merging partial records into `s2_papers` without erasing existing fields; unit tests

## 3. Tools, tokens, MCP endpoint

- [x] 3.1 `services/api_tokens.ts`: token values, masking, `ensureAgentToken` (idempotent get-or-create), `resetAgentToken` (in place), personal create / revoke-own, `checkBearerToken(raw, kinds)` (revoked / ownerless / inactive → reject)
- [x] 3.2 `services/agent_tools.ts`: site tools (`search_papers`, `get_paper`, `read_paper` incl. outline, `get_paper_qa`) and S2 tools (`s2_search`, `s2_match`, `s2_papers`, `s2_citations`, `s2_references`, `s2_get` with path validation); unit tests with mocked S2
- [x] 3.3 `api/mcp.ts`: `POST /mcp` JSON-RPC (`initialize`, `ping`, `tools/list`, `tools/call`, notifications → 202, batch, `-32601`), `api_tokens` bearer check accepting personal + agent (401 otherwise, any origin), `GET`/`DELETE` → 405; register in `index.ts`; route tests

## 3b. API token kinds and self-service

- [x] 3b.1 `db/schema.ts`: `api_tokens.kind` (default `personal`), `rotated_at`, partial unique index on `user_id` for agent tokens; migration `0037_agent_tokens` (drizzle-generated + agent-token backfill for active users)
- [x] 3b.2 Agent token lifecycle: created on admin user creation and registration approval (`api/users.ts`), startup backfill for active users without one (`db/index.ts`, covers the seeded admin); rejecting a pending user also deletes its tokens
- [x] 3b.3 `auth/token_auth.ts`: External API rejects agent tokens; `api/settings.ts`: list shows `kind` / `rotated_at`, agent value null, agent tokens not revocable (400)
- [x] 3b.4 `api/tokens.ts`: `GET/POST /api/auth/me/tokens`, `DELETE /api/auth/me/tokens/:id`, `POST /api/auth/me/agent-token/reset` (own tokens only, agent value never returned); tests (`api/tokens.test.ts`)
- [x] 3b.5 Frontend: `AccountDialog.vue` API Tokens section (MCP URL, personal list / create-once / revoke, Codex agent token with Reset + confirm), `Settings.vue` kind badge and no revoke for agent tokens, `myTokensApi`; type check + scratch build
- [x] 3b.6 `auth/token_auth.ts`: External API also rejects tokens whose owner exists but is not active (owner-less legacy tokens still accepted); test in `api/tokens.test.ts`

## 4. Codex provider and research runtime

- [x] 4.1 `model_providers/types.ts` + `codex_provider.ts`: `ModelInput.mcp_servers` / `skill_roots`, `ModelInvokeOptions.onToolCall`; app-server injects `config.mcp_servers` with `bearer_token_env_var` + child env, sends `skills/extraRoots/set` before `thread/start`, reports `mcpToolCall` / `webSearch` items; unit tests
- [x] 4.2 `research_runtime.ts`: when `agent_tools.enabled`, pass the MCP server with the session owner's agent token (`ensureAgentToken`) + skill root, publish SSE `tool` events (`qa_result_stream.ts` event type)
- [x] 4.3 `prompts/system/research.md`: tool usage rules; new `prompts/skills/s2-literature-search/SKILL.md`

## 5. Frontend

- [x] 5.1 `api/client.ts` (`tool` SSE event), `stores/research.ts` (latest tool activity per active step), `views/ResearchDetail.vue` (show it in the active step card); type check + scratch build via `bun run build:frontend --out-dir <scratch>`

## 6. Docs and verification

- [x] 6.1 Update `docs/tech-stack.md` and `docs/frontend-architecture.md`; note in `docs/external-api.md` that `/mcp` is internal
- [x] 6.2 Restart the backend (no active rounds / QA) to apply `0037`; confirm every active user has exactly one agent token; run a small real round with `codex-gpt-6-luna-low` on a temporary session (tools called with the injected agent token, skill visible); delete the session and the temporary login session; confirm `CODEX_HOME/config.toml` unchanged and `packages/backend/data/` absent
- [x] 6.3 `openspec validate add-research-mcp-tools --strict`
