## 1. Backend

- [x] 1.1 Shared types for completion items; `api/notifications.ts` with `GET /api/notifications/completions` (registered in `index.ts`)
- [x] 1.2 Unit test with an in-memory DB (cursor-only first call, own vs others, done/failed vs cancelled, title_edit skipped, deleted skipped)

## 2. Frontend

- [x] 2.1 `api/client.ts` call; `useCompletionNotifications` watcher (visible/hidden intervals, cursor, dedupe, cap) started/stopped in `App.vue`
- [x] 2.2 `CompletionToast.vue` (bottom center, click / Ctrl-click / middle-click)
- [x] 2.3 `useQAJump.openResult` and `thread=1` handling in `PaperDetail`

## 3. Docs and verification

- [x] 3.1 Update `docs/frontend-architecture.md` and `docs/external-api.md` / `tech-stack.md` as applicable
- [x] 3.2 Backend test, type-check, verification build, browser e2e (notice appears, click opens thread / reveals entry, Ctrl-click opens a new tab)
