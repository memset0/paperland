## Why

Q&A answers and Deep Research rounds take a while. Users move on to other papers or pages and only learn that something finished by going back and looking. A global notice when their own work finishes, which jumps straight to the result, saves that round trip.

## What Changes

- New backend endpoint `GET /api/notifications/completions?since=<server time>`: the signed-in user's Q&A answers (`qa_results.requested_by_user_id`) and Deep Research rounds (agent steps of their own sessions) that finished (`done` or `failed`) after `since`, plus the server time to use as the next cursor. Without `since` it returns only the cursor, so nothing older is announced.
- A global watcher (mounted in `App.vue` for signed-in users) polls the endpoint every 5 s while the browser tab is visible (not at all while it is hidden; it checks immediately on return, catching up from its kept cursor) and shows one notice per completion at the bottom center (like the "LaTeX copied" toast): kind, status, and title (question / research title, paper title for Q&A).
- Clicking a notice jumps to the result; Ctrl/⌘-click (or middle-click) opens it in a new browser tab.
  - Deep Research → the session page.
  - Q&A → the paper page. If the conversation view is shown there (desktop conversation layouts, phone Ask section), the answer's thread opens in the conversation view: the tab ending at that answer is activated, otherwise a new tab is opened. Otherwise the entry is revealed in the Q&A list, expanded, with that answer selected.
- Paper page deep link gains `&thread=1` (used by notices): with `?qa=<entry>&result=<id>&thread=1` the answer opens in the conversation view when it is shown, and is revealed in the list otherwise.

## Capabilities

### New Capabilities
- `completion-notifications`: completion endpoint, polling watcher, notice presentation, and click / Ctrl-click navigation.

### Modified Capabilities
<!-- none: the `thread=1` deep link is specified within completion-notifications -->

## Impact

- Backend: new `api/notifications.ts` (+ test), registered in `index.ts`; shared types in `@paperland/shared`.
- Frontend: new `composables/useCompletionNotifications.ts`, `components/CompletionToast.vue`, `composables/useQAJump.ts` (open-in-thread-or-reveal), `App.vue` (start/stop the watcher), `views/PaperDetail.vue` (`thread=1`), `api/client.ts`.
- No schema change. Docs: `docs/frontend-architecture.md`, `docs/tech-stack.md` (if affected).
