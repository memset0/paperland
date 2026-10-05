# note-editor-window Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.
## Requirements
### Requirement: Floating Markdown editor window
A note section SHALL be edited in a floating Markdown editor window that is bound to exactly one heading's **leaf content** — the text from that heading up to the next heading — or, for the center node, the document **preamble** (text before the first heading). On mobile the window SHALL open as a fullscreen overlay; on desktop it SHALL open as a small floating window that can be freely moved (dragged) and resized, positioned by default near the node/heading that launched it and floating above the page, and SHALL position to the corresponding section. The window SHALL render Markdown editing and preview entirely on the frontend, reusing `MarkdownContent` for preview. The window SHALL NOT keep a private editable copy of the document; its edits SHALL write through to the single shared document (see the `notes-shared-editing` capability).

#### Scenario: Edit a section in a floating window
- **WHEN** an authenticated user opens a section for editing on desktop
- **THEN** a floating window SHALL appear near the launching heading that can be dragged and resized, scoped to that section's leaf content

#### Scenario: Mobile uses a fullscreen window
- **WHEN** a user opens a section for editing on a mobile/touch device
- **THEN** the editor SHALL open as a fullscreen overlay

#### Scenario: Window edits one section only
- **WHEN** a floating window is open for a section
- **THEN** it SHALL edit only that section's leaf content and SHALL NOT reach into child sections

### Requirement: Window title shows the edited content
The window SHALL display, at its top, the heading text of the section being edited, or a `(root)` / preamble label when editing the center node's preamble.

#### Scenario: Title bar reflects the section heading
- **WHEN** a floating editor window is open for a section headed "Scaled Dot-Product"
- **THEN** the window's title bar SHALL show "Scaled Dot-Product"

#### Scenario: Title bar shows a preamble label for the center node
- **WHEN** a floating editor window is open for the center node's preamble
- **THEN** the window's title bar SHALL show a `(root)` / preamble label

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
The page SHALL allow multiple floating editor windows to be open at once. The most recently clicked window SHALL be brought to and kept at the top of the stacking order. Opening the editor for a section that already has an open window SHALL focus the existing window rather than open a second one, so no two windows edit the same section.

#### Scenario: Multiple windows coexist
- **WHEN** a user opens editor windows for two different sections
- **THEN** both windows SHALL remain open simultaneously

#### Scenario: Last-clicked window is on top
- **WHEN** the user clicks a window that is behind another
- **THEN** the clicked window SHALL move to the top of the stack

#### Scenario: Re-opening a section focuses its existing window
- **WHEN** a user opens the editor for a section that already has an open window
- **THEN** the existing window SHALL be focused and no second window SHALL open for that section

### Requirement: Reliable autosave
Edits in a floating window SHALL write through to the shared document immediately (no private window buffer); the shared document SHALL autosave with a debounce AND SHALL also commit when a field loses focus (or Enter is pressed) and when the window is closed — so an edit made shortly before moving on is not lost. Write-through SHALL NOT fire during an IME composition; it SHALL apply once the composition ends.

#### Scenario: Closing the window does not lose a pending edit
- **WHEN** a user edits a section and closes the window before the debounce elapses
- **THEN** the edit SHALL already be reflected in the shared document and SHALL be persisted

#### Scenario: Leaving a field commits its edit
- **WHEN** a user edits and moves focus away or presses Enter
- **THEN** the edit SHALL be committed immediately without waiting for the debounce

#### Scenario: IME composition is not interrupted
- **WHEN** a user composes text with an IME (e.g. Chinese pinyin)
- **THEN** write-through SHALL NOT fire mid-composition and the field SHALL NOT revert

### Requirement: Floating window cannot create headings
A floating window SHALL only edit leaf content and SHALL NOT introduce document structure. Any Markdown heading line (a line beginning with one or more `#` followed by a space) typed in a floating window SHALL be normalized to bold text when written through to the shared document, so a window can never add, remove, or change a heading. The window SHALL make this normalization visible to the user.

#### Scenario: Typed heading is demoted to bold
- **WHEN** a user types a Markdown heading line inside a floating window
- **THEN** on write-through it SHALL be normalized to bold text rather than persisted as a heading

#### Scenario: Window never changes structure
- **WHEN** any content is edited within a floating window
- **THEN** the document's heading structure SHALL remain unchanged

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

