# note-editor-window Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.
## Requirements
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

### Requirement: Three display modes
The window SHALL support three display modes — editor only, preview only, and side-by-side (editor and preview together) — switchable by clicking, with all switching handled on the frontend.

#### Scenario: Switch to side-by-side
- **WHEN** the user switches mode to side-by-side
- **THEN** the window SHALL show the Markdown editor and its rendered preview simultaneously

#### Scenario: Switch to preview only
- **WHEN** the user switches mode to preview only
- **THEN** the window SHALL show only the rendered `MarkdownContent`, no editor

#### Scenario: Switch to editor only
- **WHEN** the user switches mode to editor only
- **THEN** the window SHALL show only the Markdown editor, no preview

### Requirement: Window size memory
The window SHALL have a default width and height, and the system SHALL remember in the browser (localStorage) the dimensions a user last resized a note window to, opening subsequent note windows at that remembered size.

#### Scenario: Default size on first open
- **WHEN** no remembered size exists and a note window opens
- **THEN** it SHALL use the default width and height

#### Scenario: Remembered size on next open
- **WHEN** a user resizes a note window and later opens another note window
- **THEN** the new window SHALL open at the last-resized width and height

### Requirement: Multiple windows with stacking
The page SHALL allow multiple floating editor windows to be open at once. The most recently clicked window SHALL be brought to and kept at the top of the stacking order.

#### Scenario: Multiple windows coexist
- **WHEN** a user opens editor windows for two different notes
- **THEN** both windows SHALL remain open simultaneously

#### Scenario: Last-clicked window is on top
- **WHEN** the user clicks a window that is behind another
- **THEN** the clicked window SHALL move to the top of the stack

### Requirement: Reliable autosave
Title and body edits SHALL autosave with a debounce, AND SHALL also commit immediately when a field loses focus (or Enter is pressed) and when the window is closed — so an edit made shortly before moving on is not lost. Autosave SHALL NOT fire during an IME composition; it SHALL save once the composition ends.

#### Scenario: Closing the window commits a pending edit
- **WHEN** a user edits a note's title or body and closes the window before the debounce elapses
- **THEN** the edit SHALL still be persisted

#### Scenario: Leaving a field commits its edit
- **WHEN** a user edits the title and moves focus away or presses Enter
- **THEN** the edit SHALL be saved immediately without waiting for the debounce

#### Scenario: IME composition is not interrupted
- **WHEN** a user composes text with an IME (e.g. Chinese pinyin)
- **THEN** autosave SHALL NOT fire mid-composition and the field SHALL NOT revert

