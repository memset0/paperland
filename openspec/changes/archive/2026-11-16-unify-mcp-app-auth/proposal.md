# Proposal

## Why

Paperland has four kinds of MCP credential: personal tokens (Settings), agent tokens (internal Codex runs), Topic tokens (the Topic page's Connect drawer) and Plugins services. This is confusing, and the same app ends up with several keys in several places. The developer wants two kinds only:

1. **Internal**: the agent token that Paperland's own Codex Q&A runs use (unchanged).
2. **Apps**: Plugins services, one per external app, created and managed only on the Plugins page.

Each Plugins service acts as its owner across the whole account (no Topic restriction). It has every permission except deleting papers and deleting answers, which stay separate toggles. A client can authenticate either way: the secret in the URL (`/mcp/s/<key>`) or the standard header (`/mcp` + `Authorization: Bearer <key>`). The same key is also the Git password for Topic repositories, so Topic history can show which app pushed a version.

## What Changes

- **Plugins services are the only external credential.** `/mcp` (Bearer), `/mcp/s/<key>`, the External API and Topic Git all accept a service key. The `/mcp` Bearer path keeps accepting agent tokens for internal runs.
- **Personal and Topic tokens are converted, not revoked.** A migration turns each active personal token into a Plugins service named "API token <id>" and each active Topic token into "Topic token <id>". The existing key value keeps working (stored hashed). Converted services get `write` and no delete permissions, matching what those tokens could do. Revoked rows stay revoked.
- **No more creating old kinds.** Personal-token self-service (Settings → API tokens) and admin token issuance are removed, as are the Topic Connect drawer, the Topic token routes and the MCP tools `list_topic_tokens`, `create_topic_token`, `rotate_topic_token` and `revoke_topic_token`. Settings shows only the Codex agent token and points to Plugins. The admin token list shows agent tokens and services (no secret values), and admins can still revoke a service.
- **Plugins page shows both connection methods.** When a key is shown (on create or New URL), the page offers the service URL, the `/mcp` URL plus Bearer header, and the Git clone hint.
- **Topic Git with a service key.** HTTPS Basic auth takes the service key as the password, for any Topic the owner can access. Pushing requires `write`, editor access and an unarchived Topic.
- **Push attribution.** Topic history shows the app a version was pushed through ("Pushed by mem via ChatGPT"), from the credential recorded on each push.
- **External API with a service key.** It acts as the owner. Methods other than GET/HEAD require `write`.
- **BREAKING (internal API):** the routes `/api/auth/me/tokens` (GET/POST/DELETE), `POST /api/settings/tokens` and the Topic token routes are removed. Existing key values keep working.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mcp-services`: services become the single external credential, with header and URL authentication, Git use and push attribution.
- `research-agent-tools`: `/mcp` authentication accepts agent tokens and service keys only. The Topic token tools are removed.
- `topic-access`: Topic credentials are removed. Members connect through Plugins services. Push audit names the app.
- `auth`: External API accepts service keys. Personal token self-service and admin issuance are removed. The admin list covers agent tokens and services.

## Impact

- DB: data migration converting personal and Topic token rows to `service` (key hashed in place). No schema change, no MINOR bump.
- Backend: `services/api_tokens.ts`, `services/mcp_services.ts`, `auth/token_auth.ts`, `api/mcp.ts`, `api/topic_git.ts`, `api/tokens.ts`, `api/settings.ts`, `api/topics.ts` (token routes), `services/topic_access.ts`, `services/topic_tools.ts`, `services/topics.ts` (history via), shared types.
- Frontend: `PluginsPage.vue` (connection methods), `Settings.vue` (remove API tokens section), `TopicDetail.vue` (remove Connect, history "via"). The visual redesign of the Topic pages is a separate change, `redesign-topic-pages`.
- Clients: ChatGPT (service URL) unaffected. Zotero, the browser extension and other Bearer clients keep their keys. Topic Git remotes keep working because converted Topic tokens remain valid passwords.
- Docs: `external-api.md`, `tech-stack.md`, `frontend-architecture.md`, `topics.md`.
