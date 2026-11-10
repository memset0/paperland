# Proposal

## Why

Research results need a durable home that users can maintain with their own agents and share with collaborators. Topics will combine a versioned research report and paper catalog, with authenticated Git updates and Paperland-native reading and citations.

## What Changes

- Replace the current Deep Research entry with Topics, with a main Markdown report, supplementary research pages, one global numbered reference catalog, per-page reference subsets, and readable Git history. Preserve access to legacy research sessions and their data through a history entry.
- Give each Topic a portable server-side Git repository. Validate pushes, reject history rewrites, and publish the report, list, and current tag index as one consistent version, with recovery after interrupted synchronization.
- Add per-Topic private/public access with a default viewer/editor permission for other active users, plus explicit owner/viewer/editor sharing and credentials bound to both Topic and actual user, accepted by MCP and Git. Record the authenticated uploader independently of Git author/committer declarations.
- Allow existing Paperland paper IDs and external Semantic Scholar entries. External entries remain external until an explicit one-click import, with no network access or automatic ingestion during push validation.
- Derive Topic root tags and retain legacy hierarchical associations for compatible history/filtering, expose only root badges on papers by default, and support filtering without changing private manual tags.
- Enforce existing manual-tag ownership when composing paper filters, so adding Topic filters cannot expose another user's private tag associations.
- Move legacy shared paper-list type declarations into a TypeScript module so the retained Research views and the frontend type check remain valid.
- Animate pure additions relative to the current browser/account/page's last displayed version; render latest content immediately, and update the reading cache after display.
- Extend MCP with Topic operations and on-demand PDF page text/images with ready-to-use native Markdown references.
- Count each actual MCP tool call by user and, when present, user/Topic, including Q&A and Research agents. Keep durable aggregate counters independent of credentials, return zero for missing counts, and omit per-request traffic tables and byte-volume reporting.
- Execute a one-time, offline, resumable migration of every legacy Research session's report/list versions into its owner's Topic Git history. Preserve original records, directory descriptions, comments and URL citations, and snapshot existing shared visibility into viewer memberships without duplicating papers.
- Let owners/editors shorten or rename a Topic in the web detail view. Commit only its metadata name, update the generated root tag atomically, and reject stale rename requests so later Git pushes cannot silently undo the change.

- Present a document-tree Topic reader: a folder-derived left document tree with frontmatter titles/icons and a dedicated Research questions entry, a themed central content card, and a default-collapsed in-page reference section plus a separate global-reference drawer, without a permanent reference rail. Replace the global directory-tree UI; cache only actually displayed surfaces.
- Choose Private/Public and the default public role at creation, with owner-only Share settings thereafter; separate Share from personal Connect/token controls. Existing Topic access stays unchanged.

- Use format v2 with all published documents under nested pages/ (home pages/report.md), root AGENTS.md/README guidance, root references.json as the sole numbered catalog, and bounded non-published agent workspace files; retain v1 history compatibility. Each document declares references: [3, 8, 12] in YAML frontmatter, validated as a subset of the single Topic catalog. Site papers, Semantic Scholar entries and URL links share stable numbers allocated by first Topic appearance, independent of publication year; preserve reserved numbers after removal and reject reassignment.

- Give documents clean first-class paths such as /topics/3/discussions, preserve legacy query links/history, cap center reading width near 680px, and style numeric citations separately from general links.

- Make numeric body citations the primary reference interaction: hover/focus/tap opens a shared paper card with one-click import for external S2 or recognized arXiv-paper entries, while preserving version-pinned source links and current Topic permissions. Ordinary reference links remain source links rather than automatic article ingestion.

- Widen the Topic document-tree column at desktop breakpoints and tighten row spacing/indentation while retaining readable text, folder structure and the680px report cap.

## Capabilities

### New Capabilities

- `topics`: Topic creation, current and historical report/list reading, Semantic Scholar external entries and explicit import, and the browser reading cache/addition animation.
- `topic-access`: Topic membership, per-user Topic credentials, scope enforcement across web/MCP/Git, and authenticated uploader attribution.
- `topic-git`: Repository contract, standard clone/pull/push transport, validation, consistent publication, concurrency and recovery.
- `topic-paper-tags`: Stable, permission-scoped hierarchical tags and paper filtering, distinct from manual user tags.
- `mcp-call-counts`: Persistent per-tool user totals and user/Topic subtotals across all MCP callers, independent of token lifetime.
- `mcp-pdf-pages`: On-demand physical PDF page text/screenshots and native positioning references.

### Modified Capabilities

- `research-agent-tools`: Accept Topic-scoped credentials, expose Topic tools and actual image content blocks while retaining existing personal/agent behavior.
- `data-ownership`: Distinguish private manual tags from explicitly shared, Topic-owned generated tags.
- `paper-tag-filter`: Add permission-scoped Topic/directory filtering alongside existing private tag filters.
- `database-schema`: Add Topic persistence, uploader audit and recovery metadata, Topic-scoped credentials, and aggregate counters without a request-traffic ledger.
- `deep-research`: Route the existing Research entry to Topics and retain legacy-session history without making automatic model rounds the primary research workflow.
- `auth`: Keep Topic credentials out of general admin token listing/revocation and reject them on the ordinary External API.

## Impact

Backend schema/migrations, one-time Research migration CLI, Topic/Git APIs and services, MCP dispatch/authentication, paper serializers/filtering, Vue research entry/navigation/Topic views, shared types, configuration, and the three architecture/API documents. Uses local Git and a configurable local PDF rendering dependency; large media stays in existing site storage. Legacy Research records remain intact after the explicitly requested one-time copy. Scheduled discovery, PRs, web report editing, public anonymous sharing, and automatic external-paper ingestion remain outside scope. Preserve concurrent migration, backup, and Q&A layout work. Deploy through the queued frontend build and root-run paperland.service, then retain this change for user review before archive.
