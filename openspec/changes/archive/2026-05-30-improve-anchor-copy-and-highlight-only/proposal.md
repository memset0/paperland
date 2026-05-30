## Why

The selection toolbar's "复制为锚点链接" action currently copies only a 40-character, render-stripped plain-text label wrapped as a single Markdown link — `[truncated text](paperland://...)`. The full selection, its math, and its formatting are all lost, and the whole passage becomes one giant hyperlink, which is awkward to paste into a note. Separately, now that a dedicated per-user notes system exists (`notes` table, walkthrough + mind-map), the old "note attached to a highlight" feature is redundant — highlights should just highlight.

## What Changes

- **Rework the copy-anchor action** so the clipboard receives the **full selected content as Markdown** (not a truncated label, not rendered plain text), followed by a compact `[#](paperland://...)` anchor link appended after the content. Example: `The attention cost is $O(n^2)$ ... [#](paperland://paper/42?h=ab12&s=10&e=58)`.
  - Math MUST be preserved exactly using `$...$` (inline) / `$$...$$` (display), reconstructed from each KaTeX element's `x-tex` annotation — never the render-stripped visual text.
  - Whole-table selections are converted to GFM pipe tables; other formatting (bold, lists, code, blockquotes) is preserved as Markdown.
- **Highlights become highlight-only. (BREAKING, UX)** Remove all note-taking from highlights: the toolbar's note input, the click-menu "Note/Save" action, and the hover tooltip are removed. A highlight now carries only a color.
- Remove the `note` field from the `Highlight` shared type, the highlights HTTP API (POST/PUT no longer accept or return `note`), the frontend highlight store, and the Drizzle `highlights` table definition.
- Old `note` data is intentionally **left in the physical database** (no destructive migration) but is no longer read — honoring "可以保留在数据库里但不用读了".
- The new notes system (`notes` table, walkthrough + mind-map, inline `paperland://` anchors) is **untouched** — only the old highlight-note is being dropped.
- Add frontend dependencies `turndown` + `turndown-plugin-gfm` to convert the selected rendered DOM fragment back to Markdown.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `markdown-highlight`: (1) the selection toolbar's copy-anchor action now copies the full selection as Markdown — math as `$…$`/`$$…$$`, tables as GFM — with a trailing `[#](paperland://…)` link, instead of a truncated link label; (2) highlights no longer support notes — the data model, the create/update API, the toolbar, the hover tooltip, and the click menu all drop the `note` concept.

## Impact

- **Frontend**: `components/MarkdownContent.vue` (rewrite `copyAnchorLink`; remove note input, click-menu note action, hover tooltip, related state/styles/imports), `composables/useHighlight.ts` (`createMark` stops setting `data-highlight-note`), `stores/highlights.ts` (`create`/`update` drop `note`), `package.json` (+ `turndown`, `turndown-plugin-gfm`).
- **Backend**: `api/highlights.ts` (POST/PUT drop `note`), `db/schema.ts` (remove `note` from the `highlights` table definition; **no** destructive migration — physical column left in place).
- **Shared**: `types.ts` — `Highlight` drops `note`.
- **Docs**: `frontend-architecture.md`, `external-api.md`, `tech-stack.md`.
- **Unchanged**: the `paperland://` scheme (`markdown-anchors`), block resolution / `locateBlock`, and the new `notes` system.
