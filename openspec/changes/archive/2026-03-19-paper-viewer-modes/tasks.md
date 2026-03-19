## 1. PaperViewerPanel Component

- [x] 1.1 Create `PaperViewerPanel.vue` component with viewer mode data structure (mode name, availability condition, iframe URL builder) and tab bar UI
- [x] 1.2 Implement mode switching logic — clicking a tab switches the displayed iframe, auto-select first available mode on mount
- [x] 1.3 Implement 幻觉翻译 iframe mode (`https://hjfy.top/arxiv/{arxiv_id}`) with sandbox attributes
- [x] 1.4 Handle edge case: no modes available — show placeholder message

## 2. PaperLinks Component

- [x] 2.1 Create `PaperLinks.vue` component that renders a horizontal collection of external link chips (arXiv PDF, 幻觉翻译, papers.cool)
- [x] 2.2 Conditionally show each link based on `arxiv_id` availability

## 3. Integrate into PaperDetail

- [x] 3.1 Replace `PdfViewer` usage in wide layout left panel with `PaperViewerPanel`, passing paper data as props
- [x] 3.2 Replace the single arXiv PDF link in narrow layout with `PaperLinks` component
- [x] 3.3 Keep existing QAInput overlay positioning and draggable divider logic unchanged

## 4. Documentation

- [x] 4.1 Update `docs/frontend-architecture.md` with paper viewer modes description
