## 1. Dependencies

- [x] 1.1 Add `turndown` and `turndown-plugin-gfm` to `packages/frontend/package.json` and run `bun install`
- [x] 1.2 If types are missing, add `@types/turndown` (or a local `.d.ts` shim) so the frontend type-checks

## 2. Copy selection as Markdown + anchor (`MarkdownContent.vue`)

- [x] 2.1 Add a `selectionToMarkdown()` helper: clone the live selection range (`range.cloneContents()`), unwrap any `<mark data-highlight-id>` wrappers in the clone
- [x] 2.2 In the clone, replace each `.katex-display` then each remaining `.katex` element with a private-use sentinel text node, recording `{ index, display, tex }` where `tex` comes from `<annotation encoding="application/x-tex">`
- [x] 2.3 Run `turndown` (configured with `turndown-plugin-gfm` tables) on the cleaned clone to produce Markdown
- [x] 2.4 Substitute each sentinel back to `$<tex>$` (inline) or `$$<tex>$$` (display) in the resulting Markdown; trim
- [x] 2.5 Rewrite `copyAnchorLink()` to copy `` `${markdown} [#](${url})` `` where `url` keeps the existing `paperland://paper/<id>?h=<hash>&s=<start>&e=<end>` form built from `paperId`, `contentHash`, and `pendingSelection` offsets; keep the success toast and selection clear
- [x] 2.6 Manually verify: plain prose, bold/italic, a list, inline math `$…$`, a display equation `$$…$$`, and a whole table each copy as expected Markdown followed by the `[#]` anchor; paste into a note and confirm the anchor still jumps

## 3. Highlights become color-only — frontend

- [x] 3.1 `MarkdownContent.vue`: remove the toolbar note toggle + note input and the `showNoteInput`/`noteText` state; `createHighlight()` no longer passes `note`
- [x] 3.2 `MarkdownContent.vue`: remove the click-menu "Note/Save" path, `menuEditNote`/`menuNoteText` state, `menuSaveNote()`, and the `hl-menu-note` template/styles (keep color change + delete)
- [x] 3.3 `MarkdownContent.vue`: remove the hover tooltip — `showTooltip`/`tooltipNote`/`tooltipPos` state, `onMarkMouseEnter`/`onMarkMouseLeave`, the `@mouseover/@mouseout` wiring, the tooltip template block, and `hl-tooltip` styles
- [x] 3.4 `MarkdownContent.vue`: remove now-unused imports (`StickyNote`, `Save`) and the `hl-note-input` styles
- [x] 3.5 `composables/useHighlight.ts`: `createMark()` stops setting `mark.dataset.highlightNote`
- [x] 3.6 `stores/highlights.ts`: drop `note` from the `create()` and `update()` parameter types and calls

## 4. Highlights become color-only — shared + backend

- [x] 4.1 `packages/shared/src/types.ts`: remove `note: string | null` from the `Highlight` interface
- [x] 4.2 `api/highlights.ts`: POST — remove `note` from the Body type, destructuring, and insert values (ignore it if sent)
- [x] 4.3 `api/highlights.ts`: PUT — remove `note` from the Body type and the update logic (only `color` is updatable)
- [x] 4.4 `db/schema.ts`: remove `note: text('note')` from the `highlights` table definition. Do NOT run `drizzle-kit generate`; leave the physical column in place (add a brief comment noting the column is intentionally retained but unread)

## 5. Verification & docs

- [x] 5.1 Type-check the frontend and backend build to confirm no remaining `note` references on highlights
- [x] 5.2 Confirm the new `notes` table / notes system is untouched (no edits under notes API, store, schema `notes`)
- [x] 5.3 Update `docs/frontend-architecture.md` (copy-anchor now copies full Markdown + `[#]`; highlights are color-only; tooltip removed)
- [x] 5.4 `docs/external-api.md`: no change needed — highlights are a `/api/*` website endpoint (documented in frontend-architecture.md, already updated), not part of the external Bearer API. external-api.md only references `highlights` in the cascade-delete list, which remains accurate.
- [x] 5.5 Update `docs/tech-stack.md` (frontend now depends on `turndown` + `turndown-plugin-gfm`)
