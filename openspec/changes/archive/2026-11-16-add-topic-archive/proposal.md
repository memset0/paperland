# Proposal

## Why

Topics accumulate. Some are finished research that should stay readable and shareable but must not drift. Today the only choice is to keep a Topic fully editable. The owner wants to archive a Topic: it stays in Topic lists, clearly marked as archived, and can no longer be modified.

## What Changes

- The owner can archive and unarchive a Topic from the Topic page and through MCP (`set_topic_archived`).
- An archived Topic is still listed (web Topics list, `list_topics`) and readable, including history, documents, clone/pull and explicit paper import into one's own library. It is marked "Archived" with the archive time. The Topics list moves to `/topics`, with the old `/research` list URL redirecting there. The web Topics list keeps archived Topics apart from active ones, in a collapsed "Archived" section below them.
- While archived, content cannot change: Git pushes to the Topic repository are refused with a clear message, and web rename is refused. Edit affordances (rename, push instructions) are hidden or disabled in the UI.
- Access management (sharing, members, own Topic credentials) keeps working, so the owner can still adjust who sees the archived Topic.

## Capabilities

### New Capabilities

### Modified Capabilities
- `topics`: Archive state, listing and read-only behavior of archived Topics in the web app.
- `topic-git`: Pushes to archived Topics are refused.
- `research-agent-tools`: `set_topic_archived` tool and archive state in Topic tool results.

## Impact

- DB: additive nullable `topics.archived_at` (migration). No MINOR bump.
- Backend: `services/topics.ts` (summary field, archive/unarchive, rename guard), `api/topics.ts` (`PUT /api/topics/:id/archive`), `api/topic_git.ts` (refuse receive-pack), `services/topic_tools.ts` (new tool), shared types.
- Frontend: `TopicsList.vue` badge, `TopicDetail.vue` banner plus Archive/Unarchive action and hidden edit affordances.
- Docs: `docs/topics.md`, `docs/external-api.md`, `docs/tech-stack.md`, `docs/frontend-architecture.md`.
- Deployment: backend restart and queued frontend build.
