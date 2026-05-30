## Context

The selection toolbar in `MarkdownContent.vue` currently has two jobs: create a colored highlight (optionally with a note) and "复制为锚点链接". The copy action today does:

```js
const label = text.trim().slice(0, 40).replace(/\s+/g, ' ') || '锚点'
navigator.clipboard.writeText(`[${label}](${url})`)
```

`text` is the **render-stripped plain text** of the selection (from `getSelectionOffsets`, which walks rendered DOM text nodes and treats KaTeX as one atomic chunk of its *visual* text). So the clipboard gets a 40-char truncated label, wrapped so the whole passage is one hyperlink, and math comes out as rendered glyphs — not `$…$`. The user wants the **complete selection as Markdown** with math in dollar form, plus a small `[#]` anchor after it.

Separately, a dedicated notes system (`notes` table: walkthrough + mind-map, with inline `paperland://` anchors) now exists, making the old per-highlight `note` redundant. Highlights should become color-only.

Constraints:
- Markdown is rendered by `markdown-it` (`html:false`, `breaks:true`, `linkify:true`) plus `@traptitech/markdown-it-katex`. Each math span is a `.katex` (inline) or `.katex-display` (display) element containing `<annotation encoding="application/x-tex">…</annotation>` — the exact LaTeX source is recoverable from the DOM.
- The anchor scheme (`markdown-anchors`) and `locateBlock` resolution must keep working unchanged; we only change what text the copy action puts on the clipboard.
- The new `notes` table MUST NOT be touched.

## Goals / Non-Goals

**Goals:**
- Copy the **full selected content as Markdown** (not a truncated label, not rendered plain text), followed by a trailing `[#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)` anchor.
- Math is reproduced exactly as `$…$` / `$$…$$` from the KaTeX `x-tex` annotation, never as rendered glyphs, and is not mangled by Markdown escaping.
- A fully-selected table copies as a GFM pipe table; bold/italic/code/lists/blockquotes/links survive as Markdown.
- Make highlights color-only: remove the note input, the click-menu note action, and the hover tooltip across frontend, API, types, and the active schema.
- Preserve existing highlight `note` rows in the physical DB (no destructive migration); just stop reading them.

**Non-Goals:**
- Byte-for-byte reproduction of the original source Markdown. The copy is an HTML→Markdown round-trip of the *selection*, so it may differ cosmetically from the author's source (e.g. `*` vs `_`, link styles). Math is the exception — it is reproduced exactly.
- Changing the `paperland://` scheme, `locateBlock`, anchor offset semantics, or the new notes system.
- Migrating or deleting historical highlight-note data.

## Decisions

### Decision 1 — Convert the selection to Markdown with `turndown` + `turndown-plugin-gfm`
Run an HTML→Markdown conversion on the selection's cloned DOM fragment (`range.cloneContents()`). Use `turndown` for the core conversion and `turndown-plugin-gfm` (tables rule) so a whole `<table>` becomes a GFM pipe table.

- **Why**: Arbitrary sub-selections of rendered HTML cannot be sliced back out of the source Markdown by offset (Markdown syntax chars and KaTeX have no 1:1 char mapping with rendered text). A battle-tested HTML→Markdown converter handles bold/italic/code/lists/blockquotes/links/tables uniformly.
- **Alternatives considered**:
  - *Hand-rolled serializer* over the known markdown-it tag set — zero new deps, but more code and more edge cases (nested lists, mixed inline) to maintain. Rejected for robustness/cost.
  - *Exact source slicing via markdown-it source maps* — only block-level `.map` line ranges exist, no char-level inline mapping; cannot serve arbitrary selections. Rejected as infeasible.
  - *Copy rendered plain text (current `text`, untruncated)* — simplest, but not Markdown and loses math/formatting. Rejected (user explicitly wants Markdown + `$`).

### Decision 2 — Preserve math with a placeholder swap (KaTeX → sentinel → `$…$`)
Before running turndown, walk the cloned fragment and for each `.katex-display` / `.katex` element read its `<annotation encoding="application/x-tex">` text, then replace the element with a **text-node sentinel** (a private-use-area token like `{index}` that turndown will not escape and that cannot collide with real content). Record `{ index, display, tex }`. After turndown produces Markdown, substitute each sentinel back with `$<tex>$` (inline) or `$$<tex>$$` (display).

