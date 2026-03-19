## 1. Dependencies

- [x] 1.1 Install `katex` and `marked-katex-extension` packages in `packages/frontend`

## 2. MarkdownContent Component Update

- [x] 2.1 Import KaTeX CSS stylesheet in the component
- [x] 2.2 Configure `marked-katex-extension` with `marked.use()` — enable all four delimiter styles (`$`, `$$`, `\(`, `\)`, `\[`, `\]`), set `throwOnError: false`
- [x] 2.3 Fix list styling: add `list-style-type: disc` for `<ul>` and `list-style-type: decimal` for `<ol>` in scoped CSS
- [x] 2.4 Remove non-functional `prose prose-sm` classes from template div
- [x] 2.5 Add KaTeX-specific CSS overrides if needed (display math centering, overflow handling for wide equations)

## 3. Documentation

- [x] 3.1 Update `docs/frontend-architecture.md` to document markdown rendering capabilities (math support, KaTeX integration)
