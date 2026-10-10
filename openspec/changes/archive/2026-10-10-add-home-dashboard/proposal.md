## Why

The site root `/` currently opens straight into the paper list, so there is no place to get an overview of the site. Model usage — who is spending tokens and how much — is buried in Settings and the leaderboard is visible to admins only. A dedicated welcome / dashboard page at `/` gives every signed-in user an overview, starting with a usage dashboard that turns the leaderboard into something fun to look at (a podium for the top three).

## What Changes

- New **Home** page at `/` (sidebar entry "Home", wrapped in `AppPage`). For now it contains one module: the usage dashboard.
- Usage dashboard on Home:
  - The signed-in user's own usage (calls, tokens, cached input share, estimated cost, per-category breakdown) — moved from Settings.
  - The usage leaderboard, rendered as a **podium** for ranks 1–3 (2nd · 1st · 3rd, 1st tallest) and a **table** for rank 4 onward (only shown when there are more than three entries).
  - A time-window switch shared by both: **All time** (default), **Last 7 days**, **Last 30 days**.
- **BREAKING (URL)**: the paper list moves from `/` to `/papers` (sidebar "Papers" → `/papers`). Internal links that pointed at `/` for the paper list (paper detail back button, tag click, post-delete redirect, "Back to papers" link) move to `/papers`. Paper detail stays at `/papers/:id`.
- `GET /api/usage/leaderboard` becomes available to **every signed-in user** (was admin-only); anonymous callers still get 401.
- Settings no longer shows the "Usage" section or the admin "Usage leaderboard"; both live on Home only.

## Capabilities

### New Capabilities
- `home-dashboard`: the Home page at `/` — its route, sidebar entry, layout, and the usage dashboard module (own usage, podium + overflow table, All time / 7 / 30 day window).

### Modified Capabilities
- `model-usage-tracking`: the leaderboard API is no longer admin-only; any signed-in user may read it.
- `settings-page`: the Usage section and the admin Usage leaderboard are removed from Settings.
- `page-layout`: Home is added to the list of management pages that use `AppPage`; the Papers page now lives at `/papers`.

## Impact

- Frontend: new `views/HomePage.vue` and usage dashboard components (podium, overflow table); `router/index.ts` (`/` → Home, `/papers` → paper list); `App.vue` sidebar (Home entry, Papers active state); `PaperDetail.vue`, `OpenArxiv.vue` links; `Settings.vue` drops the usage components; `usage-format.ts` gains the 7-day window; existing `components/settings/Usage*.vue` are moved/reworked.
- Backend: `api/usage.ts` leaderboard guard `requireAdmin` → `requireUser`; `model_usage.test.ts` updated.
- Bookmarks of `/` now land on Home instead of the paper list; `/?tags=…` style paper-list query links no longer filter (they must use `/papers?tags=…`).
- Docs: `docs/frontend-architecture.md`, `docs/external-api.md`, `docs/tech-stack.md` (as relevant).
- No database schema change.
