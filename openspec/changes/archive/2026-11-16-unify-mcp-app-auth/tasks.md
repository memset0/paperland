# Tasks

## 1. Backend auth

- [x] 1.1 Add `resolveServiceKey` and accept the header form on `/mcp` (Bearer service key with service permissions/name in the context), accept converted key formats on `/mcp/s/:key`, and limit `TokenKind` to agent/service; verify offline MCP and service tests (header and URL give identical `tools/list`, revoked/rotated keys rejected).
- [x] 1.2 Add idempotent `convertLegacyTokens()` at startup (personal → hashed service "API token <id>", topic → service "Topic token <id>", revoked rows untouched); verify an offline test that an old personal key and an old Topic key still authenticate afterwards and a revoked one does not.
- [x] 1.3 External API `tokenAuth` uses service keys (write required for non-GET/HEAD, agent tokens 401); verify offline tests.
- [x] 1.4 Topic Git authenticates service keys for any accessible Topic (push needs `write`, editor, unarchived) and history returns `pushed_via`; verify offline Git tests including read-only service push refusal and the via name.
- [x] 1.5 Remove the Topic token tools, routes and service functions, `/api/auth/me/tokens` (add `GET /api/auth/me/agent-token`), and admin issuance; admin list/revoke cover agent and service rows without values; count Topic calls by `topic_id` argument; update affected tests.

## 2. Frontend

- [x] 2.1 Plugins page one-time reveal shows the service URL, the `/mcp` + Bearer header form and Git usage; Settings drops the API tokens section (keeps the Codex agent token, links to Plugins) and admin token management matches the new list; TopicDetail drops Connect and shows "via <app>" in history; verify type checking and a scratch build.

## 3. Docs and deployment

- [x] 3.1 Update `docs/external-api.md`, `docs/tech-stack.md`, `docs/frontend-architecture.md`, `docs/topics.md`, the MCP instructions text and the mcp-review skill notes about token kinds.
- [x] 3.2 Deploy (backend restart, frontend build); verify health, that the conversion ran (no active personal/topic rows remain, counts match), `/mcp` `tools/list` via both the header and URL forms for the ChatGPT service, and Topic Git `info/refs` with a service key (read only).
