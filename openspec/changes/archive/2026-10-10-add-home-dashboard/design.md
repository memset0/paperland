## Context

- `/` renders `PaperList.vue`; the sidebar "Papers" item is active on `/` and `/papers/*`.
- Usage UI lives in Settings: `components/settings/UsageSection.vue` (own usage, `GET /api/usage/me`) and admin-only `UsageLeaderboard.vue` (`GET /api/usage/leaderboard`, `requireAdmin`). Each has its own All time / Last 30 days switch from `usage-format.ts`.
- Backend already supports an arbitrary `days` window, so 7 days needs no backend change.
- A parallel change (`add-feature-announcements`) will add a "What's new" section to the Home page as a separate component; this change only owns the Home page shell and the usage dashboard.

## Goals / Non-Goals

**Goals:**
- Home page at `/`, paper list at `/papers`, all in-app links updated.
- One usage dashboard on Home with a single shared window switch (All time / 7 / 30), own usage + podium + overflow table.
- Leaderboard readable by every signed-in user.

**Non-Goals:**
- Feature announcements (separate change).
- Redirecting legacy `/?tags=…` URLs to `/papers` — `/` simply becomes Home. (Cheap to add later if bookmarks matter.)
- Charts / time series of usage.

## Decisions

- **Component layout**: move usage components to `components/home/`:
  - `UsageDashboard.vue` — owns `days`, the window switch, and loads both APIs in parallel; passes data down.
  - `UsageSummary.vue` — own-usage stats + per-category table (from former `UsageSection.vue`, now prop-driven, no own switch).
  - `UsagePodium.vue` — top 3 as podium; ranks ≥4 as a table inside the same component.
  - `usage-format.ts` moves alongside; `USAGE_WINDOWS` becomes All time / Last 7 days / Last 30 days.
  Old `components/settings/Usage*.vue` are deleted. One shared switch avoids two independent windows on one page.
- **Podium rendering**: CSS flex with order 2·1·3, step heights e.g. 1st `h-28`, 2nd `h-20`, 3rd `h-14`, gold/silver/bronze accents (amber / slate / orange tints via Tailwind, works in dark mode), medal/trophy icon from `@lucide/vue` (`Crown` for 1st, `Medal` for 2/3). Above each step: avatar-like initial circle, display name, cost (primary) and tokens (secondary). Empty places are not rendered (flex keeps 1st centered when 2nd exists; with only 1st, it's centered alone).
- **"You" marker**: compare `entry.user_id` with `auth.user.id`; show a small "You" badge and ring highlight.
- **Routing**: `/` → `HomePage.vue` (`meta: { title: 'Home', icon: House }`); `/papers` → `PaperList.vue` (name `papers`). Paper-list `router.replace({ query })` calls keep working because they replace only the query on the current route. Admin-guard fallback still redirects to `/` (Home) — fine.
- **Sidebar**: add `{ path: '/', label: 'Home', icon: House }` first; `isActive('/')` becomes exact match; `/papers` active for `/papers` and `/papers/*` via `startsWith`.
- **API guard**: leaderboard `requireAdmin` → `requireUser`. Exposing other users' usernames/nicknames/costs to all users is an explicit product decision from the user.

## Risks / Trade-offs

- Bookmarked `/?tags=…` links lose their filter → acceptable; documented in proposal.
- Leaderboard now reveals per-user cost to all users → accepted by user.
- Browser-extension / Zotero plugin open paper detail URLs (`/papers/:id`), unaffected.
