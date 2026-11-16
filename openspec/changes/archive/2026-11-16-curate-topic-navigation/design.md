# Design

## Context

See proposal.md for motivation. Existing repositories use format_version:1 (root report/list) or format_version:2 (pages/catalog). The current product contract is now named schema v1 by explicit user decision. Git snapshots and API consumers currently branch on the older layout number; preserve that normalized discriminator internally to avoid breaking history.

## Goals / Non-Goals

**Goals:** Explicit curated order/grouping, a single clickable group overview, a discoverable schema contract, preserved history and audited idempotent upgrades.

**Non-Goals:** New research content, page editing UI, branch/PR workflows, automatic paper import or arbitrary unknown-version support.

## Decisions

- Canonical topic.json contains schema_version:1, title and description. Parse canonical and legacy encodings through separate version-aware paths. Normalize the canonical pages layout internally to format_version:2 plus schema_version:1; serialize canonical metadata without the legacy discriminator. Reject ambiguous metadata declaring both fields and unknown versions. Existing legacy history retains its original metadata.
- Use root reports.yml with schema_version:1, default_page:pages/report.md and ordered reports entries. A page entry has path and optional children; a group has title, optional fonticon and children. Page labels/icons come from frontmatter. Require every real published page exactly once and cap depth/nodes. This prevents accidental hidden reports and catches incomplete pushes atomically. Legacy reads derive an index from folders, merging folder index pages.
- The left tree preserves manifest order. A page with children has a separate chevron and navigation button, avoiding a duplicate overview row. Expand ancestors of the selected page. Keep the separate agent guide and All references entry.
- get_topic_schema(schema_version?) returns the authoritative executable contract examples, limits and step-by-step legacy migrations. get_topic adds detected/current/supported schema metadata and the same contract. Initialize tells agents to check this before editing; no server-side agent instructions infer a future schema.
- Reuse journal-backed commit publication and existing migration backup patterns. A schema upgrade adds metadata/index/catalog as needed without changing page blobs. A new maintenance CLI supports dry-run/apply/verify; system migration has explicit system attribution. Topic3 receives its curated manifest through its own authenticated MCP/Git workflow. Do not overwrite a repository's custom AGENTS.md.
- A legacy workspace file already named reports.yml blocks automatic migration with an actionable conflict instead of being overwritten; its old history remains readable, including executable/binary auxiliary content. The maintenance CLI runs while the backend is stopped because the existing per-Topic mutex is process-local. It can select Topic IDs so Topic3 can instead be maintained through its own authenticated Git identity.
- No SQL migration is needed. Report/catalog reading-cache keys remain stable across metadata/index-only upgrades.

## Risks / Trade-offs

- Legacy format number 1 differs from canonical schema 1 → expose the encoding separately and never relabel historical files as canonical.
- Strict completeness means adding a page also requires updating reports.yml → explicit MCP examples and actionable omitted-path errors.
- YAML aliases or deep trees could exhaust recursion → strict mapping checks, bounded depth/node count and existing file limits.
- Deploying code too old to read canonical commits would fail → preserve backups and deploy version-aware readers before migration; rollback to a reader supporting schema v1, without rewriting Git history.

## Migration Plan

Validate offline parser/Git/API/navigation fixtures, deploy queued frontend and backend, then rehearse migration on an isolated database/repository copy. Apply with a consistent database backup, verify idempotence and old/new reads, and curate Topic3 through its own token. Check public health, assets and desktop/mobile navigation. Record evidence and keep this independent change active for user review and archive authorization.
