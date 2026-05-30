## Context

The notes feature (added in `add-paper-notes`) models two note kinds in a single `notes` table:

- `kind='walkthrough'` — one linear Markdown note per (user, paper), upserted via `PUT /api/papers/:id/walkthrough`, always `parent_id IS NULL`.
- `kind='note'` — a tree of small notes per (user, paper) via self-referential `parent_id`; a null `parent_id` means top-level.

`GET /api/papers/:id/notes` returns `{ walkthrough, notes }`. The frontend builds a forest from the flat `notes` list (multiple top-level nodes possible) and shows the mind-map count as `store.notes.length` (raw row count, content-agnostic). The walkthrough has its own UI section.

In practice **no walkthrough rows were ever created** — only small notes exist. The two-kind split adds avoidable complexity (a special upsert endpoint, a separate UI section, a `{ walkthrough, notes }` read shape) for a feature that is being abandoned in favor of a future, separate "walkthrough view".

Constraints: SQLite via `bun:sqlite` + `drizzle-orm/bun-sqlite`; snake_case everywhere; notes are owner-scoped (per `data-ownership`); optimistic-concurrency on edits via `updated_at`; the editor/mind-map UI must keep working.

## Goals / Non-Goals

**Goals:**
- Collapse notes into a single uniform type organized as exactly **one tree per (user, paper)**, anchored by a single **root note**.
- Create the root note (and the whole row footprint) **lazily** — zero rows for papers with no notes.
- Define a paper's note count by **content**: only notes with a non-empty `body` count.
- Remove the walkthrough kind, its endpoint, and its UI without losing any existing note content.

**Non-Goals:**
- Building any new "walkthrough view" experience (that is a separate future change).
- Changing the mind-map interaction model (drag-to-reparent, undo, floating editor) beyond what the root note requires.
- Adding a note count to paper-list cards (out of scope; the count surfaces where it already does — the mind-map header and `/notes`).
- Multi-user/shared notes, anchors format changes (`paperland://` stays as-is).

## Decisions

### Decision 1: Identify the root with `kind='root'` (repurpose the existing column)

`NoteKind` changes from `'walkthrough' | 'note'` to `'root' | 'note'`. The root note is the single `kind='root'` row per (user, paper); every other note is `kind='note'` and has a non-null `parent_id`. The root always has `parent_id IS NULL`.

- **Why**: An explicit marker makes the migration unambiguous (we can deterministically distinguish a freshly-created empty root from a pre-existing empty top-level note), keeps runtime queries self-documenting (`WHERE kind='root'`), and reuses the existing column — no add/drop churn.
- **Alternatives considered**:
  - *Drop `kind`; treat `parent_id IS NULL` as the root.* Cleanest final schema, but the migration must guess which parentless row is the new root vs. an old top-level note (both can have empty body / null title), which is fragile. Rejected.
  - *Add an `is_root` boolean and drop `kind`.* Equivalent semantics to repurposing `kind`, but adds one column and drops another for no benefit. Rejected.
- A **partial unique index** `UNIQUE(user_id, paper_id) WHERE kind='root'` enforces at most one root per (user, paper) at the DB level, guarding against races in lazy creation.

### Decision 2: Lazy root creation via an `ensureRoot(user_id, paper_id)` helper

Papers with no notes have **no rows**. The root is created on demand by a single helper, run inside a transaction, that returns the existing root or inserts one (empty `body`, null `title`, `sort_order=0`). It is called by:

