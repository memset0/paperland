## Context

Today a paper's notes for a user are a **tree of rows** in the `notes` table: one `root` note plus many child `note` rows, each with its own `title`, `body`, `parent_id`, and `sort_order`. The frontend builds that flat list into a tree and offers three views: a **mind-map** (`NoteMindmap` / `NoteNode`) that renders the row tree and supports drag-reparent / add / delete; a **walkthrough** (`NoteWalkthrough`) that flattens the tree depth-first into one reading document (titles → depth-based headings, body headings re-leveled, auto-numbered); and **floating editor windows** (`NoteEditor`) that edit one row at a time with debounced autosave and per-row `updated_at` optimistic concurrency.

The pain point is that managing many small rows is tedious. The user wants **one big Markdown document per (user, paper)**, edited as a whole, with the mind-map and the walkthrough **derived from the document's heading structure** — keeping the mind-map-based visual editing they like. Existing notes must be migrated in place.

The hardest part is concurrency: a single document is now edited from several surfaces at once (a whole-document editor on the left, the mind-map on the right, and multiple floating per-section windows). Without coordination they would clobber each other.

## Goals / Non-Goals

**Goals:**
- One Markdown document per (user, paper) as the single source of truth.
- Mind-map and walkthrough are pure **derived views** of that document's heading structure / text.
- Preserve mind-map visual editing: drag-reparent / reorder, add child / sibling, delete subtree — realized as heading rewrites on the document.
- A left-panel document view with three modes (edit / split / render), default render, matching the current walkthrough look (compact body, scaled + auto-numbered headings, clickable headings, no highlighting).
- A floating editor that edits **only one heading's leaf content** and can never alter document structure.
- A concurrency model that **never silently clobbers** the document across windows, tabs, or devices.
- In-place migration of existing note trees, preceded by a DB backup, producing a document whose mind-map matches the pre-migration mind-map.

**Non-Goals:**
- Real-time collaborative editing / CRDT / OT across tabs or devices. Cross-tab safety is handled by optimistic locking + a precise conflict prompt, not live merge.
- Special Markdown syntax for adding non-heading content to the mind-map. Deferred to a later change; the design only leaves room for it.
- Preserving per-note `title` / `sort_order` semantics or the move/subtree-delete API surface.

## Decisions

### D1 — Single Markdown document; collapse the `notes` table
Each (user, paper) has at most one `notes` row holding the entire Markdown in `body`. The tree columns `kind`, `parent_id`, `title`, `sort_order` are dropped; the row keeps `id`, `user_id`, `paper_id`, `body`, `created_at`, `updated_at` with a unique index on `(user_id, paper_id)`. Lazy creation is preserved: a paper with no note has zero rows until first content.
- *Alternative considered:* keep the row tree and treat the big document as a derived/secondary artifact. Rejected — the tree itself is the source of the management pain, and dual structures must be kept in sync.

### D2 — Document is the source of truth; structure is heading-derived
The mind-map and walkthrough are computed from the document. A reusable **heading-section model** parses the Markdown into a tree: each heading becomes a node carrying its `level`, heading text, **leaf body** (the lines from the heading up to the next heading of any level), and `children` (deeper headings). Hierarchy follows **relative heading depth** (the shallowest heading level present is the top level; each extra `#` nests one deeper), so the document works whether top-level headings are `#` or `##`. The **center node** is the paper title; editing it edits the **preamble** — any text before the first heading.
- *Alternative considered:* explicit structure markers / front-matter to define nodes. Rejected for now — the user wants pure heading-driven structure; richer syntax is a deferred non-goal.

### D3 — Frontend shared reactive document + write-through
The store holds **one** reactive copy of the document (the raw Markdown string is canonical; the heading-section tree is a derived, memoized parse). Every editing surface binds to this one copy — there are **no private per-window snapshots**. An edit anywhere updates the shared copy immediately (write-through), so all other views re-render live via Vue reactivity. Persistence is a single **debounced whole-document save**; closing a window or blurring flushes pending state, but since edits already wrote through, nothing is buffered in the window itself.
- *Alternative considered:* each surface keeps a local buffer and PATCHes its slice (today's model). Rejected — local buffers are exactly what causes lost updates between surfaces.

### D4 — Modal editing contexts tied to the left-panel mode
At most one **text editor** owns the keyboard at a time:
- **Render mode = visual-editing context.** Left panel is a read-only live preview. Editing happens via the mind-map: click a node → floating section editor (leaf content); drag / add / delete → structural heading rewrite. The mind-map is interactive here.
- **Edit / split mode = whole-document context.** Entering it **closes all floating windows**; the user edits the entire Markdown freely (including restructuring headings). The mind-map becomes a read-only live reflection (no drag) in this context.

This guarantees the big-document textarea and a floating window are never both live text editors at once, eliminating cursor / splice fights.

### D5 — Floating window edits leaf content only; headings are demoted to bold
A floating window opened from a node (or a render-mode heading) edits exactly that heading's **leaf body** — text up to the next heading. It cannot reach into child sections. Any heading line (`#`, `##`, …) typed inside a floating window is **normalized to bold** at write-through, so a window can never add a heading and therefore never changes document structure. A window thus only ever rewrites text *between two fixed structural boundaries*.

### D6 — Structural-change auto-close (smooth in-tab path)
Any structural change in the tab — a mind-map drag / add / delete, or entering edit/split mode — **closes all open floating windows** immediately. Because windows close the instant the structure they were bound to could shift, the user almost never reaches a conflict prompt during normal single-tab use.

### D7 — Strict window binding: structure fingerprint + section content baseline (correctness backstop)
When a floating window opens it captures two things about the section it edits: (a) a **structure fingerprint** — a hash of the heading tree from *only* heading **levels + heading text + sibling order** (never body content); and (b) a **content baseline** — a hash of *its own* section's leaf body as loaded. The window writes through to the shared document; before each splice (and again at the server on save) both are re-checked against the live document. On any mismatch — the heading structure changed (a heading was added / moved / renamed) **or** this section's own leaf body was changed underneath it (someone edited the same region) — the write-back is **refused** and a conflict prompt asks the user to resolve manually; the window keeps the user's text so it can be copied out. Because (a) excludes body text and (b) is scoped to this one section, concurrent leaf edits to *different* sections never falsely conflict — only a genuine collision on this section's structure or content trips it; untouched windows keep working.

Why both halves are needed: the structure fingerprint (a) catches add / move / rename of headings; the content baseline (b) catches two surfaces editing the *same* leaf region with no structural change — which (a) alone would miss. Within one tab this collision cannot arise (D4/D6 make the whole-document editor and floating windows mutually exclusive, and a second window on the same section is prevented by focusing the existing one); the binding earns its keep **across tabs / devices**, where after a 409-triggered reload (D8) a window detects its section diverged and prompts, instead of silently re-clobbering. D6 keeps the common path smooth; D7 keeps every path correct.

### D8 — Persistence & cross-tab via optimistic `updated_at`
The whole-document save carries the document's `updated_at`; the server rejects a stale save with 409 + the latest content. The big-document editor surfaces "modified elsewhere" and lets the user reload; an open floating window, after such a reload, re-checks its D7 binding (structure fingerprint **and** its section's content baseline) and raises the conflict prompt scoped to that section if either diverged. No real-time merge is attempted (Non-Goal).

