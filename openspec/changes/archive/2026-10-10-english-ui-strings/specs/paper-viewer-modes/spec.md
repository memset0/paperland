## MODIFIED Requirements

### Requirement: Multi-mode viewer in wide layout
The paper detail page left panel SHALL support multiple viewing modes via a tab bar. Each mode renders different content in the same viewer area.

#### Scenario: PDF mode displayed
- **WHEN** a paper has a `pdf_path`
- **THEN** the viewer SHALL show a "PDF" tab that renders the PDF via the embedded pdf.js viewer (the `pdfjs-viewer` capability), NOT a native PDF iframe

#### Scenario: Translation mode displayed
- **WHEN** a paper has an `arxiv_id`
- **THEN** the viewer SHALL show a "hjfy.top" tab that renders `https://hjfy.top/arxiv/{arxiv_id}` in an iframe

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

### Requirement: Viewer panel activates the PDF tab on a PDF anchor
When an in‑app PDF anchor navigation is requested (from a clicked `paperland://…?pdf=…` link or from route query on cross‑paper navigation), the viewer panel SHALL switch the active tab to "PDF" if it is not already active, and forward the page/region navigation request to the embedded pdf.js viewer.

#### Scenario: Auto‑switch to PDF tab on anchor
- **WHEN** a PDF anchor navigation is requested while the "hjfy.top" tab is active
- **THEN** the viewer panel SHALL switch to the "PDF" tab and forward the page/region request to the pdf.js viewer

#### Scenario: Already on the PDF tab
- **WHEN** a PDF anchor navigation is requested while the "PDF" tab is already active
- **THEN** the viewer panel SHALL forward the page/region request to the pdf.js viewer without changing tabs

### Requirement: Doc2X translation viewer mode
When doc2x is enabled and the paper has a `pdf_path`, the viewer SHALL show a "Bilingual PDF" tab after "PDF". The tab SHALL show the doc2x parse status and reflect the translation status:
- `idle`: a "Start translation" button that requests translation;
- `queued`: a message that translation is waiting for the doc2x parse;
- `pending`/`running`: an in-progress indicator, refreshed by polling until a terminal state;
- `failed`: the error and a "Retry" button;
- `done`: the translated PDF in the embedded pdf.js viewer, with a toggle between "Side by side" (the bilingual PDF) and "Translation only" (the translation-only PDF).
The "Bilingual PDF" tab SHALL NOT be auto-selected as the default mode.

#### Scenario: Request translation from the tab
- **WHEN** the user clicks "Start translation" in the "Bilingual PDF" tab
- **THEN** a translation request SHALL be sent and the tab SHALL show the queued or in-progress state

#### Scenario: Switch display
- **WHEN** translation is done and the user selects "Translation only"
- **THEN** the viewer SHALL display the translation-only PDF, and selecting "Side by side" SHALL display the bilingual PDF

#### Scenario: Display choice remembered
- **WHEN** the user picks a display and later opens another paper's "Bilingual PDF" tab
- **THEN** the same display SHALL be preselected (remembered per browser)

#### Scenario: Not default
- **WHEN** a paper with a finished translation is opened
- **THEN** "PDF" SHALL remain the default selected tab
