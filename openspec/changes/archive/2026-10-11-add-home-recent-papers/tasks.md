## 1. Backend

- [x] 1.1 `GET /api/papers`: accept `sort_by=added_at` (Mine scope orders by the caller's `user_papers.created_at`; anonymous / `scope=all` falls back to `created_at`) and add `added_at` to every list item
- [x] 1.2 Add `added_at: string | null` to the shared `Paper` type
- [x] 1.3 Backend tests for `added_at` ordering, fallback and the field

## 2. Frontend

- [x] 2.1 `components/home/RecentPapers.vue`: up to 6 recent library papers as cards (title, authors, added date, tags) linking to `/papers/:id`, "All papers" link, empty state
- [x] 2.2 `HomePage.vue`: order Recent papers → Features → Usage
- [x] 2.3 Verify with a build and screenshots (populated and empty states)

## 3. Docs

- [x] 3.1 Update `docs/frontend-architecture.md` (Home section) and `docs/external-api.md` if it documents the papers list query