- **Why**: If we inserted `$x_i$` as text *before* turndown, turndown would escape Markdown-significant chars inside the LaTeX (`_ * \ [ ]`), corrupting the formula (`$x\_i$`). Substituting **after** conversion guarantees the LaTeX is byte-exact and always dollar-delimited. Process `.katex-display` before bare `.katex` so display math isn't matched twice.
- **Display vs inline shape**: inline math is substituted in place as `$<tex>$`; display math is emitted as `\n$$\n<tex>\n$$\n` so the `$$` fences sit on their own lines. `@traptitech/markdown-it-katex`'s `math_block` rule only fires when `$$` begins a line (its `alt` list lets it interrupt a paragraph), so this shape guarantees the copied display math re-parses as a block. Because the sentinel usually already sits in its own paragraph (turndown surrounds it with a blank line), the added fence newlines would double the blank line — so after substitution we collapse runs of 3+ newlines to a single blank line (`\n{3,}` → `\n\n`). This keeps `$$` at line start for the rare inline case while avoiding doubled blank lines. Verified with an isolated harness (render → preprocess → turndown → substitute → re-render): inline math with `_`/`{}` survives unescaped and display math re-renders as `katex-display` with single blank-line separation.
- **Alternatives considered**: Disabling turndown escaping globally (would break real prose); a custom turndown rule for `.katex` (still subject to escaping of the rule's text output unless we post-process — same complexity, less explicit). The placeholder approach is the most predictable.

### Decision 3 — Unwrap highlight `<mark>` wrappers in the clone
Before conversion, unwrap any `<mark data-highlight-id>` elements in the cloned fragment (replace each with its children) so highlight styling never leaks into the copied Markdown.

### Decision 4 — Output shape: `"<selection markdown>" + " " + "[#](<url>)"`
The clipboard string is the trimmed converted Markdown, a single space, then `[#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)`. The anchor `#` label is literal. The URL is built exactly as today (paper id + `contentHash` + `pendingSelection` `start_offset`/`end_offset`), so existing anchor resolution is unaffected.

### Decision 5 — Anchor offsets from `pendingSelection`, content from the live range
The `s`/`e` offsets keep coming from `pendingSelection` (rendered-text offsets, KaTeX-expanded), preserving anchor compatibility. The copied *content* comes from `range.cloneContents()` of the live selection. These can differ slightly when a selection boundary falls inside a KaTeX element (offsets expand to the whole formula; the clone may include a partial KaTeX subtree). We mitigate the KaTeX case in Decision 2 (we key off whole `.katex` elements in the clone), so a touched formula is emitted whole; the minor boundary mismatch is acceptable.

### Decision 6 — Highlights become color-only (remove notes everywhere)
- **Frontend** `MarkdownContent.vue`: delete `showNoteInput`, `noteText`, `menuEditNote`, `menuNoteText`, the tooltip state (`showTooltip`, `tooltipNote`, `tooltipPos`) and its handlers (`onMarkMouseEnter`/`onMarkMouseLeave`); drop the note toggle + input from the toolbar, the "Note/Save" path from the click menu, and the tooltip template + related styles; `createHighlight` no longer passes `note`; `menuSaveNote` is removed; remove now-unused imports (`StickyNote`, `Save`) and the `@mouseover/@mouseout` tooltip wiring.
- **Frontend** `composables/useHighlight.ts`: `createMark` stops setting `mark.dataset.highlightNote`.
- **Frontend** `stores/highlights.ts`: `create()` and `update()` drop the `note` parameter.
- **Shared** `types.ts`: remove `note: string | null` from `Highlight`.
- **Backend** `api/highlights.ts`: POST body type/destructuring/insert and PUT body/update logic drop `note`. A `note` field on an incoming request is simply not read (ignored), matching the spec.

### Decision 7 — Remove `note` from the Drizzle schema, but keep the physical column (no destructive migration)
Remove `note: text('note')` from the `highlights` definition in `db/schema.ts`. Do **not** run `drizzle-kit generate` / create a `DROP COLUMN` migration. The physical, nullable `note` column stays in the DB holding historical data; the app never selects, inserts, or updates it.

- **Why**: Honors the explicit instruction "可以保留在数据库里但是不用读了". Dropping the field from the schema is safe at runtime — drizzle never selects it, and inserts that omit a nullable column store NULL, so no startup or insert error.
- **Trade-off**: `schema.ts` and the migrations history will disagree about this one column; a future `drizzle-kit generate` will *propose* dropping it. That proposal is expected and can be ignored (or applied later if the user ever wants the data gone). Documented here so it isn't mistaken for an oversight. This deliberately diverges from the usual "generate a migration after schema changes" convention for this one non-destructive case.

## Risks / Trade-offs

- **Partial table selection** → If the user selects only part of a table (e.g. half its rows), the cloned fragment may contain orphaned `<tr>`/`<td>` without a full `<table>`, and the GFM table rule degrades. → Documented as a known limitation; whole-table selections are the supported path.
- **`|` inside table-cell math** → After we substitute `$…$` back into a GFM cell, a `|` inside the LaTeX (e.g. `\left| x \right|`) could break column parsing. → Rare; acceptable known limitation (could later escape `|`→`\|` only when inside a table context).
- **HTML→Markdown round-trip is not byte-identical** to the author's source (Non-Goal). → Acceptable; the goal is faithful, paste-ready Markdown, and math (the part that matters most) is exact.
- **Sentinel collision** → A real document could in theory contain the chosen private-use token. → Use PUA codepoints (`…`) plus an index; effectively impossible in normal paper/Q&A text.
- **Stale client still sends `note`** → After the API drops `note`, an old cached frontend might still POST/PUT it. → The API ignores unknown `note` (spec scenario), so no error and no persistence.
- **Schema/migration drift on `note`** (Decision 7) → Mitigated by explicit documentation here and in tasks; runtime is unaffected.

## Migration Plan

1. Ship shared-type, backend, and frontend changes together (the `note` field disappears from the contract end-to-end in one change).
2. No DB migration is run; the `highlights.note` column and its existing data remain untouched and simply go unread.
3. **Rollback**: revert the code change. Because the physical column was never dropped, reverting restores full note read/write with no data loss.
4. New frontend deps (`turndown`, `turndown-plugin-gfm`) are added via `bun install`; no backend/runtime infra changes.

## Open Questions

- None. Copy scope (selection-only) and math handling (`$…$` from `x-tex`, always) were confirmed with the user; the non-destructive schema approach follows the user's explicit "keep in DB, stop reading" instruction.
