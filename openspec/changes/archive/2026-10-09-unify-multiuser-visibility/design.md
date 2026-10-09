## Context

The motivation is in proposal.md. Current state:

- `qa_entries.user_id`, `highlights.user_id`, `paper_reference_links.user_id`, and `notes.user_id` already record owners, and `users.role` already distinguishes `admin` from `user`.
- `api/qa.ts` already accepts `scope=mine|all`, but `all` currently returns every user's free entries to any logged-in user. That comes from `add-qa-all-users-scope`, which is complete but not yet archived.
- `api/notes.ts` has `scope=mine|all` plus an admin-only `include_private`. `GET /api/notes/:id` and `/api/papers/:id/public-notes` both gate on `is_public`.
- `api/highlights.ts` and `api/reference_links.ts` are strictly owner-only.
- Tags, images, and tokens are private, and stay that way.

## Goals / Non-Goals

**Goals:**
- One backend helper that decides visibility for every optionally-shared type, so the rule is written once.
- Existing data becomes shared without rewriting any rows.

**Non-Goals:**
- Per-item sharing overrides. The user chose per-type switches; the note publish flag remains as the only per-item exception.
- Sharing tags or images, or changing the paper list or tag filtering.
- Admin editing of others' highlights or reference links. Mutation rules stay as they are.
- External API changes. It exposes no optionally-shared data.

## Decisions

### D1. Storage: `user_sharing_settings(user_id, data_type, shared)` with sparse rows
The table has primary key `(user_id, data_type)`, `data_type ∈ {highlights, notes, qa, reference_links}`, `shared` 0/1, and `updated_at`. A missing row means "use `sharing.default_shared`". `PUT` upserts only the keys sent.
- *Why sparse rows:* the migration needs no backfill (existing data is shared by default with no writes), and adding a future type is just a new enum value.
- *Alternative:* four boolean columns on `users`. Rejected because every new type would need a schema change, and the default could not stay config-driven.

### D2. Config: `sharing.default_shared` (default `true`) in `config.yml`
This follows the project rule that tunable defaults live in config. The block is declared in `config.ts` as `z.object({ default_shared: z.boolean().default(true) }).default({ default_shared: true })`, giving explicit inner defaults per the Zod `.default({})` gotcha. The key is also added to `config.example.yml`.

### D3. One visibility helper: `packages/backend/src/auth/visibility.ts`
- `getSharingPrefs(db, userId)` returns the effective `{highlights, notes, qa, reference_links}`.
- `ownerVisibilityFilter(db, viewer, type, ownerColumn, scope)` returns a Drizzle SQL condition:
  - `mine` → `owner = viewer.id`
  - admin `all` → no condition
  - non-admin `all` → `owner = viewer.id OR owner NOT IN (SELECT user_id FROM user_sharing_settings WHERE data_type=? AND shared=0)`; when `default_shared` is false it is `owner IN (... shared=1)` instead
  - anonymous → `FALSE`

  For notes, the caller ORs in `is_public = 1`.
- `isSharedByOwner(db, ownerId, type)` serves single-row checks (note read, Result SSE).
- `sharedFlagsFor(db, ownerIds, type)` computes the `shared` field for a batch of rows.

The subquery runs at query time, so flipping a switch takes effect immediately and pagination totals stay correct, because filtering happens in SQL rather than after fetching.

### D4. `shared` and `username` on every scoped row
Lists already batch-resolve usernames (`loadUsernames` in qa.ts). The same pattern is reused for highlights and reference links, and `shared` comes from the batch helper. The frontend shows the owner whenever `user_id !== me`, and a "Private" badge whenever `!shared && user_id !== me`. Only admins can ever receive such rows.

### D5. Notes: published is a special case; `include_private` is ignored
In all scope a note is visible when `is_public = 1 OR owner shares notes OR owner = me OR admin`. `shared = is_public || ownerShares`. `include_private` is accepted and ignored for backward compatibility. The NotesPage checkbox is removed.

### D6. Highlights overlay
The highlights store gains a `scope` ref (default `mine`, remembered in localStorage per viewer). Others' highlights are rendered by the same DOM-range code with the class `hl-foreign` (an underline in the owner's color plus a `title` tooltip of the username). The click menu is suppressed for non-owned highlights. Overlapping own and foreign ranges are both applied, and the foreign style deliberately uses no fill so the viewer's own fill stays readable. The selector sits next to the existing User Q&A scope control on PaperDetail and in the `/qa` header.

### D7. QA scope changes
`/api/qa/free` and `/api/papers/:id/qa` swap their current `type='free'` all-scope condition for the helper. `qa_access`/SSE authorization uses `isSharedByOwner` for free entries. The admin-only gating of the QAPage toggle is already lifted by `add-qa-all-users-scope`, so only the Private badge is added here.

### D8. Archive ordering
Archive `add-qa-all-users-scope` before this change. Both modify `qa-feed-page` "QA feed API endpoint"/"QA feed page requires login", `qa-display-split` "Preset QA is public, User QA is owner-scoped", and `data-ownership` "Owner-scoped reads". This change's MODIFIED blocks are full replacements written against the post-`add-qa-all-users-scope` behavior, so they win when applied second. Two requirements whose names would become misleading ("QA feed page requires login" and "Preset QA is public, User QA is owner-scoped") are REMOVED and re-ADDED under new names ("QA feed page access and scope toggle" and "Preset QA is public, User QA follows sharing"). `add-qa-all-users-scope` modifies both of them, so it must be archived first; otherwise its archive will fail to find them.

## Risks / Trade-offs

- [Default-shared exposes previously private notes, highlights, and links to other logged-in users at deploy time] → This is the user's explicit choice. Docs and the AccountDialog copy explain it, and any user can switch a type off at once. Anonymous exposure does not change.
- [`NOT IN` subquery cost on large lists] → `user_sharing_settings` has at most 4×(number of users) rows, which is negligible. The existing owner indexes are kept.
- [Visual clutter from many foreign highlights] → All is opt-in, the default stays Mine, and the foreign style is a light underline.
- [Admin sees unshared data] → This is intended. The Private badge makes it explicit so admins do not mistake it for shared content.

## Migration Plan

1. Run `drizzle-kit generate` for the new table. The migration is additive, with no data rewrite.
2. Deploy. Every user starts with default-shared switches.
3. Rollback: drop the table, revert the code, and set `sharing.default_shared` to false in the interim if needed. No user data is touched.
