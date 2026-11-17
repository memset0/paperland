# Design

## Context

`api_tokens` holds four kinds:
- `personal`: plaintext `sk-…`, accepted by `/mcp` and the External API.
- `agent`: plaintext, internal Codex only.
- `topic`: hashed `plt_…`, MCP and Topic Git, bound to one Topic.
- `service`: hashed `pls_…` as `service_sha256:<hex>`, `/mcp/s/<key>` only.

`checkBearerToken` (MCP, Topic Git) and `tokenAuth` (External API) look tokens up separately. `topic_pushes.token_id` already records the credential of each push.

## Decisions

- **One resolver.** `resolveServiceKey(raw)` in `services/mcp_services.ts` looks up a key whatever its prefix, as `service_sha256:<sha256(raw)>`. For converted Topic tokens, whose stored value is `topicTokenVerifier(raw)`, the lookup also tries that verifier when the raw key starts with `plt_`. Rows must be `kind='service'`, not revoked, and owned by an active user. It is used by `/mcp` (Bearer), `/mcp/s/:key`, Topic Git and `tokenAuth`. Agent tokens keep their plaintext lookup and are accepted only by `/mcp`.
- **Key format on the URL path.** `/mcp/s/:key` accepts `pls_<64hex>` (new keys), `sk-<64hex>` (converted personal) and `plt_…` (converted Topic). Each is validated by a strict regex before lookup. Unknown keys get 404 on the URL form and 401 on the header form (the header form is a normal Bearer API). Log redaction already covers the whole `/mcp/s/<segment>`.
- **Migration as a startup data step.** `convertLegacyTokens()` runs at startup, like the agent token backfill. It is idempotent: it updates only rows with `kind IN ('personal','topic') AND revoked_at IS NULL`. For personal rows it sets `token = service_sha256:<sha256(token)>`. Topic rows keep their verifier. Both get `kind='service'`, `name`, `permissions` = default (write only) and `topic_id = NULL`. It runs inside a transaction. Revoked legacy rows are left alone, so they never authenticate anywhere. No Drizzle migration is needed.
- **Permissions on other surfaces.**
  - External API: non-GET/HEAD requires `write`.
  - Topic Git push requires `write`.
  - MCP keeps its existing `toolAllowed` filtering for both the header and URL forms (the context carries `service_permissions` and `service_name` in both).
- **Push attribution.** `topicHistory` joins `topic_pushes.token_id` → `api_tokens` (kind `service`) to add `pushed_via: string | null` (the service name). Earlier pushes made with Topic tokens show the converted name ("Topic token 7"), which is accurate.
- **Topic context for counts.** With Topic tokens gone, `callAgentTool` passes the call's `topic_id` argument as the Topic context for counting when the tool is a Topic tool and the argument is a positive integer. The tool's own access check still governs the call. `ctx.topic_id`, the credential binding, is removed.
- **Removed surfaces.**
  - MCP tools `list_topic_tokens`, `create_topic_token`, `rotate_topic_token`, `revoke_topic_token`.
  - Topic token routes in `api/topics.ts` and their service functions in `topic_access.ts` (keep `topicTokenVerifier` for lookup).
  - `/api/auth/me/tokens` GET/POST/DELETE, replaced by `GET /api/auth/me/agent-token` (times only).
  - Admin `POST /api/settings/tokens`.
  - `TopicCredential` frontend usage and `topicsApi.tokens/issue/rotate/revoke`.
- **`TokenKind`** becomes `'agent' | 'service'`. Code paths that branched on `personal` or `topic` treat `service` as the full owner, gated by permissions. The `upload_image` attribution label and `requirePersonal` simplify accordingly.
- **Plugins page.** The one-time reveal shows three copyable blocks:
  - service URL;
  - MCP endpoint `<origin>/mcp` with `Authorization: Bearer <key>`;
  - Git: "Use this key as the password when cloning a Topic, e.g. `git clone <origin>/topic-git/<id>.git`".
  The page header description stays "Connect to your own apps".

## Risks

- Bearer clients that stored a personal token keep working, because the key value is unchanged. Admin token listing no longer shows masked personal values (hashed now).
- External API with a converted service gets `write` by default, which matches what personal tokens could already do.
