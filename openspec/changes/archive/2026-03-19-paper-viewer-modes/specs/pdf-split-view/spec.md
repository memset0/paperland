## MODIFIED Requirements

### Requirement: Split-view paper detail
The paper detail page SHALL have a two-pane layout: a multi-mode viewer panel on the left (replacing the previous PDF-only viewer), paper info and Q&A on the right.

#### Scenario: Viewer panel displayed
- **WHEN** a paper has at least one available viewing mode (pdf_path or arxiv_id)
- **THEN** the left pane SHALL render the `PaperViewerPanel` component with tab-based mode switching

#### Scenario: No viewer content available
- **WHEN** a paper has neither pdf_path nor arxiv_id
- **THEN** the left pane SHALL show a placeholder message

#### Scenario: PDF displayed
- **WHEN** a paper has a pdf_path and the "PDF 原文" tab is selected
- **THEN** the PDF SHALL be rendered in the left pane via the existing PdfViewer component
