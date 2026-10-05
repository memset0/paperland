## MODIFIED Requirements

### Requirement: Three left-panel modes
The left-panel note view SHALL provide three modes — **edit**, **split**, and **render** — switchable by the user, defaulting to **render**. Edit mode SHALL show a Markdown text editor over the whole document; render mode SHALL show only the reading-oriented rendering; split mode SHALL show the editor and the rendering side by side. Entering edit or split mode SHALL close all floating section windows (see the `notes-shared-editing` capability). **While the whole-document floating editor is open (see the `note-editor-window` capability), the panel SHALL be locked to render mode and mode switching SHALL be disabled**, so the page never has two active whole-note editors. All mode switching SHALL be handled on the frontend. The panel header SHALL show the mode switcher at its top-right and, when the note has been persisted, the note's last-updated time at its top-left (e.g. "Last updated at: …", reflecting the most recent successful save).

#### Scenario: Default mode is render
- **WHEN** an authenticated user opens a paper's note
- **THEN** the left panel SHALL default to render mode showing the reading-oriented document

#### Scenario: Switch to edit mode
- **WHEN** the user switches the left panel to edit mode
- **THEN** the panel SHALL show a Markdown text editor over the whole document

#### Scenario: Switch to split mode
- **WHEN** the user switches the left panel to split mode
- **THEN** the panel SHALL show the whole-document editor and its rendering side by side

#### Scenario: Entering edit or split closes floating windows
- **WHEN** the user switches the left panel to edit or split mode
- **THEN** all open floating section windows SHALL close

#### Scenario: Locked to render while the whole-document editor is open
- **WHEN** the whole-document floating editor is open
- **THEN** the left panel SHALL be in render mode and its edit/split mode switching SHALL be disabled

#### Scenario: Header shows the last-updated time
- **WHEN** the note has been persisted at least once
- **THEN** the panel header SHALL display the note's last-updated time at its top-left

## ADDED Requirements

### Requirement: Open the whole-document editor from the mode bar
The left-panel note view's mode bar SHALL include a control to open the **whole-document floating editor** (see the `note-editor-window` capability). Activating it SHALL open that floating editor (and, per the shared-editing model, lock this panel to render).

#### Scenario: Pop out to the floating editor
- **WHEN** the user activates the "open in floating window" control in the mode bar
- **THEN** the whole-document floating editor SHALL open and the left panel SHALL lock to render
