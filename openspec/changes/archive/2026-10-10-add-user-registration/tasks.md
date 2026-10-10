## 1. Data & config

- [x] 1.1 `users.status` (`active` | `pending`, default `active`) in schema + migration; shared `UserStatus` and `status` on user types
- [x] 1.2 `auth.registration_enabled` (default true) in `config.ts` and `config.example.yml`

## 2. Backend

- [x] 2.1 `POST /api/auth/register` (validation, 409, 403 when disabled, creates pending, no session); `GET /api/auth/me` returns `registration_enabled`
- [x] 2.2 Login: pending + correct password → 403 `ACCOUNT_PENDING`; `resolveSessionUser` only resolves active users
- [x] 2.3 Admin: `GET /api/users` includes `status`; `POST /api/users/:id/approve` (active + starter paper); `DELETE /api/users/:id` only for pending (400 otherwise); starter paper moved from register to approve
- [x] 2.4 Login wall in the identity hook with the anonymous allowlist (method + route pattern); `/image/*` and external API unchanged
- [x] 2.5 `/api/files/*`: only `.pdf` inside `data/`, else 404
- [x] 2.6 Tests: register/pending login/approve/reject; wall (anonymous 401 on papers/templates/conferences/files, allowlist reachable, published note readable, unknown route 404); files guard

## 3. Frontend

- [x] 3.1 `AuthScreen` (Login / Register tabs, pending message, register success message) rendered by `App.vue` for anonymous visitors; login continues to the requested route
- [x] 3.2 `PublicNoteStandalone` for anonymous `/papers/:id?note=` (falls back to `AuthScreen` when unreadable)
- [x] 3.3 401 clears the user (gate appears); router guards keep admin check
- [x] 3.4 Settings: pending users first with Pending marker, Approve / Reject (confirm); sidebar Settings badge with pending count for admins
- [x] 3.5 `vue-tsc` passes

## 4. Docs & verification

- [x] 4.1 Update `docs/frontend-architecture.md` (auth tiers table, login screen, registration review), `docs/tech-stack.md` (users.status, config), `docs/external-api.md` (note: unaffected)
- [x] 4.2 Safe backend tests; browser check on an isolated instance (anonymous sees only login; register → pending → admin approves → login; published note link anonymously; badge)
