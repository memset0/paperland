## Context

The paper detail page (`PaperDetail.vue`) currently has a two-column wide layout with the left panel dedicated entirely to a PDF iframe viewer (`PdfViewer.vue`). In narrow/single-column mode (<900px), only a single arXiv PDF link is shown. The `Paper` type already has `arxiv_id: string | null` which is used to construct arXiv URLs.

The user wants to:
1. Add a "幻觉翻译" (hallucination translation) mode for arxiv papers via `hjfy.top` iframe embedding
2. Replace the narrow-mode single link with a link collection
3. Make the system extensible for future viewing modes

## Goals / Non-Goals

**Goals:**
- Add tab-based mode switching in the wide layout left panel (PDF 原文 / 幻觉翻译)
- Show a link collection in narrow layout instead of the current single PDF link
- Keep the existing PDF viewer, draggable divider, and right panel unchanged
- Make adding future viewer modes straightforward

**Non-Goals:**
- Backend changes or new API endpoints
- Changing the right panel (paper info, Q&A) in any way
- Supporting translation for non-arXiv papers
- Caching or proxying hjfy.top content

## Decisions

### 1. New `PaperViewerPanel` component wrapping mode switching

**Decision**: Create a new `PaperViewerPanel.vue` component that manages the tab UI and renders the appropriate viewer iframe based on selected mode. `PdfViewer.vue` stays as-is and is used as one of the viewer modes.

**Rationale**: Keeps `PdfViewer.vue` focused on its single responsibility. The new component handles mode definition, tab rendering, and conditional iframe display. Adding a new mode in the future means adding an entry to the modes array.

**Alternative considered**: Modifying `PdfViewer.vue` directly — rejected because it couples PDF-specific logic with mode management.

### 2. Mode availability driven by paper data

**Decision**: Each viewer mode declares a condition for when it's available (e.g., "PDF 原文" requires `pdf_path`, "幻觉翻译" requires `arxiv_id`). The component filters to only show available modes, and auto-selects the first available mode.

**Rationale**: Clean separation — modes are data-driven, not hardcoded if/else chains. Easy to add a new mode with its own availability condition.

### 3. Tab bar UI at top of left panel

**Decision**: Simple horizontal tab bar above the viewer content area. Tabs show mode names. Active tab is highlighted. If only one mode is available, still show the tab bar (single tab) for consistency and discoverability.

**Rationale**: Minimal UI overhead. Users immediately see what modes are available. Consistent with the existing design language.

### 4. Narrow layout link collection replaces single link

**Decision**: In narrow layout, replace the current single "在 arXiv 上查看 PDF" link with a `PaperLinks.vue` component that renders a horizontal set of link chips/buttons. Links include: arXiv PDF, 幻觉翻译 (hjfy.top), papers.cool (already computed). Each link is conditionally shown based on `arxiv_id` availability.

**Rationale**: Reusable, clean, and provides all external paper links in one place. The link data structure mirrors the viewer modes for consistency.

### 5. iframe for hjfy.top translation

**Decision**: Use a simple `<iframe>` with `src="https://hjfy.top/arxiv/{arxiv_id}"` and `sandbox="allow-scripts allow-same-origin allow-popups"`. Full-size within the viewer area, same as the existing PDF iframe.

**Rationale**: The user explicitly stated this approach. hjfy.top is an external service that works well in iframes. Sandbox attributes provide reasonable security while allowing the site to function.

## Risks / Trade-offs

- **[hjfy.top availability]** → The service is external and may be slow or down. Mitigation: show a loading state, and the tab can simply be tried/abandoned by the user.
- **[iframe X-Frame-Options]** → hjfy.top may set headers that block embedding. Mitigation: test during implementation; if blocked, fall back to showing a link instead of an iframe. The link collection in narrow mode serves as a natural fallback.
- **[No PDF and no arxiv_id]** → Some papers may have neither. Mitigation: show a placeholder message (similar to current "暂无 PDF" behavior).
