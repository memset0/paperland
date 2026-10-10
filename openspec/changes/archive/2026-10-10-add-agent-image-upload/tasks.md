## 1. MCP tool

- [x] 1.1 `checkBearerToken` returns the token kind; `AgentToolContext.token_kind`; per-tool `annotations` in `AgentToolDef` and `/mcp` listing
- [x] 1.2 `upload_image` tool (path for agent tokens inside `<codex_home>/generated_images/`, realpath check; `data` for any token; `alt`) via `storeImage`
- [x] 1.3 Tests: path accepted/rejected (outside dir, `..`, symlink, personal token), data upload, listing annotations

## 2. Codex runs

- [x] 2.1 `ModelMcpServer.enabled_tools` / `approved_tools` → thread config; provider test
- [x] 2.2 Shared `attachAgentTools(input, userId, opts)` with `upload_image` pre-approved and the figure snippet appended; research uses it
- [x] 2.3 Q&A: attach the server restricted to `upload_image` for Codex app-server models with a requester
- [x] 2.4 `prompts/agent/figures.md`; research prompt tool list mentions `upload_image`
- [x] 2.5 Tests: research/Q&A input assembly (tools, approval, instruction only with tool)

## 3. Docs and verification

- [x] 3.1 Update `docs/tech-stack.md`, `docs/external-api.md`, `docs/frontend-architecture.md`
- [x] 3.2 Run affected tests and `vue-tsc`; real Codex Q&A run that draws a figure and renders it
