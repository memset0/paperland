## 1. Fix default-mode selection

- [x] 1.1 In `components/PaperViewerPanel.vue`, add a `pickDefault()` helper that prefers a non-`walkthrough` (primary) mode and only falls back to "Note" when it is the only available mode.
- [x] 1.2 Add a `userChose` ref; the auto-default `watch(availableModes)` skips re-selection once a mode was chosen explicitly (only re-picks if the chosen mode disappears).
- [x] 1.3 Set `userChose = true` in the `requestedPdfTarget`, `requestedPublicNote`, and `route.query.view === 'note'` watches so deep-link selections are preserved.
- [x] 1.4 Add `selectMode()` and bind the tab bar via `:model-value` + `@update:model-value` so a manual tab click pins the user's choice.

## 2. Docs

- [x] 2.1 Update `docs/frontend-architecture.md` (multi-mode viewer section): corrected default-selection rule and the stale "Note" tab availability description.

## 3. Verify

- [x] 3.1 `vue-tsc --noEmit` clean.
- [ ] 3.2 Manual QA: open a paper with a PDF → defaults to "PDF 原文" (not "Note"); a paper with only an arXiv id → defaults to "幻觉翻译"; a paper with neither → defaults to "Note"; `?view=note` and a `?note=<id>` deep link still land on "Note"; a manual tab click is not overridden when the paper finishes loading.
