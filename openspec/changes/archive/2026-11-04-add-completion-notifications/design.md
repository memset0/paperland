## Context

QA results carry `status`, `finished_at` (ISO string), and `requested_by_user_id` (covers free and template runs). Research steps carry `status`, `finished_at`, and `kind` (`agent` | `title_edit`); the owner is `research_sessions.user_id`. Existing SSE endpoints follow a single result or step; there is no per-user event channel. Toasts use vue-sonner (`<Toaster position="top-center">` in `App.vue`; the LaTeX copy toast passes `position: 'bottom-center'` per call).

## Goals / Non-Goals

**Goals:** notify the signed-in user of their own finished Q&A answers and research rounds anywhere in the app; click to jump, Ctrl/⌘-click for a new tab; land in the conversation view or the expanded list entry.

**Non-Goals:** browser/OS push notifications, a notification history panel, notifying about other users' work, cancelled runs.

## Decisions

- **Polling, not push, and only in the foreground.** One cheap query per poll (`finished_at > since`, by user) is simpler and more robust across restarts than a new per-user broker plus a WebSocket/SSE channel hooked into both runtimes. The client polls every 5 s while the browser tab is visible and stops entirely while it is hidden; on `visibilitychange` to visible it polls at once. Because the cursor is kept, everything that finished while hidden is announced on return (summarized beyond 5).
- **Server-time cursor.** The response carries `now` (server ISO time); the client sends it back as `since`. The first call has no `since` and returns no items, so past completions are never announced and client clock skew does not matter. A short overlap is avoided because results are filtered by strict `>`; finished rows always get `finished_at` before they become visible as `done`/`failed`.
- **Statuses:** `done` and `failed` (failed includes "interrupted by server restart"); `cancelled` is user-initiated and not announced. Research `title_edit` steps are skipped. Deleted results/entries are skipped.
- **Payload:** QA item `{ kind: 'qa', result_id, entry_id, paper_id, paper_title, title, model_name, status, finished_at }` where `title` is the free prompt or the template name; research item `{ kind: 'research', step_id, session_id, title, status, finished_at }` with the session's list title (topic fallback, same rule as the session list).
- **Watcher** (`useCompletionNotifications`): started in `App.vue` when a user is signed in, stopped on sign-out; one in-flight request at a time; de-duplicates by kind+id; at most 5 notices per poll (more are summarized in one "N more finished" notice linking to `/qa` or `/research`).
- **Notice** (`CompletionToast.vue` via `toast.custom`, bottom center, 10 s): a clickable card. `click` → navigate in-app and dismiss; `ctrl/meta`-click or middle-click → `window.open(url, '_blank')`. URLs: `/research/<id>`, `/papers/<pid>?qa=<entry>&result=<id>&thread=1`.
- **Jump** (`useQAJump.openResult(entry, result)`): if the conversation view is visible → `conversation.openThread` (existing tab with that tail, else blank tab reuse / new tab); otherwise `revealQAEntry(entry, result)` (expands the entry and selects the answer). In-app click on a notice for the paper already open calls it directly; for another paper it pushes the `thread=1` URL and `PaperDetail.handleAnchorFromRoute` calls it once the paper's Q&A is loaded.

## Risks / Trade-offs

- A run that finishes while the user watches it still produces a notice → acceptable and consistent ("every completion is announced").
- Several tabs of the app each show the notice → acceptable for now.
