# Design

- **Per-request instructions.** `handleMessage` already receives the context. `initialize` returns `INSTRUCTIONS + '\n\n' + workspaceOverview(ctx.viewer.id)`. The overview is plain text lines, for example `- Topic 3 "Robo-Use Agents" (13 pages, 98 references, updated 2026-11-10)` and `- Paper 812 "Title" (added 2026-11-15)`. Errors while building it are swallowed: the overview is omitted rather than failing `initialize`.
- **Recent papers.** `user_papers` with `in_library = 1`, joined to `papers`, ordered by `user_papers.created_at` desc, limit 5. Paper titles are truncated to 160 chars.
- **Topics.** `listTopics(userId, 'all', { archived: false })`. `listTopics` gains an `archived` option (`undefined` = all, as the web list needs, `true`/`false` to filter), implemented as a SQL condition on `archived_at`.
- **Tools.** `list_topics` passes `archived: false`. `list_archived_topics` (read-only, `scope` mine|all like `list_topics`) passes `archived: true`. The web `/api/topics` keeps returning all Topics, because the web UI splits them into tabs.
