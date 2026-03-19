## ADDED Requirements

### Requirement: Floating input box at bottom
The QA input area SHALL be a sticky floating element at the bottom of the scrollable content area, always visible without scrolling.

#### Scenario: Floating input in split view (≥900px)
- **WHEN** the user views a paper in split view (PaperDetail, ≥900px)
- **THEN** the QA input box is sticky at the bottom of the right panel

#### Scenario: Floating input in single column (<900px)
- **WHEN** the user views a paper in single column layout (PaperDetail <900px, or QAPage)
- **THEN** the QA input box is sticky at the bottom of the scrollable page area

### Requirement: Input box design
The floating input box SHALL have a rounded design, support multi-line text, include a submit button and model selection.

#### Scenario: Multi-line input
- **WHEN** user types multiple lines of text
- **THEN** the textarea expands to accommodate the content (up to a reasonable max-height)

#### Scenario: Submit via button
- **WHEN** user clicks the submit button with non-empty text and at least one model selected
- **THEN** the question is submitted and the input field is cleared

#### Scenario: Submit via Ctrl+Enter
- **WHEN** user presses Ctrl+Enter with non-empty text
- **THEN** the question is submitted (same as clicking submit button)

### Requirement: Model selection in floating input
The floating input SHALL display model selection chips for choosing which model(s) to use.

#### Scenario: Model chip toggle
- **WHEN** user clicks a model chip
- **THEN** the model is toggled in the selection (add if not selected, remove if selected)
