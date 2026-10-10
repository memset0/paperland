## Why

Accounts can only be created by an admin today, and anonymous visitors can browse every paper, its template Q&A, PDFs and conferences. The site should be members-only: people sign up themselves, an admin approves them, and nothing is visible without logging in — except published note links and image-host images, which are meant to be shareable.

## What Changes

- **Self-registration:** `POST /api/auth/register` (`username`, `password`, optional `nickname`) creates an account in `pending` status. Pending accounts cannot log in; login responds with a distinct "awaiting approval" error. Registration can be turned off with `auth.registration_enabled` in `config.yml` (default on).
- **Admin review:** the admin user list shows pending accounts first. An admin can **approve** (status becomes `active`, the user gets the starter paper) or **reject** (the pending account is deleted, freeing the username). Admins see a pending-count badge on the Settings nav item. Only pending accounts can be deleted.
- **Login wall (BREAKING):** every `/api/*` request from an anonymous caller is rejected with 401, except: `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, and `GET /api/notes/:noteId` (published notes). `/image/*` stays public. The frontend shows a full-page Login / Register screen instead of the app for anonymous visitors.
- **Published note links still work anonymously:** `/papers/:id?note=:noteId` for an anonymous visitor renders a standalone read-only page with just that note (paper title, author, body) and a login button.
- **`/api/files/*` hardening:** requires login (via the wall) and only serves `.pdf` files inside the `data/` directory (path-traversal guard); everything else 404s.
- `GET /api/auth/me` also returns `registration_enabled` so the login screen knows whether to offer Register.
- Data operation done outside this change: every existing account except `mem` was set to `user` role directly in the database (as requested).

## Capabilities

### New Capabilities
- `user-registration`: self-registration, pending status, admin approve/reject, pending badge, registration toggle.

### Modified Capabilities
- `auth`: the authorization tiers lose the public tier (only the listed endpoints remain anonymous); "Public read access without login" is replaced by a login wall; `/api/files/*` is login-only and confined to PDFs under `data/`.
- `session-login`: login rejects pending accounts; `me` reports `registration_enabled`; every route requires login, and anonymous visitors get a full-page login/register screen.
- `user-accounts`: users gain a `status` (`active` | `pending`); the admin API gains approve and reject-pending; only pending accounts may be deleted.
- `public-notes`: anonymous `?note=` links render a standalone read-only note page instead of the paper page.

## Impact

- DB: migration adding `users.status` (default `active`; existing users active).
- Backend: `api/auth.ts`, `api/users.ts`, `index.ts` (identity hook + `/api/files/*`), `auth/session_auth.ts`, `config.ts`, `config.example.yml`.
- Frontend: new `AuthScreen` (login/register) and standalone public-note view in `App.vue`; `router/index.ts`; `stores/auth.ts`; `api/client.ts`; `Settings.vue` (pending review); sidebar badge.
- Shared types: `UserStatus`, user `status`.
- Docs: `docs/frontend-architecture.md` (auth tiers table, login screen), `docs/tech-stack.md` (users.status), `docs/external-api.md` unaffected (Bearer tokens unchanged; note this).
