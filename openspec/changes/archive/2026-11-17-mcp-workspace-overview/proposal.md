# Proposal

## Why

When ChatGPT connects to Paperland, it starts by listing every Topic, including archived ones that are frozen and no longer relevant. It knows nothing about the papers the user has been working on. The developer wants the connection to start with a useful overview: the active Topics plus the 5 most recent papers. Archived Topics should only be listed through a separate tool.

## What Changes

- **Workspace overview at connect time.** `initialize` instructions end with a short per-user "Your workspace" section:
  - the active (unarchived) Topics: id, title, page and reference counts, last update;
  - the 5 papers most recently added to the user's list: id, title, added date.
  - It is capped in size, and says how to get more (`list_topics`, `search_papers`, `list_archived_topics`).
- **`list_topics` returns only active Topics.** Archived Topics are excluded.
- **New read-only tool `list_archived_topics`** lists archived Topics (with `archived_at`).
- **The archive tool requirement** is updated for the credential model: Plugins services with `write`, no Topic credentials.

## Capabilities

### New Capabilities

### Modified Capabilities
- `research-agent-tools`: initialize overview, `list_topics` filtering, `list_archived_topics`.

## Impact

- Backend: `api/mcp.ts` (per-request instructions), `services/topic_tools.ts`, `services/topics.ts` (`listTopics` archived filter), tests.
- Clients: ChatGPT must refresh its tool list to see `list_archived_topics`.
- Docs: `external-api.md`, `topics.md`, `tech-stack.md`.
