## Context

Notes are one Markdown document per (user, paper). `GET /api/notes` already returns the user's non-empty notes (one per paper). We add a `completed` flag and surface note status in the paper list and a toggle in the note function bar.

## Goals / Non-Goals

**Goals:** a per-note `completed` flag; a paper-list column showing none / has-notes / completed; a function-bar toggle; clicking the list icon opens the paper's Note tab.

**Non-Goals:** per-section completion; analytics/progress dashboards; changing how notes are edited.

## Decisions

### D1 — `completed` column (additive migration)
Add `notes.completed` integer (0/1) NOT NULL default 0. Drizzle generates a plain `ALTER TABLE notes ADD COLUMN` — non-destructive, no table recreation, no FK concerns (unlike the single-doc reshape). Reads (`GET /api/papers/:id/note`, `GET /api/notes`) return `completed`; `PUT /api/papers/:id/note` (body upsert) leaves `completed` untouched.

### D2 — Toggle endpoint
Add `POST /api/papers/:id/note/completed` `{ completed: boolean }` (owner-scoped, `requireUser`). It sets `completed` on the existing note row; if no row exists it is a no-op/400 (you can only complete a note that has content). Returns the updated note. (Guard auth inline like `GET /api/notes`, since a preHandler 401 doesn't reliably halt under this Fastify version.)

### D3 — Paper list note-status via the aggregate
`PaperList.vue` fetches the user's note statuses once (reuse `GET /api/notes`, now including `completed`) and builds a `Map<paperId, { completed }>`. Per row icon:
- not in map → **empty** (muted/dashed circle): no note content.
- in map, `completed=false` → **circle** (`Circle`).
- in map, `completed=true` → **checked circle** (`CircleCheck`).
Clicking the cell navigates to `/papers/:id?view=note`. Anonymous users see the empty state (no statuses fetched).

### D4 — Open the Note tab from the list
`PaperViewerPanel.vue` reads `route.query.view`; when it equals `note` it selects the "Note" (walkthrough) tab on load instead of the default first-available mode. (The "Note" tab is always available per `note-panel-floating-editor`.)

### D5 — Function-bar completion toggle
`NoteWalkthrough.vue`'s function bar gains a 2-state button group (In progress / Done) bound to the store's `completed`. Toggling calls `store.toggleCompleted(next)`, which POSTs and updates `noteRow.completed`. The toggle is shown for authenticated users with a note; marking Done on an empty note is disabled (nothing to complete).

## Risks / Trade-offs

- **[Completed but emptied note]** → If a user completes a note then deletes all content, the aggregate (non-empty only) drops it → list shows empty. Acceptable edge; `completed` persists on the row and reappears if content returns.
- **[Extra list fetch]** → One small aggregate call per paper-list load; cached in component state. Negligible.
