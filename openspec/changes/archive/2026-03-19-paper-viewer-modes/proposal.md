## Why

The paper detail page's left panel currently only supports PDF preview via iframe. For papers with an arxiv_id, users would benefit from additional viewing modes — particularly an integrated Chinese translation view (via hjfy.top). The current single-column (narrow screen) layout shows nothing useful for the left panel content, wasting an opportunity to provide quick-access links.

## What Changes

- **Multi-mode viewer in wide layout**: The left panel gains a tab/switcher UI to toggle between viewing modes:
  - **PDF 原文**: Current PDF iframe view (default, always available when pdf_path exists)
  - **幻觉翻译**: For papers with arxiv_id, embed `https://hjfy.top/arxiv/{arxiv_id}` as an iframe
- **Link collection in narrow layout**: Instead of the current single arXiv PDF link, the narrow layout shows a collection of external links:
  - arXiv PDF link (`https://arxiv.org/pdf/{arxiv_id}.pdf`)
  - 幻觉翻译 link (`https://hjfy.top/arxiv/{arxiv_id}`)
  - (Links only shown when the paper has an arxiv_id)
- **Extensible architecture**: The viewer mode system should be designed so additional modes can be added easily in the future.

## Capabilities

### New Capabilities
- `paper-viewer-modes`: Multi-mode paper viewing with tab switching in wide layout and link collection in narrow layout

### Modified Capabilities
- `pdf-split-view`: The left pane is no longer PDF-only — it becomes a multi-mode viewer container. The split-view layout, draggable divider, and right pane remain unchanged.

## Impact

- **Frontend only** — no backend or API changes needed
- `packages/frontend/src/views/PaperDetail.vue` — major refactor of left panel and narrow layout sections
- `packages/frontend/src/components/PdfViewer.vue` — may be wrapped or kept as-is inside the new viewer
- New component(s) for the mode switcher UI and link collection
- `docs/frontend-architecture.md` — update paper detail page documentation
