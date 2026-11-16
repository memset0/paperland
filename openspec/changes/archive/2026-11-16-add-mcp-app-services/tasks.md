# Tasks

## 1. Service storage and authentication

- [x] 1.1 Add nullable `api_tokens.name`, `api_tokens.permissions` and `qa_results.source` with a generated Drizzle migration and shared types; verify the migration applies to a copy of the schema in tests.
- [x] 1.2 Implement service create/list/update/rotate/revoke (hashed `pls_` secrets) and `/api/auth/me/mcp-services` routes scoped to the signed-in user; verify with offline route tests (one-time URL, rotation invalidates, other users cannot see or modify).
- [x] 1.3 Add `POST /mcp/s/:secret` (405 for other methods, 404 for invalid/revoked/rotated/inactive owner), permission-filtered `tools/list`, the permission gate in `callAgentTool`, and log redaction; verify with offline MCP tests including a read-only service and a redaction check of the request serializer.

## 2. New tools

- [x] 2.1 Extract shared paper and Q&A deletion helpers, use them in the web routes, and add `delete_paper` / `delete_qa_answer`; verify existing paper/Q&A delete tests still pass and new tool tests cover permissions and owner rules.
- [x] 2.2 Add `add_paper_qa` (signature `<model> [MCP]`, server times, `source` mcp) and `source` in `get_paper_qa`; verify offline tests for saving, validation and attribution.
- [x] 2.3 Record `images.uploaded_via` (`<app> [MCP]`, Paperland for agent runs) in `upload_image` and show it on the Images page; verify offline upload tests for service, agent and personal tokens.
- [x] 2.4 Make `search_papers` list the site or a Topic's papers (`query` optional, `topic_id`, `offset`/`next_offset`, access checks); verify offline tests for site listing, Topic listing and access denial.

## 3. Frontend

- [x] 3.1 Add a dedicated "Plugins" page ("Connect to your own apps"; route meta, sidebar entry, `AppPage`) (create with permissions, one-time URL with copy, edit, rotate, revoke) and hide regenerate for `source` mcp answers; verify type checking and a scratch frontend build.

## 4. Docs and deployment

- [x] 4.1 Update `docs/external-api.md`, `docs/tech-stack.md` and `docs/frontend-architecture.md`; verify they match routes, tools and UI.
- [x] 4.2 Deploy: restart the backend from the project root, run `bun run build:frontend`, then verify health, the served assets, and an MCP `initialize`/`tools/list` through the existing ChatGPT service URL (tools/list only, no tool calls).

## Workflow follow-up

- Report deployment and ask the developer to create their ChatGPT service and connect it, then ask whether to archive.
