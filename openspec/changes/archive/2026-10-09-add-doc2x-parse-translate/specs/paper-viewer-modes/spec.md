## ADDED Requirements

### Requirement: Doc2X translation viewer mode
When doc2x is enabled and the paper has a `pdf_path`, the viewer SHALL show a "对照翻译" tab after "PDF 原文". The tab SHALL show the doc2x parse status and reflect the translation status:
- `idle`: a "开始翻译" button that requests translation;
- `queued`: a message that translation is waiting for the doc2x parse;
- `pending`/`running`: an in-progress indicator, refreshed by polling until a terminal state;
- `failed`: the error and a "重试" button;
- `done`: the translated PDF in the embedded pdf.js viewer, with a toggle between "左右对照" (the bilingual PDF) and "仅译文" (the translation-only PDF).
The "对照翻译" tab SHALL NOT be auto-selected as the default mode.

#### Scenario: Request translation from the tab
- **WHEN** the user clicks "开始翻译" in the "对照翻译" tab
- **THEN** a translation request SHALL be sent and the tab SHALL show the queued or in-progress state

#### Scenario: Switch display
- **WHEN** translation is done and the user selects "仅译文"
- **THEN** the viewer SHALL display the translation-only PDF, and selecting "左右对照" SHALL display the bilingual PDF

#### Scenario: Display choice remembered
- **WHEN** the user picks a display and later opens another paper's "对照翻译" tab
- **THEN** the same display SHALL be preselected (remembered per browser)

#### Scenario: Not default
- **WHEN** a paper with a finished translation is opened
- **THEN** "PDF 原文" SHALL remain the default selected tab
