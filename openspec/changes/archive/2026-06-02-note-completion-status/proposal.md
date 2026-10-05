## Why

From the paper list you can't tell whether you've taken notes on a paper, let alone whether you've finished a close read. Add a per-paper note-status indicator (none / has-notes / completed) that links into the paper's note view, plus a "mark reading done" toggle in the note function bar — so the list shows, at a glance, which papers are noted and which are fully read.

## What Changes

- **Note `completed` flag**: add a per-(user, paper) `completed` boolean to the note (default false). It is meaningful only for a note that has content.
- **Completion toggle in the note function bar**: the left "Note" panel's function bar gains a **button group** (e.g. In progress / Done) that marks the note complete or incomplete.
- **Paper-list note-status column**: a new column in the paper list shows a 3-state icon per paper for the current user — **empty** (no note content), **a circle** (has notes, not done), **a checked circle** (has notes + reading complete). Clicking it navigates to that paper's **Note** tab.
- **API**: an endpoint toggles `completed`; the single-note GET and the `GET /api/notes` aggregate include `completed`.

## Capabilities

### New Capabilities
- `paper-list-note-status`: the paper list shows a per-paper note-status column (3 states: none / has-notes / completed) that links to the paper's note tab.

### Modified Capabilities
- `paper-notes`: the note row gains a `completed` flag; an endpoint toggles it; the single-note GET and the cross-paper aggregate include it.
- `notes-walkthrough`: the note function bar gains a completion toggle (button group) that marks the note complete/incomplete.

## Impact

- **DB**: add `notes.completed` integer (0/1) NOT NULL default 0; a Drizzle `ALTER TABLE … ADD COLUMN` migration (non-destructive).
- **Backend**: `packages/backend/src/db/schema.ts`, `api/notes.ts` (toggle endpoint + include `completed` in the single-note GET and the aggregate), shared `Note` type (`completed: boolean`).
- **Frontend**: `stores/notes.ts` (completed state + toggle action), `components/notes/NoteWalkthrough.vue` (completion button group), `views/PaperList.vue` (note-status column + fetch the user's note statuses + navigate to the note tab), `components/PaperViewerPanel.vue` (activate the "Note" tab on a `?view=note` route query), `api/client.ts`.
- **Docs**: `docs/frontend-architecture.md`, `docs/tech-stack.md` (notes table), `docs/external-api.md` if note endpoints are listed.
