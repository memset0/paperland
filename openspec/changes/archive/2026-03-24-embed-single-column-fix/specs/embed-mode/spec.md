## ADDED Requirements

### Requirement: Force single-column layout in embed mode
In embed mode, the PaperDetail page SHALL always render in single-column layout, regardless of viewport width. The dual-column split view (PDF viewer + info panel) SHALL NOT be available in embed mode.

#### Scenario: Wide viewport in embed mode uses single-column
- **WHEN** embed mode is active and the viewport width is >= 900px
- **THEN** the PaperDetail page SHALL render in single-column layout (no split view, no draggable divider)

#### Scenario: Narrow viewport in embed mode uses single-column
- **WHEN** embed mode is active and the viewport width is < 900px
- **THEN** the PaperDetail page SHALL render in single-column layout (same as current narrow behavior)

#### Scenario: Normal mode split view unaffected
- **WHEN** embed mode is NOT active and the viewport width is >= 900px
- **THEN** the PaperDetail page SHALL render in dual-column split view as before
