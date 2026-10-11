## Why

Home currently opens with the usage leaderboard, which is the least personal thing on the page. Users land on Home and usually want to get back to the papers they were just working on, so Home should lead with their recently added papers, then new features, with the leaderboard at the bottom.

## What Changes

- Home gains a "Recent papers" section at the top: the signed-in user's most recently added library papers (Mine scope), shown as cards that open the paper detail page, with an "All papers" link to `/papers` and an empty state.
- Home section order becomes: Recent papers → Features → Usage (leaderboard last).
- `GET /api/papers` accepts `sort_by=added_at`, ordering the caller's library by when they added each paper (newest first by default); each list item carries `added_at` (when the caller added it to their library, `null` otherwise).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `home-dashboard`: adds the Recent papers section and fixes the Home section order.
- `paper-list-sorting`: adds the `added_at` sort and the `added_at` list field.

## Impact

- Backend: `packages/backend/src/api/papers.ts` (list endpoint), tests.
- Shared types: `Paper.added_at`.
- Frontend: `views/HomePage.vue`, new `components/home/RecentPapers.vue`.
- Docs: `docs/frontend-architecture.md` (Home), `docs/tech-stack.md` (papers list fields).
- No schema change (uses existing `user_papers.created_at`).
