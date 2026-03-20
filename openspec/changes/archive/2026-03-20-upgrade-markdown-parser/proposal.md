## Why

The current markdown parser (`marked` v17) frequently fails to correctly parse valid markdown syntax — particularly around complex nesting, edge cases with math delimiters inside lists/tables, and certain GFM constructs. The existing `normalizeDelimiters()` workaround for `\(...\)` / `\[...\]` math syntax is fragile and breaks when delimiters appear inside code blocks or nested structures. Switching to `markdown-it` — a spec-compliant, battle-tested parser with a rich plugin ecosystem — will resolve these parsing issues while maintaining full compatibility with the existing text highlighting system.

## What Changes

- **Replace `marked` + `marked-katex-extension` with `markdown-it`** and its KaTeX plugin (`@traptitech/markdown-it-katex`) for markdown parsing
- **Remove the `normalizeDelimiters()` workaround** — `markdown-it-katex` natively supports `$`, `$$`, `\(`, `\)`, `\[`, `\]` delimiters without manual conversion
- **Enable GFM features via plugins** — tables, strikethrough, task lists via `markdown-it` built-in options and plugins
- **Preserve highlight system compatibility** — the DOM-based text segment walker (`useHighlight.ts`) operates on rendered HTML nodes, not the parser AST; as long as KaTeX elements retain `.katex` / `.katex-display` classes (which KaTeX always generates), the highlight system continues to work without changes
- **Update MarkdownContent.vue** — replace `marked.parse()` call with `markdown-it.render()`, update configuration, remove delimiter normalization code

## Capabilities

### New Capabilities
- `markdown-it-rendering`: Replace `marked` with `markdown-it` as the markdown rendering engine, with KaTeX math support and GFM features

### Modified Capabilities
- `markdown-math-rendering`: Math delimiter handling changes from manual regex normalization to native plugin support — `\(...\)` and `\[...\]` are handled directly by the KaTeX plugin instead of being pre-converted to `$` / `$$`
- `markdown-highlight`: No requirement changes — the highlighting system operates on rendered DOM and is parser-agnostic. Listed here only to confirm compatibility must be validated.

## Impact

- **Frontend dependencies**: Remove `marked`, `marked-katex-extension`; add `markdown-it`, `@traptitech/markdown-it-katex`; keep `katex` (still needed for rendering)
- **Code changes**: `MarkdownContent.vue` only — swap parser initialization and render call, remove `normalizeDelimiters()`
- **No backend changes**: Markdown is rendered client-side only
- **No highlight system changes**: `useHighlight.ts` and `highlights.ts` store remain untouched — they operate on DOM nodes, not the parser
- **No API changes**: No endpoints affected
- **Risk**: Rendered HTML structure may differ slightly between parsers (e.g., attribute ordering, whitespace in output) — existing highlights stored with text offsets should still work due to text-content-based matching, but edge cases may need testing
