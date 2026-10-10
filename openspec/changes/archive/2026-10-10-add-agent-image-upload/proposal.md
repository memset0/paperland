## Why

Codex can draw: its built-in `image_gen` tool (with the bundled `imagegen` skill) works in our ephemeral read-only app-server runs and saves each image under `$CODEX_HOME/generated_images/<thread>/<item>.png`. But that file lives on the server's disk, so an answer cannot show it. If the agent can put the image into the site's image host through the Paperland MCP server, Q&A answers and Deep Research reports can embed figures that the existing Markdown renderer already displays.

## What Changes

- New MCP tool `upload_image` on `/mcp`: stores an image in the image host (same validation, size limit, type whitelist and content-addressed dedup as uploads) owned by the token's user, and returns `{ url, markdown }` (`/image/<path>`, `![alt](url)`). Input is either:
  - `path`: an absolute path to an image that Codex generated, which must resolve inside `<codex_home>/generated_images/` of a configured Codex model. Only accepted with an agent token (the server's own Codex runs); personal tokens get a tool error.
  - `data`: base64 or a `data:` URL (any token, for external MCP clients).
- `POST /mcp` accepts bodies up to the image host's size limit (base64 + overhead) instead of Fastify's 1 MB default, so `data` uploads of real images are not rejected with 413 (found during verification).
- `upload_image` is the first non-read-only tool: it declares `readOnlyHint: false` (idempotent, non-destructive). The MCP endpoint's "every tool is read-only" rule changes accordingly.
- Codex runs that attach the `paperland` server pre-approve `upload_image` through the thread config (`mcp_servers.paperland.tools.upload_image.approval_mode = "approve"`), since `approvalPolicy: never` otherwise rejects non-read-only MCP calls (verified by probe).
- Q&A runs on Codex app-server models now also get the `paperland` MCP server (the requester's agent token), limited to `upload_image` via `enabled_tools`. Deep Research rounds keep all tools plus `upload_image`.
- Both get a short "Figures" instruction appended to the system prompt when the tool is attached: draw when asked or when a figure clearly helps, use `image_gen`, then call `upload_image` with the saved file path and embed the returned Markdown; the built-in preview and Mermaid code are not shown to readers; never reference local paths or placeholders.
- Generated-image files stay where Codex writes them (no cleanup in this change).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `research-agent-tools`: adds `upload_image`, relaxes the read-only rule for it, pre-approves it for Paperland's Codex runs, attaches the server (image tool only) to Q&A Codex runs, and adds the figure instruction.

## Impact

- Backend: `services/agent_tools.ts` (tool, caller token kind in context), `api/mcp.ts` (per-tool annotations, context), `services/api_tokens.ts` (`checkBearerToken` returns the kind), `services/model_providers/{types,codex_provider}.ts` (`enabled_tools`, pre-approved tools in thread config), `services/research_runtime.ts`, Q&A path (`api/qa.ts` / `services/qa_service.ts`), new prompt snippet `prompts/agent/figures.md`.
- No schema change; image rows use the existing `images` table.
- Docs: `docs/tech-stack.md`, `docs/external-api.md` (MCP tool list), `docs/frontend-architecture.md` (images in answers render via existing Markdown).
