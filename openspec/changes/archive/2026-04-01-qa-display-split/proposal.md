## Why

The paper detail page currently mixes template QA and free QA into a single unified list, making it hard to distinguish between structured template questions and ad-hoc free questions. Separating them into distinct cards improves clarity and aligns the display order with the user's mental model: external summaries first, then template QA, then free QA.

## What Changes

- Split the unified QA list into two separate cards: **Template QA** and **Free QA**, each with its own header and expand/collapse controls
- Reorder the three content cards: Kimi summary (external) -> Template QA -> Free QA (currently free QA appears before template QA)
- Sidebar quick-jump navigation: hide template QA questions that have no generated content (no results); show free QA entries after template QA entries (matching the new card order)
- Default all QA questions to **collapsed** state on page load (ignore localStorage history); users manually click to expand/collapse
- In collapsed mode: show single-line truncated content (existing behavior). In expanded mode: show full content with natural word-wrap (no forced newlines, but allow multi-line display)

## Capabilities

### New Capabilities
- `qa-display-split`: Separate template QA and free QA into independent cards with distinct rendering, ordering, and collapse behavior

### Modified Capabilities
- `qa-panel-nav`: Update sidebar navigation to reflect new card order (template QA first, free QA after) and hide template questions without generated results

## Impact

- `packages/frontend/src/components/QAList.vue` — major refactor: split unified entries into two card sections
- `packages/frontend/src/components/QAPanelNav.vue` — update entry list generation and ordering logic
- `packages/frontend/src/views/PaperDetail.vue` — adjust card ordering (Kimi -> Template QA -> Free QA)
- No backend or API changes required
- No database schema changes
