# Proposal

## Why

Paperland's `/mcp` server has grown to about 30 tools: paper library, Semantic Scholar, media upload, paper writes, and 13 Topic tools. Each tool was added by a separate change, and no one has reviewed the whole surface for overlap, oversized descriptions, inconsistent parameters or confusing permission boundaries. The surface is about to matter more, because the next planned change exposes the same server to ChatGPT's custom MCP connectors. A redundant or ambiguous tool list costs every client context and leads to wrong tool choices. The developer wants to ask for a design check at any time and get comparable results each time.

## What Changes

- Add an on-demand MCP design review procedure as a project skill invoked as `/mcp-review`, also discoverable by other coding agents through `AGENTS.md`.
- Add an offline inventory script that drives the real `/mcp` handler against a disposable database and prints the exact `initialize` instructions and `tools/list` surface with size statistics, so every review starts from the same measured input.
- Define a fixed checklist: redundancy and merge candidates, description quality and size, parameter naming and schema consistency, token-kind and permission boundaries, annotations, response size and pagination, error and not-ready guidance (for example, full text that doc2x has not parsed yet), and client compatibility (ChatGPT custom MCP, Claude, Codex).
- Define a fixed report format saved as `docs/mcp-reviews/YYYY-MM-DD.md`, with stable finding ids and a comparison against the previous report (new, persisting, resolved).
- Run the first review against the current server and save its report.
- The review never changes MCP behavior itself. Findings that need behavior changes are proposed as separate OpenSpec changes after the developer chooses them.

## Capabilities

### New Capabilities
- `mcp-design-review`: Repeatable, measurable review of the MCP tool surface with a fixed checklist, inventory and comparable reports.

### Modified Capabilities

## Impact

- New: `.claude/skills/mcp-review/SKILL.md`, `packages/backend/src/testing/mcp_inventory.ts`, `docs/mcp-reviews/`.
- `AGENTS.md`: one pointer to the review procedure.
- `docs/external-api.md` and `docs/tech-stack.md`: mention the inventory script and review reports. `docs/frontend-architecture.md` is unaffected.
- No runtime, API, database or UI change. No deployment is needed.
