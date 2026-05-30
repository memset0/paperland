## ADDED Requirements

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
