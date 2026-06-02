## 1. Shared types

- [x] 1.1 Extend `QAFeedEntry` in `packages/shared/src/types.ts` with `user_id: number | null` and `username: string | null`

## 2. Backend API

- [x] 2.1 In `packages/backend/src/api/qa.ts`, add an optional `scope` querystring param (`'mine' | 'all'`, default `'mine'`) to the `GET /api/qa/free` route typing
- [x] 2.2 Compute an effective scope: treat `scope=all` as all-users only when `request.user!.role === 'admin'`; otherwise force `mine`
- [x] 2.3 Build the `where` clause from the effective scope — `eq(type,'free')` alone for all-users, `and(eq(type,'free'), eq(user_id, userId))` for mine (keep ordering/pagination unchanged)
- [x] 2.4 For each returned entry, resolve the creator's `username` from the `users` table by `entry.user_id` (null-safe) and include `user_id` + `username` in the response object
- [x] 2.5 Verify scope logic (own / admin all-users / non-admin downgrade) — backend `tsc` passes; read-only DB query confirms `scope=all` joins multiple users' free entries with usernames (`mem`, `zhzhang`)

## 3. Frontend store

- [x] 3.1 In `packages/frontend/src/stores/qa.ts`, add a `feedScope` ref (`'mine' | 'all'`, default `'mine'`) and expose it
- [x] 3.2 Append `&scope=${feedScope.value}` to the `/api/qa/free` request in `fetchFeed` (polling reuses `fetchFeed`, so it inherits the scope)

## 4. Frontend page (QAPage.vue)

- [x] 4.1 Import `useAuthStore`; render an admin-only scope toggle in the `AppPage` `#actions` slot bound to `qaStore.feedScope`, shown only when `auth.isAdmin`
- [x] 4.2 On scope change, re-fetch from page 1 (and restart/stop polling as appropriate), reusing the existing fetch/poll helpers (`onScopeChange` → `goToPage(1)`)
- [x] 4.3 Use English UI labels for the toggle ("My Q&A" / "All Q&A"), per the project's management-page label convention

## 5. Frontend panel (QAFeedPanel.vue)

- [x] 5.1 Show the asker's `username` on the above-card line (alongside paper title + time) only when `store.feedScope === 'all'` and `entry.username` is present; omit otherwise
- [x] 5.2 Style the asker label consistently with the existing above-card line (small muted text + `User` icon chip)

## 6. Docs & spec sync

- [x] 6.1 Document the `scope` param + `user_id`/`username` response fields — done in `docs/frontend-architecture.md` (this is an internal `/api/*` endpoint, not part of `external-api.md` which covers `/external-api/*`)
- [x] 6.2 Update `docs/frontend-architecture.md` note for the `/qa` admin scope toggle (toggle in `#actions`, scope semantics, asker username)
- [x] 6.3 Confirm the implementation matches the delta spec; implementation matches with no deviations — no spec changes needed
