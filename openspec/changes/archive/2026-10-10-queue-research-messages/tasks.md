## 1. Backend

- [x] 1.1 `researchQueuedMessages` table + migration (additive)
- [x] 1.2 Submit endpoint queues while active (202); idle submit merges stale queue rows; `DELETE /api/research/:id/queue/:messageId`; `queued_messages` in detail (owner only)
- [x] 1.3 `dispatchQueuedMessages` after a round ends (done/failed/cancelled) and on startup
- [x] 1.4 Tests: merge with newlines, latest model, dispatch after failure/cancel, removal, non-owner 403 / hidden, startup dispatch, session delete cascade

## 2. Frontend

- [x] 2.1 Shared types + API client; store support (queue, remove, refresh on dispatch)
- [x] 2.2 Research page: input enabled during a round, "Queue" button, queued list with remove

## 3. Docs and verification

- [x] 3.1 Docs (`docs/tech-stack.md`, `docs/frontend-architecture.md`); vue-tsc; build check; live check
