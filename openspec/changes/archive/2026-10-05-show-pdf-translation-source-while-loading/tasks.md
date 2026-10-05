## 1. PDF Selection Translation Waiting State

- [x] 1.1 Replace the PDF translation panel's textual loading placeholder with the active stable selection's plain source text while the scoped-slot translation text is empty; verify the rendered waiting state contains the exact selected source and contains neither “等待翻译” nor “加载翻译”
- [x] 1.2 Preserve the existing translated-text branch so the first non-empty mocked delta or cache result replaces the source preview and later deltas continue accumulating; verify a focused mocked streaming/cache interaction observes source → first translation → completed translation in order
- [x] 1.3 Adjust or remove waiting-placeholder-specific scoped styles without changing the panel bounds, header status, `aria-busy`, actions, selection preservation, or request lifecycle; verify the frontend production build reports no template or style warnings

## 2. Documentation

- [x] 2.1 Update `docs/frontend-architecture.md` to document the source-preview waiting state and first-translation replacement rule; verify the text distinguishes source preview from translated output
- [x] 2.2 Update `docs/external-api.md` to record that the change is limited to the authenticated Internal PDF UI and does not alter External API endpoints; verify the endpoint inventory remains unchanged
- [x] 2.3 Update `docs/tech-stack.md` to record that the existing Vue scoped slot and SSE stream are reused with no backend, database, provider, configuration, or dependency change; verify the document does not claim a new service path

## 3. Verification and Spec Alignment

- [x] 3.1 Run focused frontend-local tests or a mocked component interaction for waiting, first-delta, cache-hit, and retry states without calling a real provider; verify all assertions pass
- [x] 3.2 Run the frontend production build and verify `PdfViewer` compiles successfully
- [x] 3.3 Validate `show-pdf-translation-source-while-loading` strictly, review its implementation diff against the delta spec, and mark every task complete only after the behavior and required docs match
