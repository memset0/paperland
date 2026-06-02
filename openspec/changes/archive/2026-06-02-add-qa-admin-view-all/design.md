## Context

The `/qa` feed page (`qa-feed-page` capability) is backed by `GET /api/qa/free`, which today filters strictly to `qa_entries.user_id == request.user.id` (backend `qa.ts:71-117`). Each entry is returned as a `QAFeedEntry` with `entry_id`, `paper_id`, `paper_title`, `status`, `error`, `prompt`, `created_at`, `results` — no creator identity, because every entry already belonged to the caller.

The auth model already distinguishes roles: `users.role` is `'admin' | 'user'`, `request.user` is a `SessionUser` (`{ id, username, role }`), and the frontend exposes `useAuthStore().isAdmin`. `qa_entries.user_id` references `users.id`. So everything needed to (a) gate an "all users" view on admin and (b) resolve each entry's author already exists — no schema change, no migration.

## Goals / Non-Goals

**Goals:**
- Let admins toggle the `/qa` feed between their own entries and all users' entries.
- Return each entry's creator identity (`user_id`, `username`) so the feed can label authorship.
- Surface the asker's username in the feed panel when viewing all users.
- Keep the default behavior (own entries only) unchanged for non-admins and for admins who don't opt in.

**Non-Goals:**
- No change to how QA entries are created, stored, or executed.
- No per-user filtering UI (pick a specific user) — only "mine" vs "all". 
- No change to template QA, the per-paper QA endpoint, or QA result actions.
- No new admin page — the toggle lives on the existing `/qa` page.

## Decisions

### 1. A `scope` query param, gated server-side on admin role
`GET /api/qa/free` accepts `scope=mine` (default) or `scope=all`. When `scope=all` **and** `request.user.role === 'admin'`, the handler drops the `user_id` filter (keeping only `type='free'`) and returns every user's free entries. For any non-admin caller, `scope=all` is silently treated as `mine` — the server never trusts the client for authorization.

- *Why a `scope` enum over a boolean `show_all=true`?* It reads clearly in logs and leaves room for future scopes without a second boolean. Either works; `scope` is the more descriptive snake_case-friendly choice consistent with the repo's API style.
- *Why silently downgrade instead of 403 for non-admin `scope=all`?* The param is a view preference, not a privileged action a normal user would ever construct; treating it as "mine" is the least surprising and avoids leaking that an admin-only mode exists. (Admin-gating is still enforced — non-admins simply cannot see others' data.)

### 2. Always return creator identity on every entry
The response `QAFeedEntry` gains `user_id: number | null` and `username: string | null`, populated for **both** scopes (not just `scope=all`). Returning it unconditionally keeps the type stable and the handler simple; the frontend decides when to render it. `username` is resolved by reading the `users` row for `entry.user_id` (nullable — legacy/template-shaped rows may have `user_id = null`, in which case both fields are `null` and the UI omits the label).

- *Why not join in SQL?* The existing handler already does per-entry follow-up reads (paper title, results) in a loop; adding a small per-entry `users` lookup matches that style and page sizes are small (default 20). A `users` map can be built once if needed, but it's not required for correctness.

### 3. Frontend: scope state in the store, admin-only toggle in the page header
`stores/qa.ts` gains a `feedScope` ref (`'mine' | 'all'`, default `'mine'`); `fetchFeed` appends `&scope=${feedScope.value}`. `QAPage.vue` renders a toggle in the `AppPage` `#actions` slot **only when `auth.isAdmin`**, wired to `feedScope`; flipping it re-fetches page 1. `QAFeedPanel.vue` shows the asker's `username` on the above-card line when `feedScope === 'all'` (and a username exists). Label text follows the repo convention of English UI on management pages (e.g. an asker chip / "by {username}").

- *Why hide the toggle for non-admins rather than disable it?* Non-admins have no use for it and the server ignores the scope anyway; hiding keeps the header clean and avoids implying a capability they don't have.
- *Why show the username only in `scope=all`?* In `scope=mine` every entry is the caller's own, so an author label is redundant noise.

## Risks / Trade-offs

- **Privacy of others' questions** → This intentionally lets admins read all users' free QA. That matches the requested oversight use case and is gated strictly on `role==='admin'` server-side. Documented in `external-api.md`.
- **Per-entry `users` lookup adds N small reads** → Page size is bounded (default 20) and reads are local SQLite; negligible. Can be hoisted to a single `users` map keyed by id if a page ever grows large.
- **Client could send `scope=all` directly** → Harmless: the server re-checks role and downgrades non-admins to `mine`, so no data leaks regardless of the client.

## Migration Plan

No data migration. Ship backend + shared type + frontend together. Rollback is a straight revert — the new `scope` param is optional and absent-equals-old-behavior, and the added `QAFeedEntry` fields are additive.

## Open Questions

- Exact toggle affordance (segmented control vs. switch vs. two buttons) and the username chip styling are UI-polish details left to implementation; the spec only requires that an admin-only control switches scope and that the asker is shown in `scope=all`.
