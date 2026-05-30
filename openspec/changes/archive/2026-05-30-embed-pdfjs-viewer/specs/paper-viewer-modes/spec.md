## MODIFIED Requirements

### Requirement: Multi-mode viewer in wide layout
The paper detail page left panel SHALL support multiple viewing modes via a tab bar. Each mode renders different content in the same viewer area.

#### Scenario: PDF mode displayed
- **WHEN** a paper has a `pdf_path`
- **THEN** the viewer SHALL show a "PDF 原文" tab that renders the PDF via the embedded pdf.js viewer (the `pdfjs-viewer` capability), NOT a native PDF iframe

#### Scenario: Translation mode displayed
- **WHEN** a paper has an `arxiv_id`
- **THEN** the viewer SHALL show a "幻觉翻译" tab that renders `https://hjfy.top/arxiv/{arxiv_id}` in an iframe

#### Scenario: Mode switching
- **WHEN** the user clicks a different tab in the viewer tab bar
- **THEN** the viewer content SHALL switch to the selected mode's content immediately

#### Scenario: Auto-select first available mode
- **WHEN** the viewer panel loads
- **THEN** the first available mode SHALL be selected by default

#### Scenario: No modes available
- **WHEN** a paper has neither `pdf_path` nor `arxiv_id`
- **THEN** the viewer area SHALL show a placeholder message indicating no viewer content is available

## ADDED Requirements

### Requirement: Viewer panel activates the PDF tab on a PDF anchor
When an in‑app PDF anchor navigation is requested (from a clicked `paperland://…?pdf=…` link or from route query on cross‑paper navigation), the viewer panel SHALL switch the active tab to "PDF 原文" if it is not already active, and forward the page/region navigation request to the embedded pdf.js viewer.

#### Scenario: Auto‑switch to PDF tab on anchor
- **WHEN** a PDF anchor navigation is requested while the "幻觉翻译" tab is active
- **THEN** the viewer panel SHALL switch to the "PDF 原文" tab and forward the page/region request to the pdf.js viewer

#### Scenario: Already on the PDF tab
- **WHEN** a PDF anchor navigation is requested while the "PDF 原文" tab is already active
- **THEN** the viewer panel SHALL forward the page/region request to the pdf.js viewer without changing tabs
