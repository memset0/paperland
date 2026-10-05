## MODIFIED Requirements

### Requirement: Walkthrough viewer mode
The paper detail left panel viewer SHALL offer a note mode (labeled **"Note"**) that renders the current paper's single note document (see the `notes-walkthrough` capability). The mode SHALL **always be available** — regardless of whether the note has content — and SHALL participate in the existing data-driven mode system (tab bar, switching, auto-select) without special-casing.

#### Scenario: Note tab always displayed
- **WHEN** a paper detail page is open
- **THEN** the viewer SHALL show a "Note" tab whether or not the note has content

#### Scenario: Note tab switches like other modes
- **WHEN** the user selects the "Note" tab
- **THEN** the viewer content SHALL switch to the note document view immediately, consistent with switching between the PDF and translation modes

#### Scenario: Note view updates live
- **WHEN** the user is viewing the "Note" tab and edits the note
- **THEN** the rendered note SHALL update automatically without leaving or re-selecting the tab
