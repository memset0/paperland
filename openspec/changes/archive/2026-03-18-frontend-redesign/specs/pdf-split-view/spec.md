## ADDED Requirements

### Requirement: Split-view paper detail
The paper detail page SHALL have a two-pane layout: PDF viewer on the left, paper info and Q&A on the right.

#### Scenario: PDF displayed
- **WHEN** a paper has a pdf_path
- **THEN** the PDF SHALL be rendered in the left pane using pdfjs-dist

#### Scenario: No PDF available
- **WHEN** a paper has no pdf_path
- **THEN** the left pane SHALL show a placeholder message

### Requirement: Draggable divider
The split-view SHALL have a draggable divider between the two panes to adjust their widths.

#### Scenario: Resize panes
- **WHEN** the user drags the divider
- **THEN** the left and right pane widths SHALL adjust accordingly

### Requirement: Q&A in right pane
The right pane SHALL contain paper metadata at the top, followed by template Q&A results, then free Q&A with a floating input area at the bottom.

#### Scenario: Q&A visible
- **WHEN** the user views a paper detail
- **THEN** template Q&A and free Q&A sections SHALL be visible in the right pane
