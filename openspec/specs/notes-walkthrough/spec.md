# notes-walkthrough Specification

## Purpose

Render a paper's small-notes tree as a single continuous, reading-oriented "walkthrough" document in the paper-detail left panel. The notes are concatenated in mind-map traversal order, their headings are re-leveled by tree depth and auto-numbered to form a coherent outline, clicking a heading opens the underlying note's editor, text-highlighting is disabled to keep a clean reading surface, and the document live-updates as the notes or mind-map structure change.
## Requirements
### Requirement: Render walkthrough in the left panel
Render mode SHALL be shown within the paper detail left panel, scrollable independently of the rest of the page. The document SHALL be rendered as Markdown using the project's Markdown renderer with math support; headings SHALL be rendered by the view itself, carrying their section number and a click affordance (see below).

As a reading-oriented view, render mode SHALL render body text at a compact reading size and its headings SHALL be visibly larger than the body, with a consistent decreasing scale across heading depths (including levels deeper than H3). Heading sizes SHALL be set in absolute units so they stay constant regardless of the body size. This sizing SHALL be scoped to render mode and SHALL NOT change the Markdown sizing used elsewhere (e.g. Q&A answers, paper content).

#### Scenario: Render mode renders rich Markdown
- **WHEN** render mode is shown
- **THEN** the document SHALL be rendered as formatted Markdown (lists, math, code, anchor links, etc.) rather than raw text

#### Scenario: Reading-oriented sizing
- **WHEN** render mode is displayed
- **THEN** its body text SHALL be a compact reading size and its headings SHALL be larger than the body across heading depths, while Markdown rendered elsewhere keeps its normal sizes

### Requirement: Auto-numbered headings
Every heading in render mode SHALL be prefixed with a hierarchical section number reflecting the document's heading hierarchy and order, derived at render time from the Markdown headings and independent of the heading text. Numbering SHALL start at the top heading level and form dotted numbers with a trailing dot (e.g. `1.`, `1.2.`, `1.2.3.`). The preamble SHALL NOT be numbered.

#### Scenario: Top-level numbering
- **WHEN** the document has top-level headings
- **THEN** they SHALL be numbered `1.`, `2.`, `3.`, … in document order

#### Scenario: Nested numbering with trailing dot
- **WHEN** a heading is the 3rd child of the 2nd child of the 1st top-level heading
- **THEN** it SHALL be numbered `1.2.3.` (with a trailing dot)

#### Scenario: Preamble is not numbered
- **WHEN** the document has preamble text before its first heading
- **THEN** that preamble SHALL NOT receive an outline number

### Requirement: Headings open the note editor
Because every render-mode heading corresponds to a section of the document, clicking a heading SHALL open a floating editor window bound to that section's leaf content (the same window model used by the mind-map), so the user can edit from render mode. The heading SHALL present a visible click affordance (e.g. a hover cue and an edit icon).

#### Scenario: Click a heading to edit its section
- **WHEN** a user clicks a render-mode heading
- **THEN** the system SHALL open a floating editor for that heading's section leaf content

#### Scenario: Heading shows it is interactive
- **WHEN** a user hovers a render-mode heading
- **THEN** the heading SHALL indicate it is clickable (e.g. a hover cue and an edit icon)

