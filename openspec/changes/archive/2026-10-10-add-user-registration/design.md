## Context

Identity is resolved in one global `onRequest` hook in `packages/backend/src/index.ts`; authorization is per route (`requireUser` / `requireAdmin`), and many read routes are deliberately public. The frontend has no login page: a `LoginDialog` modal opened via `useLoginPrompt`, router guards on some routes, and `dispatchUnauthorized()` on 401. Users have `role` but no status. `/api/files/*` resolves any path relative to CWD without a guard.

## Goals / Non-Goals

**Goals:** self-registration with admin approval; anonymous visitors see nothing but the login screen (and published-note links, image-host images); close the `/api/files/*` hole.

**Non-Goals:** email verification, captcha / rate limiting on register, password rules beyond non-empty, notifying users of approval, changing the external API.

## Decisions

- **Status column, not a separate table.** `users.status` text `active|pending` (default `active`, so existing rows and admin-created users are active). Rejecting = deleting the pending row (no data can exist for it: it never had a session). Starter paper is given on approval, not registration.
- **Login wall in the identity hook.** After resolving `request.user` for `/api/*`, if there is no user and the request is not in the allowlist, reply 401 in `onRequest`. Allowlist is matched on method + route pattern (`request.routeOptions.url`) so `/api/notes/:noteId` matches regardless of id, and an unknown route still 404s. Rejecting in `onRequest` avoids the noted problem of preHandler 401s not halting GET handlers, and means the existing per-route "anonymous gets empty data" branches simply become unreachable (left in place; harmless). `auth.enabled: false` (dev admin) is unaffected.
- **`resolveSessionUser` only returns active users** — defense in depth if a pending user somehow has a session.
- **Pending login → 403 `ACCOUNT_PENDING`** only after the password verifies, so it doesn't leak which usernames are pending to someone without the password.
- **Frontend gate in `App.vue`.** If `auth.loaded && !auth.user`: if the route is `/papers/:id` with `?note=`, render `PublicNoteStandalone` (fetches `GET /api/notes/:noteId`; on 404 falls back to the auth screen); otherwise render `AuthScreen` (Login / Register tabs). The router guard keeps the admin check; every route is effectively auth-required because the shell never renders anonymously. On 401 the client clears `auth.user`, which shows the gate. `LoginDialog` stays for in-app prompts but is no longer reachable anonymously except via the gate.
- **Pending badge:** admins get `pending_count` by filtering `GET /api/users` — `App.vue` fetches it once after login for admins and Settings refreshes it after approve/reject (shared via the users store / a small ref). No new endpoint.
- **`/api/files/*` guard:** `resolve(cwd, param)` must start with `resolve(cwd, 'data') + sep` and end with `.pdf` (case-insensitive); otherwise 404. All stored paths (`data/pdfs/…`, `data/doc2x/…/*.pdf`) satisfy this.
- **Config:** `auth.registration_enabled: true` default via explicit `.default()` values (zod nested-default gotcha).

## Risks / Trade-offs

- Breaking for anyone relying on anonymous browsing (e.g. shared paper links) → they now see the login screen; published notes keep working.
- Registration spam → admin must reject; can be turned off by config. Rate limiting is out of scope.
- Browser extension / Zotero use Bearer tokens or `/open/arxiv` (which needs login anyway) → unaffected.

## Migration Plan

Migration adds `status text not null default 'active'`. Deploy = restart backend. Rollback = old code ignores the column.
