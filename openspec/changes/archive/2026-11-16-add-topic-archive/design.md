# Design

## Context

Topic content changes only through Git pushes (`topicGitRpc` with `git-receive-pack`, authenticated in `api/topic_git.ts`) and web rename (`renameTopic`, which also writes a commit). Access state (default access, members, credentials) lives in the database. `listTopics`/`summary` build `TopicSummary` for the web and MCP.

## Goals / Non-Goals

**Goals:** a reversible, owner-controlled freeze of Topic content that remains visible and readable.

**Non-Goals:** hiding archived Topics; freezing access management; archiving papers referenced by the Topic.

## Decisions

- **`topics.archived_at` (nullable text)** instead of a status enum. Reversible, additive, and it carries the time.
- **Guard at the write entry points.** `requireTopicWritable(topic)` throws `TopicError(403, 'This Topic is archived; its owner must unarchive it before it can be changed')`. Rename and both receive-pack Git routes call it (the info/refs advertisement for `git-receive-pack` and the POST), so `git push` fails before any upload. The check runs again inside the Topic lock.
- **Owner-only state change** via `setTopicArchived(topicId, userId, archived)` under the Topic lock. Web route `PUT /api/topics/:id/archive {archived}`; MCP `set_topic_archived` reuses the personal/service gate (`personal()`), so Topic credentials are refused.
- **List order.** The API keeps the existing order (by `updated_at`); archiving does not bump `updated_at`. The web Topics list splits the result: active Topics in the main grid, archived Topics in a separate "Archived (N)" section below, collapsed by default and opened automatically while searching. `list_topics` stays one list with `archived_at` so agents can filter.
- **UI.** TopicsList shows archived Topics only in its separate "Archived" section, each with an "Archived" badge. TopicDetail shows a notice bar with the archive date, hides the rename control, shows Git push guidance as read-only, and offers Archive/Unarchive in the owner's actions with confirmations.

## Risks / Trade-offs

- [An agent keeps editing locally and only learns at push time] → The push error message explains the state. `get_topic` exposes `archived_at`, and the MCP instructions mention it.
- [Archived Topic still accepts access changes] → Intended. Documented.

## Migration Plan

Additive migration, backend restart, frontend build. Rollback: older code ignores the column; archived Topics become editable again.