### Requirement: No highlighting in the walkthrough
Render mode SHALL NOT offer text-highlighting: it SHALL NOT show the selection highlight toolbar, SHALL NOT render stored highlights, and SHALL NOT show the highlight click-menu. (The highlight model is keyed by content hash, which is incompatible with render mode's render-time auto-numbered content.) Non-highlight Markdown interactions such as `paperland://` anchor links and KaTeX copy MAY still work.

#### Scenario: Selecting text shows no highlight toolbar
- **WHEN** a user selects text within render mode
- **THEN** no highlight toolbar SHALL appear and no highlight SHALL be created

#### Scenario: Stored highlights are not rendered
- **WHEN** render mode renders content that has highlights elsewhere
- **THEN** those highlights SHALL NOT be shown in render mode

### Requirement: Live re-render on note changes
Render mode SHALL update automatically, without manual refresh, whenever the document changes — whether from a floating-window leaf edit, a mind-map structural edit, or direct editing in edit/split mode.

#### Scenario: Edit updates the render
- **WHEN** a user edits the document (in a floating window or directly)
- **THEN** render mode SHALL re-render to include the updated content

#### Scenario: Structural change updates the render
- **WHEN** a user reparents, adds, or deletes a node in the mind-map
- **THEN** render mode SHALL re-render in the new structure and order

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

### Requirement: Render mode renders the single note document
Render mode SHALL render the single Markdown note document of a (user, paper) directly — there SHALL be no assembly from a note tree. The document's own Markdown headings SHALL define the section structure, and the preamble (text before the first heading) SHALL render as introductory content above the first section.

#### Scenario: Document rendered directly
- **WHEN** render mode is shown
- **THEN** the single Markdown document SHALL be rendered as-is, with structure coming from its own headings (no tree assembly)

#### Scenario: Preamble renders as intro
- **WHEN** the document has text before its first heading
- **THEN** that text SHALL render as introductory content above the first section

### Requirement: Open the whole-document editor from the mode bar
The left-panel note view's mode bar SHALL include a control to open the **whole-document floating editor** (see the `note-editor-window` capability). Activating it SHALL open that floating editor (and, per the shared-editing model, lock this panel to render).

#### Scenario: Pop out to the floating editor
- **WHEN** the user activates the "open in floating window" control in the mode bar
- **THEN** the whole-document floating editor SHALL open and the left panel SHALL lock to render

### Requirement: Help affordance in the note function bar
The left-panel note view's function bar SHALL include a help control (a "?" icon). Activating it SHALL open a help dialog about the note system. The dialog SHALL explain at least:
- **Mind-map syntax**: that Markdown headings become mind-map nodes nested by relative heading depth, that a heading's text below it is the node's content, and that a **leading blockquote** (`>`) at the start of a node's content becomes a read-only **content node** (plain text, image, or formula) — with consecutive leading blockquotes producing multiple content nodes.
- **PDF image capture**: that the PDF viewer's Crop/screenshot tool lets the user drag a region which is captured to an image, uploaded to the image host, and copied as a paste-ready Markdown image link wrapped in a `paperland://…?pdf=…` anchor.
The dialog SHALL be dismissible.

#### Scenario: Help control is present
- **WHEN** the left note panel is shown
- **THEN** its function bar SHALL include a "?" help control

#### Scenario: Opening the help dialog
- **WHEN** the user activates the help control
- **THEN** a help dialog SHALL open describing the mind-map heading/blockquote syntax and the PDF region image-capture

#### Scenario: Dismissing the help dialog
- **WHEN** the user closes the help dialog
- **THEN** it SHALL be dismissed and the note panel SHALL be unaffected

### Requirement: Completion toggle in the note function bar
The left-panel note view's function bar SHALL include a completion toggle — a button group with two states (e.g. "In progress" / "Done") — bound to the note's `completed` flag. Activating "Done" SHALL mark the note complete (via `POST /api/papers/:id/note/completed`); activating "In progress" SHALL mark it incomplete. The reflected state SHALL update on success. The toggle SHALL be available to authenticated users; marking a note with no content complete SHALL be disabled (there is nothing to complete).

#### Scenario: Mark the note done from the function bar
- **WHEN** an authenticated user with a non-empty note activates "Done" in the function bar
- **THEN** the note SHALL be marked complete and the toggle SHALL reflect the Done state

#### Scenario: Toggle back to in progress
- **WHEN** the user activates "In progress" on a completed note
- **THEN** the note SHALL be marked incomplete and the toggle SHALL reflect the In-progress state

#### Scenario: Cannot complete an empty note
- **WHEN** the note has no content
- **THEN** the "Done" control SHALL be disabled

