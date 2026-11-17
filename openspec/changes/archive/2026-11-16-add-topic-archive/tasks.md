# Tasks

## 1. Backend

- [x] 1.1 Add nullable `topics.archived_at` (Drizzle migration), `archived_at` in shared `TopicSummary`, and `setTopicArchived` / `requireTopicWritable` in the Topic services; guard `renameTopic`; verify offline tests for owner-only archive/unarchive, rename refusal and sharing still working.
- [x] 1.2 Refuse `git-receive-pack` (advertisement and push) for archived Topics with 403 while clone/fetch keep working; verify with offline Git route tests.
- [x] 1.3 Add `PUT /api/topics/:id/archive` and the MCP `set_topic_archived` tool (personal/service write only), with `archived_at` in list/get results; verify route and MCP tests.

## 2. Frontend

- [x] 2.1 Show the "Archived" badge in TopicsList, and in TopicDetail show the archived notice, hide rename and edit guidance, and add owner Archive/Unarchive actions with confirmations; verify type checking and a scratch build.

- [x] 2.2 Show archived Topics in a separate, collapsed-by-default "Archived (N)" section below the active Topics (opened while searching) instead of mixing them in; verify type checking and a scratch build.
- [x] 2.3 Make `/topics` the Topics list URL (sidebar, back links, "Start a topic" from Q&A) and redirect the old `/research` list URL to it with its query preserved; `/research/history` and `/research/:id` stay. Verify type checking and a scratch build.

## 3. Docs and deployment

- [x] 3.1 Update `docs/topics.md`, `docs/external-api.md`, `docs/tech-stack.md` and `docs/frontend-architecture.md`; verify they match behavior.
- [x] 3.2 Deploy (backend restart, `bun run build:frontend`) and verify health, served assets, the migrated column and that production `tools/list` exposes `set_topic_archived` (`list_topics` returning `archived_at` is covered offline to avoid counting tool calls).

## Workflow follow-up

- Report deployment and ask whether to archive the change.
