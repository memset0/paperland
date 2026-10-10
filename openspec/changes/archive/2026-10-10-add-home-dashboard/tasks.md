## 1. Backend

- [x] 1.1 Change `GET /api/usage/leaderboard` guard from `requireAdmin` to `requireUser` in `packages/backend/src/api/usage.ts`
- [x] 1.2 Update `packages/backend/src/services/model_usage.test.ts` to expect 200 for `user`-role and 401 for anonymous; run that test file only

## 2. Routing and navigation

- [x] 2.1 Router: `/` → new `HomePage.vue` (`meta.title` "Home", `House` icon); paper list moves to `/papers` (name `papers`)
- [x] 2.2 `App.vue` sidebar: add "Home" first; "Papers" → `/papers`; active-state rules (Home exact `/`, Papers on `/papers` and `/papers/*`)
- [x] 2.3 Update in-app paper-list links to `/papers`: `PaperDetail.vue` (tag click, back button, post-delete redirect), `OpenArxiv.vue` "Back to papers"; grep for any other `/` paper-list targets

## 3. Usage dashboard

- [x] 3.1 Move `usage-format.ts` to `components/home/`, windows = All time / Last 7 days / Last 30 days
- [x] 3.2 `UsageSummary.vue` (prop-driven own usage stats + per-category table)
- [x] 3.3 `UsagePodium.vue` (top-3 podium 2·1·3, overflow table for rank ≥4, empty state, "You" marker)
- [x] 3.4 `UsageDashboard.vue` (shared window switch, loads `/api/usage/me` and `/api/usage/leaderboard` in parallel)
- [x] 3.5 `HomePage.vue` wrapped in `AppPage`, renders `UsageDashboard`

## 4. Settings cleanup

- [x] 4.1 Remove Usage section and Usage leaderboard from `Settings.vue`; delete `components/settings/Usage*.vue` and old `usage-format.ts`

## 5. Docs and verification

- [x] 5.1 Update `docs/frontend-architecture.md` (routes, Home page, usage components), `docs/external-api.md`/`docs/tech-stack.md` where they mention the leaderboard or routes
- [x] 5.2 Verification build via `bun run build:frontend --out-dir <scratch>`; check the page in the running app (podium with real data, window switch, Papers links)
- [x] 5.3 `npx openspec validate add-home-dashboard --strict`
