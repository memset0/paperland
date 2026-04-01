## 1. QAList.vue — Split into two cards

- [x] 1.1 Replace `unifiedEntries` computed with two separate computed properties: `templateEntries` (config order) and `freeEntries` (newest first)
- [x] 1.2 Render two independent card containers in the template: Template Q&A card (with "一键生成" button, polling indicator, expand/collapse-all) and Free Q&A card (with expand/collapse-all)
- [x] 1.3 Add scoped `setAllOpen` functions using `data-qa-template-list` and `data-qa-free-list` container attributes
- [x] 1.4 Change `isOpen()` to always return `false` (default collapsed), remove localStorage read on initial render

## 2. QAList.vue — Expanded content display

- [x] 2.1 Ensure question title in `<summary>` keeps `line-clamp-1` for truncation when collapsed
- [x] 2.2 Verify expanded mode shows full answer via QAResultView/MarkdownContent without truncation (already works, just confirm no regressions)

## 3. PaperDetail.vue — Update sidebar nav entries

- [x] 3.1 Update `qaNavEntries` computed to: first template entries with results, then all free entries (filter out template entries without results)

## 4. PaperDetail.vue — Verify card ordering

- [x] 4.1 Confirm DOM order is: Kimi summary card → QAList (which now renders Template QA card then Free QA card) — no PaperDetail template changes needed since QAList is already after Kimi

## 5. Documentation

- [x] 5.1 Update `docs/frontend-architecture.md` to reflect the new QA display split layout
