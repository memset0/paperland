## ADDED Requirements

### Requirement: Whole-document floating editor window
The system SHALL provide a **whole-document** floating editor window — one per paper, keyed distinctly from the per-section windows — that edits the entire note `body`. It SHALL reuse the floating-window chrome (drag / resize / stacking / size memory) and the three display modes (editor / split / preview), and its edits SHALL write through to the shared document (see the `notes-shared-editing` capability). Unlike a section window it SHALL edit the whole document directly: it SHALL NOT demote headings to bold and SHALL NOT be scoped to a single section's leaf content. It is a whole-document editing context and SHALL be mutually exclusive with the left panel's edit/split mode and with section windows — opening it SHALL close all open section windows and lock the left panel to render mode; entering the left panel's edit/split mode, or opening a section window, SHALL close it. Re-opening an already-open whole-document window SHALL focus the existing one.

#### Scenario: Edit the whole document in a floating window
- **WHEN** the user opens the whole-document floating editor
- **THEN** a floating window SHALL appear editing the entire note `body`, with the three view modes, writing through to the shared document

#### Scenario: Headings are not demoted in the whole-document editor
- **WHEN** the user types a Markdown heading in the whole-document editor
- **THEN** it SHALL be kept as a heading (NOT demoted to bold), unlike a section window

#### Scenario: Opening closes section windows and locks the left panel
- **WHEN** the whole-document floating editor opens
- **THEN** all open section windows SHALL close and the left panel SHALL lock to render mode

#### Scenario: Entering left edit/split closes the whole-document editor
- **WHEN** the whole-document editor is open and the user switches the left panel into edit or split mode (or opens a section window)
- **THEN** the whole-document floating editor SHALL close

#### Scenario: One whole-document window per paper
- **WHEN** the user opens the whole-document editor while it is already open
- **THEN** the existing window SHALL be focused rather than a second one opened
