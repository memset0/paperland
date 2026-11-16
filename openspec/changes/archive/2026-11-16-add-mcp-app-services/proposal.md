# Proposal

## Why

The developer wants to use Paperland from ChatGPT under their chat subscription: search and add papers, read them, and save Q&A that the chat model writes. ChatGPT's "Add custom MCP server" dialog takes only a server URL with OAuth or no authentication, and it cannot send Paperland's `Authorization: Bearer` header, so `/mcp` is unreachable from it today (review finding COMPAT-1). Each user should be able to create a separate connection per application (ChatGPT, other clients), each with its own permissions. Deleting papers and deleting answers must be granted separately from ordinary writes (PERM-2). Q&A added through such a connection should be attributed automatically to the application and the model that wrote it.

## What Changes

- **MCP services**: a signed-in user creates named services (e.g. "ChatGPT") on a dedicated Plugins page ("Connect to your own apps"). Each service gets a secret service URL `https://<site>/mcp/s/<secret>`, shown once, which works as an MCP endpoint with no other authentication. Permissions per service: write (on by default), delete papers (off), delete answers (off). Users can list, change permissions, rotate the URL and revoke a service. Secrets are stored hashed and redacted from Paperland's own request logs.
- `/mcp` keeps Bearer tokens unchanged. A service URL acts as its owner with that service's permissions; `tools/list` advertises only the tools the service may call.
- New MCP tools:
  - `add_paper_qa(paper_id, question, answer, model)` saves a Q&A pair to the caller's own Q&A on the paper. The answer is signed `<model> [MCP]` (the bracket is the channel), e.g. "gpt-5 [MCP]", with the server's time and source `mcp`. Needs write permission.
  - `delete_paper(paper_id)` with the same effect and rules as deleting in the web app. Needs the delete papers permission.
  - `delete_qa_answer(result_id)` with the same soft-delete rules as the web app. Needs the delete answers permission.
- `get_paper_qa` includes the answer source and result id.
- `search_papers` lists the whole site or one Topic's papers (`topic_id`), with an optional query and `offset` paging.
- Images uploaded through MCP record and show their app: "ChatGPT [MCP]" for a service, "Paperland [MCP]" for Paperland's own agent runs (e.g. internal Q&A).
- The MCP initialize instructions and the `read_paper` description tell models to read Paperland's parsed full text instead of arXiv HTML, using arXiv or `read_pdf_page` only for tables and figures, and to save kept answers with `add_paper_qa`. MCP-sourced answers cannot be "regenerated" with a site model from the UI, because their model is not a configured site model.

## Capabilities

### New Capabilities
- `mcp-services`: Per-user, per-application MCP service URLs with permissions, lifecycle and logging protection.

### Modified Capabilities
- `research-agent-tools`: Changes `/mcp` authentication to also accept service URLs, opens paper write tools to services with write permission, and adds the Q&A write tool, the delete tools and the Q&A attribution.

## Impact

- DB (additive migration): `api_tokens.name`, `api_tokens.permissions` (service rows of kind `service`), `qa_results.source`, `images.uploaded_via`. No MINOR bump is needed.
- Backend: `api/mcp.ts` (service route, list filtering), `services/api_tokens.ts`, new `api/mcp_services.ts` routes, `services/agent_tools.ts` (new tools, permission gate), shared paper/QA deletion helpers reused by `api/papers.ts` / `api/qa.ts`, and log redaction in `index.ts`.
- Frontend: a dedicated **Plugins** page ("Connect to your own apps"; sidebar entry, `AppPage`) to manage MCP services, and the attribution badge plus hidden regenerate in the QA result views. Shared types.
- Docs: `docs/external-api.md`, `docs/tech-stack.md`, `docs/frontend-architecture.md`.
- Deployment: backend restart and queued frontend build.
