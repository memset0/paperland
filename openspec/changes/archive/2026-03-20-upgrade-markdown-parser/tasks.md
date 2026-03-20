## 1. Dependencies

- [x] 1.1 Install `markdown-it` and `@traptitech/markdown-it-katex` in `packages/frontend`
- [x] 1.2 Remove `marked` and `marked-katex-extension` from `packages/frontend`

## 2. Core Parser Swap

- [x] 2.1 Replace `marked` imports with `markdown-it` and `@traptitech/markdown-it-katex` in `MarkdownContent.vue`
- [x] 2.2 Create module-level `markdown-it` instance configured with `{ breaks: true, linkify: true, html: false }` and KaTeX plugin (`throwOnError: false`)
- [x] 2.3 Replace `marked.parse(normalizeDelimiters(props.content))` with `md.render(props.content)` in `renderAndHighlight()`
- [x] 2.4 Remove the `normalizeDelimiters()` function entirely

## 3. Validation

- [x] 3.1 Manually verify basic markdown rendering: headings, paragraphs, bold, italic, links, lists, code blocks, blockquotes, tables
- [x] 3.2 Verify math rendering: inline `$...$`, display `$$...$$`, backslash-paren `\(...\)`, backslash-bracket `\[...\]`
- [x] 3.3 Verify math delimiters inside code blocks are NOT rendered as math
- [x] 3.4 Verify GFM features: strikethrough (`~~text~~`), task lists (`- [ ]`/`- [x]`), tables with alignment
- [x] 3.5 Verify text highlighting still works: create, hover tooltip, click menu, delete highlights
- [x] 3.6 Verify KaTeX atomic highlighting: selecting text that overlaps a formula auto-expands to include the full formula

## 4. Cleanup & Docs

- [x] 4.1 Update `docs/tech-stack.md` to reflect `markdown-it` replacing `marked` (no references found, no change needed)
- [x] 4.2 Update `docs/frontend-architecture.md` if it references `marked` or `normalizeDelimiters`
