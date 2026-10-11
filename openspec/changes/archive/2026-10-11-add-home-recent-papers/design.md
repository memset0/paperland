## Context

Home (`HomePage.vue`) renders `UsageDashboard` then `FeatureList`. Per-user library membership lives in `user_papers` (`created_at` = first time added, `in_library` flag). `GET /api/papers` already filters Mine via a `user_papers` subquery but only sorts by paper `created_at`/`updated_at`.

## Goals / Non-Goals

**Goals:** recent-papers cards at the top of Home; reorder Home sections; reuse the existing list endpoint.
**Non-Goals:** a new Home-specific endpoint; changing the Papers page sort dropdown; pagination on Home.

## Decisions

- **Reuse `GET /api/papers` with `sort_by=added_at`, `page_size=6`, `scope=mine`** rather than a new endpoint — the list already handles scope, listed, tags and payload slimming. Ordering uses a correlated subquery on `user_papers.created_at` for the caller, so the existing Mine filter is unchanged.
- **`added_at` = `user_papers.created_at`.** Re-adding a removed paper keeps its original time (the row is kept on removal). Acceptable: removal/re-add is rare, and using `updated_at` would drift if more per-user state lands on the row.
- **`added_at` on every list item** (null when not in library) so the type stays uniform; computed in the same batch query that already determines `in_library`.
- **Fallback for anonymous / `scope=all`** to `created_at`: there is no single "added" time site-wide.
- **Cards** in a responsive grid (1/2/3 columns), title clamped to 2 lines, authors truncated to one line, added date as an absolute short date (e.g. "Oct 11, 2026") plus the arXiv id, tags as small chips (same visibility filter as the paper list); cards are `min-w-0` so long titles truncate instead of widening the grid on phones. Metadata-only (unlisted) papers are excluded by the default `listed` filter, since they are not navigable.

## Risks / Trade-offs

- Correlated subquery per row for ordering → fine at library sizes (hundreds), primary-key lookup.
