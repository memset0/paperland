# paper-viewer-modes Specification

## Purpose
Multi-mode paper viewing in the detail page left panel, supporting PDF and translation iframe modes with tab-based switching.

## Requirements

### Requirement: Multi-mode viewer in wide layout
The paper detail page left panel SHALL support multiple viewing modes via a tab bar. Each mode renders different content in the same viewer area.

#### Scenario: PDF mode displayed
- **WHEN** a paper has a `pdf_path`
- **THEN** the viewer SHALL show a "PDF 原文" tab that renders the PDF in an iframe (existing PdfViewer behavior)

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