- **Editing the root** — a new write path for the root note (see Decision 3) calls `ensureRoot` before applying the body update.
- **Creating the first child** — `POST /api/papers/:id/notes` with no `parent_id` (a "top-level" note from the user's perspective) calls `ensureRoot`, then inserts the child with `parent_id = root.id`. Both rows are created in one transaction, matching the user's described "auto-initialize root + the new note".

The partial unique index makes `ensureRoot` safe under concurrency: a losing insert is caught and the helper re-reads the winner.

- **Why**: Keeps the "zero rows until content" invariant while letting every write path assume a root exists once it returns. Centralizing creation avoids scattering the "create root if missing" logic.

### Decision 3: API surface — drop the walkthrough endpoint, return one list, address the root by id

- **Removed**: `PUT /api/papers/:id/walkthrough`.
- `GET /api/papers/:id/notes` returns `{ notes: Note[] }` (a flat list including the root if it exists; empty array if no root yet). The `walkthrough` field is gone.
- The root note is edited through the **existing** `PATCH /api/notes/:id` once it exists. To support the lazy first-write before any root id is known, `POST /api/papers/:id/notes` gains the ability to target the root: a dedicated path/param to "ensure + return the root" so the client can then `PATCH` it. Concretely, the client flow is: on first root edit, call a small **`PUT /api/papers/:id/root`** that `ensureRoot`s and applies the body (upsert semantics, optimistic `updated_at` when the row already exists). This mirrors the old walkthrough upsert but targets the root note.
- `POST /api/notes/:id/move` and `DELETE /api/notes/:id` reject operating on a `kind='root'` row (400) — the root is the fixed anchor.

- **Why a `PUT /api/papers/:id/root` instead of forcing a `GET`-then-`PATCH`**: the root may not exist yet, so there is no id to `PATCH`. A paper-scoped upsert avoids a chicken-and-egg round trip and reuses the proven optimistic-concurrency shape from the old walkthrough endpoint.
- **Alternative**: have `GET` always synthesize/persist a root. Rejected — that breaks the "zero rows until content" goal (a mere read would create a row).

### Decision 4: Note count = nodes with non-empty `body`

A note counts iff `TRIM(body) <> ''`. This applies uniformly to the root and to small notes; a node with a title but empty body does not count. The mind-map header count and the `/notes` aggregate use this rule. The count is computed on the client from the fetched list (`notes.filter(n => n.body.trim() !== '').length`); the cross-paper `/notes` list shows only non-empty-body notes.

- **Why**: Directly encodes the user's rule ("空根笔记不算一条笔记；小笔记没有 Markdown 内容就不计入总数"). Trimming avoids whitespace-only bodies counting.
- **Note**: nodes are still *displayed* in the mind-map even when empty (so the user can click an empty node to start writing, and structural/grouping nodes remain visible) — only the *count* excludes them.

### Decision 5: Frontend renders a synthetic root when none is persisted

`stores/notes.ts` drops `walkthrough` state and keeps a single `notes` list plus a `tree` computed. When the fetched list has no `kind='root'` row, the store presents a **synthetic, unsaved root node** (e.g. `id: null`) so the mind-map always has a center node to render and click. Writing to it (or adding a child) triggers the lazy server-side creation, after which the real root id replaces the synthetic one. `buildTree` is simplified to assume a single root (the `kind='root'` node, real or synthetic) with all other notes as descendants.

- **Why**: Preserves the always-have-a-root mental model in the UI without persisting empty rows.

## Risks / Trade-offs

- **[Migration mis-reparents notes]** A bad migration could orphan notes or create duplicate roots. → Do it in one transaction per the documented order (delete walkthroughs → insert one root per group that has top-level notes → reparent top-level notes under the new root); add the partial unique index *after* reparenting; verify post-migration that every (user, paper) with notes has exactly one root and no `kind='note'` row has a null `parent_id`.
- **[Synthetic root id collisions / save races]** The synthetic root has `id: null`; two rapid first-writes could race. → Server-side `ensureRoot` + partial unique index make creation idempotent; the client serializes the first root write and adopts the returned id.
- **[Optimistic-concurrency gap on first root write]** The first `PUT /root` has no prior `updated_at`. → Treat "no existing root" as the create branch (201) and only enforce `updated_at` when a root already exists (200/409), exactly like the old walkthrough upsert.
- **[Stale references to walkthrough in code/docs/specs]** Leftover `walkthrough` mentions could confuse. → Sweep `packages/`, `docs/`, and the affected specs; the spec deltas explicitly REMOVE the walkthrough requirements.
- **[Trade-off: keeping the `kind` column vs. a cleaner schema]** We keep `kind` rather than dropping it, accepting a slightly less minimal schema in exchange for a safe migration and explicit queries. Acceptable.

## Migration Plan

Drizzle migration (`bunx drizzle-kit generate` + a hand-written data step), run once at startup:

1. `DELETE FROM notes WHERE kind = 'walkthrough';` (defensive — none expected).
2. For each `(user_id, paper_id)` that has at least one `kind='note'` row with `parent_id IS NULL`, insert one root: `kind='root'`, `parent_id=NULL`, `title=NULL`, `body=''`, `sort_order=0`, timestamps `datetime('now')`.
3. `UPDATE notes SET parent_id = (root id of same user+paper) WHERE kind='note' AND parent_id IS NULL;`
4. Create the partial unique index `UNIQUE(user_id, paper_id) WHERE kind='root'`.

Rollback: the change is additive-then-reparenting; if needed, drop the unique index and the operations are reversible by reparenting roots' children back to top-level and deleting the empty roots — but since no walkthrough data exists and notes are preserved, forward-only is acceptable. A DB backup exists (daily `data/backups/`).

## Open Questions

- Root note display label in the mind-map (e.g. paper title vs. a generic "Overview"/"Root") — decided during apply; default to a generic root label, English per existing UI convention. Not blocking.
