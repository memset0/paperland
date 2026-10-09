## Why

All papers currently live in one site-wide list, so every user sees every paper anyone added, and lists get mixed up as more people use the site. Each user needs a personal paper list. The site-wide list stays available so the same paper is never fetched twice.

## What Changes

- Add a `user_papers` table keyed by `(user_id, paper_id)` to hold per-user, per-paper relationship state. Its first field is `in_library`, which controls whether the paper appears in the user's own list. Later per-user paper state (for example display preferences) belongs on this table. Tag assignments stay in `paper_tags`, because a paper can carry many tags, but they are treated as part of the same user–paper relationship (see design).
- The paper list gets a **Mine / All** scope. `GET /api/papers?scope=mine` (the default for logged-in users) returns only papers in the caller's library. `scope=all` returns the site-wide list as today. Anonymous callers always get `all`. Every returned paper carries `in_library`.
- A paper is added to the caller's library when they add it in any way:
  - **Add Paper** (`POST /api/papers`), including when it already exists site-wide
  - the arxiv quick-open link
  - the one-click conference ingest
  - `POST /external-api/papers` with a user-bound token
  - an explicit "add to my list" action from the All view or the paper page
- New `PUT /api/papers/:id/library` adds a paper to the caller's library and `DELETE /api/papers/:id/library` removes it. Removing never deletes the paper or any of the user's data on it; site-wide deletion is unchanged.
- **Starter paper:** `library.starter_arxiv_id` in `config.yml`, default `1706.03762` ("Attention Is All You Need").
  - At startup, if the `papers` table is empty, the starter paper is ingested and added to every existing user's library.
  - Every newly created user (admin-created, or the bootstrap admin) gets the starter paper in their library if it exists.
- **Backfill (migration):** each existing user's library is initialized to:
  - the starter paper
  - every paper they have interacted with: tagged it, written a note, asked a free Q&A, triggered a Q&A run, highlighted in it, or added a reference link
- **Unified Mine/All selector:** every Mine/All switch uses one shared `ScopeToggle` component. This covers the paper list, notes, the Q&A feed, User Q&A, reference links and highlights.
  - The highlight selector (show others' highlights on Q&A answers) is one setting, offered in both the Preset Q&A and User Q&A card headers and kept in sync.
  - Labels are always the English "Mine" / "All"; the Q&A feed's "My Q&A / All Q&A" is renamed.
  - It has two sizes: toolbar and in-section. The paper list uses the smaller one.
  - The selection highlight slides between the two options.
- The paper list UI gets a Mine/All toggle (remembered per browser), an "In my list" marker plus an add button in the All view, and add/remove-from-my-list on the paper page. Fetching a metadata-only paper from the UI also adds it to the user's list.

## Capabilities

### New Capabilities
- `personal-paper-library`: per-user paper library (`user_papers`), mine/all paper list scope, add/remove API, automatic binding on add, starter paper, and the backfill.

### Modified Capabilities
- `data-sharing-preferences`: papers stay always shared in the site-wide (`all`) list, but each user's library membership is private per-user data. Every Mine/All selector becomes one uniform English control with a sliding highlight.

## Impact

- **DB:** new `user_papers` table plus a backfill migration; `papers` deletion also removes its `user_papers` rows.
- **Backend:**
  - `api/papers.ts`: list scope, `in_library`, library routes, binding on create and quick-open
  - `api/conferences.ts`: one-click ingest
  - `external-api/papers.ts`: create
  - `api/users.ts`: user creation
  - `db/index.ts`: bootstrap admin
  - `index.ts`: starter seeding
  - `config.ts` and `config.example.yml`: `library` block
- **Shared types:** `Paper.in_library`.
- **Frontend:** `stores/papers.ts`, `PaperList.vue`, `PaperDetail.vue`, and the new `components/ScopeToggle.vue`, which `NotesPage.vue`, `QAPage.vue`, `QAList.vue`, `ReferenceLinksSection.vue` and `HighlightScopeToggle.vue` now use.
- **Docs:** `frontend-architecture.md`, `external-api.md`, `tech-stack.md`.
