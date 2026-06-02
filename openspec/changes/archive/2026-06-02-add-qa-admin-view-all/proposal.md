## Why

The `/qa` feed page only ever shows the current user's own free QA entries. An admin who wants to oversee what questions everyone is asking across the site has no way to do so. Admins should be able to opt into a site-wide view, and when viewing other people's questions they need to see who asked each one — the current paper-title + time line is no longer enough to disambiguate authorship.

## What Changes

- `GET /api/qa/free` gains an optional `scope=all` (vs default `scope=mine`) query parameter. `scope=all` is honored **only for admin users**; for non-admins it is ignored and the endpoint behaves as today (own entries only).
- Each feed entry in the API response gains the creator's identity (`user_id` and `username`) so the frontend can label who asked the question.
- The `/qa` page shows an **admin-only** toggle (in the `AppPage` header `#actions` slot) to switch between "My Q&A" and "All Q&A". Non-admins never see the toggle.
- Each feed panel's above-card line shows the asker's username (alongside the existing paper title + time) when viewing the all-users scope, so admins can tell entries apart.
- Shared `QAFeedEntry` type extended with the creator fields.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `qa-feed-page`: the feed API and page now support an admin-only "all users" scope, the API returns each entry's creator identity, and the feed panel surfaces the asker's username when viewing all users.

## Impact

- **Backend**: `packages/backend/src/api/qa.ts` — `GET /api/qa/free` handler (scope param, admin gating, creator join).
- **Shared**: `packages/shared/src/types.ts` — `QAFeedEntry` gains `user_id` / `username`.
- **Frontend**: `packages/frontend/src/stores/qa.ts` (scope state + query param), `packages/frontend/src/views/QAPage.vue` (admin toggle in actions slot), `packages/frontend/src/components/QAFeedPanel.vue` (show asker username).
- **Docs**: `docs/external-api.md` / `docs/frontend-architecture.md` updated for the new scope param and toggle.
- No DB schema change — `qa_entries.user_id` and the `users` table already exist. No breaking changes (new param is optional, defaults to current behavior).
