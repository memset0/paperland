# paper-viewer-modes Specification

## Purpose
Multi-mode paper viewing in the detail page left panel, supporting PDF and translation iframe modes with tab-based switching.

## Requirements

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

### Requirement: Narrow layout hides viewer
In single-column (narrow) layout, the viewer panel SHALL be hidden entirely.

#### Scenario: Narrow screen
- **WHEN** the screen width is below 900px
- **THEN** the viewer panel SHALL not be rendered and only paper info and Q&A content SHALL be shown

### Requirement: Viewer mode extensibility
The viewer mode system SHALL be data-driven so that new modes can be added by defining a mode object with name, availability condition, and content renderer.

#### Scenario: Adding a new mode
- **WHEN** a developer adds a new entry to the viewer modes array
- **THEN** the tab bar and mode switching SHALL automatically support the new mode without changes to the tab/switching logic

### Requirement: Walkthrough viewer mode
The paper detail left panel viewer SHALL offer a walkthrough mode that renders the current paper's small-notes tree as a single continuous Markdown document (see the `notes-walkthrough` capability). The mode SHALL be available whenever the paper's notes tree contains content, and SHALL participate in the existing data-driven mode system (tab bar, switching, auto-select) without special-casing.

#### Scenario: Walkthrough tab displayed when notes exist
- **WHEN** a paper has at least one non-empty note
- **THEN** the viewer SHALL show a walkthrough tab that renders the assembled notes document

#### Scenario: Walkthrough switches like other modes
- **WHEN** the user selects the walkthrough tab
- **THEN** the viewer content SHALL switch to the rendered walkthrough document immediately, consistent with switching between the PDF and translation modes

#### Scenario: Walkthrough updates live
- **WHEN** the user is viewing the walkthrough mode and edits or rearranges notes
- **THEN** the rendered walkthrough SHALL update automatically without leaving or re-selecting the tab

### Requirement: Viewer panel activates the PDF tab on a PDF anchor
When an in‑app PDF anchor navigation is requested (from a clicked `paperland://…?pdf=…` link or from route query on cross‑paper navigation), the viewer panel SHALL switch the active tab to "PDF 原文" if it is not already active, and forward the page/region navigation request to the embedded pdf.js viewer.

#### Scenario: Auto‑switch to PDF tab on anchor
- **WHEN** a PDF anchor navigation is requested while the "幻觉翻译" tab is active
- **THEN** the viewer panel SHALL switch to the "PDF 原文" tab and forward the page/region request to the pdf.js viewer

#### Scenario: Already on the PDF tab
- **WHEN** a PDF anchor navigation is requested while the "PDF 原文" tab is already active
- **THEN** the viewer panel SHALL forward the page/region request to the pdf.js viewer without changing tabs

### Requirement: Walkthrough viewer mode
The paper detail left panel viewer SHALL offer a walkthrough mode that renders the current paper's small-notes tree as a single continuous Markdown document (see the `notes-walkthrough` capability). The mode SHALL be available whenever the paper's notes tree contains content, and SHALL participate in the existing data-driven mode system (tab bar, switching, auto-select) without special-casing.

#### Scenario: Walkthrough tab displayed when notes exist
- **WHEN** a paper has at least one non-empty note
- **THEN** the viewer SHALL show a walkthrough tab that renders the assembled notes document

#### Scenario: Walkthrough switches like other modes
- **WHEN** the user selects the walkthrough tab
- **THEN** the viewer content SHALL switch to the rendered walkthrough document immediately, consistent with switching between the PDF and translation modes

#### Scenario: Walkthrough updates live
- **WHEN** the user is viewing the walkthrough mode and edits or rearranges notes
- **THEN** the rendered walkthrough SHALL update automatically without leaving or re-selecting the tab
