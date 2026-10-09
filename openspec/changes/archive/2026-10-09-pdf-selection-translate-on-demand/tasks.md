## 1. Selection helpers

- [x] 1.1 Remove `StableSelectionIntent`/`TimerAdapter` from `lib/pdf-selection-translation.ts` and their tests; keep snapshot, placement, panel-text, outside-decision helpers and tests passing

## 2. PdfViewer selection toolbar

- [x] 2.1 Replace the single copy-link button with a selection toolbar (styled like the Markdown highlight toolbar) below the selection: 翻译 (authenticated only) + 复制选区链接 (paperId only)
- [x] 2.2 Remove the 500ms auto-translate intent and dismissed-identity tracking; add `translateSelection()` that activates the panel for the current selection identity (no-op if already active)
- [x] 2.3 A different settled selection closes the old panel; toolbar pointer interactions are owned like panel interactions so they don't dismiss the panel
- [x] 2.4 Verify type-check/build and run the helper unit test

## 3. Docs

- [x] 3.1 Update `docs/frontend-architecture.md` PDF selection translation section (tech-stack/external-api unaffected — no API or dependency change)
