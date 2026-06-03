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

#### Scenario: Auto-select first available primary mode
- **WHEN** the viewer panel loads and the user has not explicitly selected a mode
- **THEN** the first available **primary** viewer mode (PDF or translation) SHALL be selected by default, and the always-available "Note" mode SHALL NOT be auto-selected while a primary mode is or later becomes available

#### Scenario: Note is the only available mode
- **WHEN** a paper has neither `pdf_path` nor `arxiv_id`, so the always-available "Note" mode is the only mode
- **THEN** the "Note" mode SHALL be selected by default

#### Scenario: Default re-evaluated when primary modes load late
- **WHEN** the panel mounts before the paper's `pdf_path` / `arxiv_id` have loaded (so "Note" is briefly the only available mode) and the user has not explicitly selected a mode
- **THEN** once a primary mode (PDF or translation) becomes available the default SHALL switch to it rather than remain on "Note"

#### Scenario: Explicit selection is preserved
- **WHEN** the user has explicitly selected a mode — by clicking a tab, or via a `?view=note` / `?note=<id>` / `paperland://…?pdf=…` deep link
- **THEN** the auto-default logic SHALL NOT override that selection when the set of available modes later changes (it only re-picks if the selected mode disappears)

#### Scenario: No modes available
- **WHEN** a paper has neither `pdf_path` nor `arxiv_id`
- **THEN** the viewer area SHALL show a placeholder message indicating no viewer content is available
