## MODIFIED Requirements

### Requirement: Floating Markdown editor window
All notes — including the root note — SHALL be edited in a floating Markdown editor window. On mobile the window SHALL open as a fullscreen overlay; on desktop it SHALL open as a small floating window that can be freely moved (dragged) and resized, positioned by default below the note that launched it and floating above the page. The window SHALL render markdown editing and preview entirely on the frontend, reusing `MarkdownContent` for preview and the debounced autosave + Ctrl+S behavior.

#### Scenario: Edit a note in a floating window
- **WHEN** an authenticated user opens a note for editing on desktop
- **THEN** a floating window SHALL appear (by default below the note) that can be dragged and resized

#### Scenario: Mobile uses a fullscreen window
- **WHEN** a user opens a note for editing on a mobile/touch device
- **THEN** the editor SHALL open as a fullscreen overlay

#### Scenario: Root note uses the same window
- **WHEN** a user opens the root note for editing
- **THEN** it SHALL open in the same floating-window editor used by every other note

### Requirement: Window title shows the edited content
The window SHALL display, at its top, the title of the content being edited (a note's title, or a root-note label when editing the root note).

#### Scenario: Title bar reflects the note
- **WHEN** a floating editor window is open for a note titled "Scaled Dot-Product"
- **THEN** the window's title bar SHALL show "Scaled Dot-Product"

#### Scenario: Title bar shows a root label for the root note
- **WHEN** a floating editor window is open for the root note
- **THEN** the window's title bar SHALL show a root-note label
