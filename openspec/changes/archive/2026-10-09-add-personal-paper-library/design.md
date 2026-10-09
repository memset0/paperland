## Context

`papers` has no owner, and `GET /api/papers` returns every paper to everyone. Per-user data hangs off papers in several tables: `paper_tags`→`tags.user_id`, `notes`, free `qa_entries`, `qa_results.requested_by_user_id`, `highlights`, and `paper_reference_links`. The production DB has 270 papers and 8 users, and paper id 1 is arXiv `1706.03762`. The user asked for a dedicated table holding the user–paper relationship (whether it is shown, the user's tags, and so on).

## Goals / Non-Goals

**Goals:**
- Each user has a personal paper list (Mine). The site-wide list (All) is unchanged.
- One table that is the home for per-(user, paper) state.
- No duplicate fetching: a paper still exists once site-wide.

**Non-Goals:**
- Changing who may edit or delete papers.
- Scoping other pages (Q&A feed, notes, conferences) by library.
- Changing the external-API list endpoint, which the Zotero plugin uses for lookups.

## Decisions

- **`user_papers(user_id, paper_id, in_library, created_at, updated_at)`**, with PK `(user_id, paper_id)` and FKs that cascade on delete.
  - Removing a paper from the library sets `in_library = 0` rather than deleting the row, so the relationship row can keep future per-user fields such as a hidden flag, a reading status or a pin.
  - Alternative considered: a `papers.owner_id` column. Rejected because many users share one paper.
- **Tags stay in `paper_tags`.**
  - A paper has many tags per user, so a junction table is required. A JSON column on `user_papers` would lose the FK, uniqueness and the existing tag counts, Zotero sync and filter queries.
  - Tags are already per-user through `tags.user_id`, so semantically they are "user × paper × tag". Moving them to reference `user_papers` would only add migration risk.
  - Removing a paper from the library therefore never touches tags.
  - Tagging does not change `in_library`. This avoids silently re-adding a paper the user just removed.
- **Scope in the query:**
  - `scope=mine` adds `papers.id IN (SELECT paper_id FROM user_papers WHERE user_id=? AND in_library=1)` to the existing conditions.
  - `in_library` for each page of results is one batched lookup.
- **Binding helper:** `services/user_library.ts` exports `addToLibrary(userId, paperId)` (an upsert that sets `in_library=1`), `removeFromLibrary`, `libraryIds(userId, paperIds)` and `addStarterPaper(userId)`. These are called from the add paths after `ingestPaper` returns. `ingestPaper` stays user-agnostic.
- **Conference ingest:** bind only on the user-initiated one-click ingest. The background S2 matching creates metadata-only papers and does not bind.
- **Starter paper:** `library.starter_arxiv_id` in config (default `1706.03762`, empty disables it).
  - Seeding runs in `index.ts` after the service runner is registered, so the ingest triggers the normal fetch pipeline.
  - When seeding creates the paper, all existing users get it.
  - The bootstrap admin is created inside `initDatabase` before papers can exist, so it receives the starter paper through the seeding step on an empty DB.
  - Admin-created users get it in `POST /api/users`.
- **Backfill in SQL migration:** `INSERT OR IGNORE INTO user_papers` from each interaction source, joined to existing users and papers. The starter-paper part hard-codes `1706.03762`, because migrations cannot read config.
- **Frontend:**
  - `papers` store adds `scope` (persisted in localStorage), `addToLibrary` and `removeFromLibrary`.
  - `PaperList.vue` adds a Mine/All toggle styled like the Notes page one, an "In my list" badge or a "+ My list" button per row in All, and the Mine empty state hints at switching to All.
  - `PaperDetail.vue` adds an add/remove button.

- **Unified scope selector:** this was added on request during apply.
  - `components/ScopeToggle.vue` takes `v-model` (`'mine' | 'all'`), `size` (`md` for page toolbars, h-8; `sm` for section headers and the paper list, h-6), `disabled`, `title`, and an optional `#icon` slot. `HighlightScopeToggle` uses the slot for its highlighter icon.
  - It is styled as a segmented control, the same look as the user's reference screenshot: a `bg-muted` track with 2px padding and no border, and the selection is an inset `rounded-md bg-background shadow-sm` pill. In dark mode the pill is darker than the track.
  - The two options are equal-width grid cells. One absolutely positioned highlight translates between them (`translate-x-0` / `translate-x-full`, 200ms, disabled under `prefers-reduced-motion`).
  - Selected state is shown by color only, not weight, so the widths never jitter.

## Risks / Trade-offs

- **The backfill heuristic may miss papers a user only read.** Mitigation: All plus a one-click add.
- **Tag filter counts (`paper_count`) still count across all papers.** This is acceptable for now.
- **Seeding on an empty DB triggers network fetches at startup.** These are the same as a normal add.

## Migration Plan

Drizzle migration 0029: create the table, then the backfill inserts. Rollback is to drop `user_papers`, since no existing table changes.