### D9 — API simplification
Replace the tree endpoints with single-document ones:
- `GET /api/papers/:id/note` → `{ note }` (the single row, or null/empty when none yet), owner-scoped, anonymous gets empty.
- `PUT /api/papers/:id/note` → upsert the whole `body` with optimistic `updated_at`; first write (no row yet) needs no prior timestamp.
- `GET /api/notes` → one entry per paper (the single document) with `paper_id` + `paper_title`, non-empty bodies only.
Removed: `POST /api/papers/:id/notes`, `POST /api/notes/:id/move`, `DELETE /api/notes/:id` (subtree), `PUT /api/papers/:id/root`.

### D10 — Migration reuses walkthrough flattening
A one-time migration flattens each existing tree into one Markdown document, reusing the current walkthrough assembly logic (note `title` → heading at its depth-based level, `body` following, body headings re-leveled to nest under, root `body` kept as the leading preamble) **without** the render-time auto-numbering. The flattened text is written into the (former root) row's `body`; the other rows are deleted. Because top-level note titles become the shallowest headings and the mind-map derives nodes from headings, the migrated document reproduces the original node tree. Body-internal headings, which previously were not mind-map nodes, will now appear as descendant nodes — an accepted, intended consequence of a heading-driven model.

## Risks / Trade-offs

- **[Body-internal headings become new nodes after migration]** → Documented and accepted; it is the correct behavior under a heading-driven model and only affects notes whose bodies already contained headings.
- **[Heading-driven structure can't represent non-heading nodes]** → Out of scope now; the deferred "special Markdown syntax" non-goal leaves room without blocking this change.
- **[Markdown parse → edit → serialize round-trip could drift]** → Keep the raw string canonical and splice minimally (only the targeted leaf range); the section tree is derived and never re-serialized wholesale, so untouched text is byte-preserved.
- **[Demoting `#` to bold in a floating window may surprise users]** → Give a visible hint in the window ("headings are edited in the full note") and apply the demotion visibly so the user sees what was saved.
- **[Cross-tab edits aren't merged]** → Optimistic `updated_at` (D8) + the precise per-section conflict prompt (D7) prevent silent loss; acceptable for a single-user tool.
- **[Dropping DB columns is irreversible]** → A DB backup is taken before migration (reusing the daily-backup mechanism); the backup is the rollback path.

## Migration Plan

1. **Back up** `data/paperland.db` to `data/backups/` before any data change (reuse the existing backup utility).
2. **Schema migration** (Drizzle): create the new `notes` shape (drop `kind` / `parent_id` / `title` / `sort_order`, add the `(user_id, paper_id)` unique index). Since SQLite rebuilds the table, do the data flatten first (step 3) into the existing schema, then run the column-dropping migration — or run a single migration script that flattens into a temp column and swaps. Implementation detail captured in tasks.
3. **Data flatten**: for each (user, paper) tree, assemble the single Markdown document via the walkthrough flattening (no numbering), write it to the surviving row's `body`, delete the other rows. The collapse runs with `foreign_keys` toggled **OFF** (restored after): the app runs with `foreign_keys = ON`, and deleting a child `note` row whose parent is also being deleted would otherwise trip the self-referential `parent_id` FK — any transient dangling ref is moot since step 2's reshape drops `parent_id` entirely. (In-memory tests must enable `foreign_keys = ON` to exercise this.)
4. **Verify**: spot-check that a migrated document's heading-derived mind-map matches the pre-migration node tree for a sample of papers.
5. **Rollback**: restore the pre-migration backup DB file.

## Open Questions

- None blocking. The "special Markdown syntax for mind-map extras" is explicitly deferred to a follow-up change. Auto-numbering is retained in render mode for visual parity with today's walkthrough.
