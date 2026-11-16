# Design

## Context

`/mcp` (`api/mcp.ts`) authenticates `Authorization: Bearer` tokens through `checkBearerToken`, which looks up `api_tokens`. Topic tokens already store a hash of a `plt_` secret (`topicTokenVerifier`), not the raw value. Tool gating today is per token kind: `requirePersonal` in `agent_tools.ts` and `personal()` in `topic_tools.ts`. The web app deletes papers in `api/papers.ts` (hard cascade, any signed-in user) and soft-deletes Q&A results in `api/qa.ts` (free answers by owner or admin, not while active). Fastify's built-in logger logs `req.url`.

## Goals / Non-Goals

**Goals:** ChatGPT (and similar clients) connect with a URL only; separate connections per app; deletes behind separate permissions; Q&A written by external models saved and signed.

**Non-Goals:** OAuth; per-service usage counters (the user and Topic counters continue unchanged); changing the web delete rules; controlling logs of the external reverse proxy host.

## Decisions

- **Store services in `api_tokens` as kind `service`** with new nullable columns `name` and `permissions` (JSON). This reuses ownership, revocation, rotation and the active-owner check, and keeps the spec's single token store. Secrets look like `pls_<64 hex>` and are stored as SHA-256 hex (same verifier style as Topic tokens). Alternative considered: a new table. It would duplicate the lifecycle code.
- **Route `POST /mcp/s/:secret`** shares the JSON-RPC handler with `/mcp`. Unknown or revoked secrets get 404 rather than 401, because a 401 with `WWW-Authenticate` would make ChatGPT start an OAuth discovery. The context carries `token_kind: 'service'` and `permissions`.
- **One permission gate.** Each tool gets a required permission (`read` | `write` | `delete_papers` | `delete_answers`), derived from existing flags (`write`, annotations) plus explicit marks on the new tools. A service with `write` passes the existing personal-only checks. `tools/list` on a service filters by the gate, while Bearer tokens keep today's list for compatibility. The broader per-kind filtering (review PERM-1) stays for the streamline change.
- **Signature in `model_name`.** `add_paper_qa` stores `"<model> [MCP]"` (the bracket names the channel; MCP is the only one today), so every existing Q&A view, copy link and toast shows the signature with no per-view changes. The new nullable `qa_results.source = 'mcp'` lets the UI hide "regenerate" (QAResultBody) and lets tools report the source.
- **Shared deletion helpers.** Extract the web delete logic into `services/paper_delete.ts` (`deletePaperCascade`) and a Q&A helper (`softDeleteQAResult` with the owner/active checks). Routes and tools call the same code.
- **Log redaction.** A Fastify `req` serializer replaces `/mcp/s/<secret>` with `/mcp/s/[redacted]`. Route-level errors never echo the path.
- **UI.** A dedicated **Plugins** page, description "Connect to your own apps" (route with `meta.title`/`meta.icon`, sidebar entry in `App.vue`, wrapped in `AppPage`): list (name, permission chips, created/rotated), a create form (name plus three checkboxes, delete options unchecked with a warning), a one-time URL display with copy, edit permissions, rotate and revoke with confirmations. English UI text.

## Risks / Trade-offs

- [URL leaks through screenshots or chat history] → Shown once, rotatable and revocable, permissions scoped. Docs warn to treat the URL as a password.
- [External reverse proxy may log full URLs] → Outside this repo. Documented. Rotation limits the exposure.
- [`delete_paper` deletes globally like the web app] → Separate permission, off by default, annotated destructive (ChatGPT asks for confirmation).
- [Signature inside `model_name` can't be parsed back reliably] → `source` keeps the structured flag. The signature is for display.

## Migration Plan

Additive Drizzle migration (new nullable columns), backend restart, then the queued frontend build. Rollback: older code ignores the new columns, and service rows are rejected by the older `checkBearerToken` kind lists.
