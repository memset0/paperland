## MODIFIED Requirements

### Requirement: Branching mind-map view of small notes
The note document of a (user, paper) SHALL be presented as a branching mind-map derived from its **heading structure** — an automatically laid-out hierarchical node view where parent/child relationships are shown as connected nodes (not a left-indented outline, and not a free-placement infinite canvas). Each Markdown heading SHALL become a node; hierarchy SHALL follow relative heading depth (the shallowest heading level present is the top level, and each additional `#` nests one level deeper); sibling order SHALL follow document order. Each node SHALL display its heading text. A node whose section **leaf body** — the text from its heading up to the next heading — is non-empty after trimming SHALL additionally display a small grey, parenthesised character count of that leaf body next to its heading text (e.g. `(123)`); a node with an empty leaf body SHALL NOT display a count.

#### Scenario: Headings render as a branching map
- **WHEN** an authenticated user views a paper's note
- **THEN** the document's headings SHALL render as a branching mind-map with parent/child nodes connected by relative heading depth, each node showing its heading text

#### Scenario: Node shows heading text only
- **WHEN** a node is displayed in the mind-map
- **THEN** it SHALL show the heading text and SHALL NOT inline the section's full body

#### Scenario: Non-empty node shows a character count
- **WHEN** a node's section leaf body is non-empty
- **THEN** the node SHALL display, next to its heading text, a grey parenthesised count of the characters in that leaf body

#### Scenario: Empty node shows no character count
- **WHEN** a node's section leaf body is empty
- **THEN** the node SHALL NOT display any character-count badge

### Requirement: Open a note's editor from its node
Clicking a mind-map node SHALL open a floating editor window bound to that heading's **leaf content** only (see the `note-editor-window` and `notes-shared-editing` capabilities).

#### Scenario: Click a node to edit its leaf content
- **WHEN** a user clicks a mind-map node
- **THEN** the system SHALL open a floating editor window editing that heading's leaf content (the text up to the next heading)

### Requirement: Drag to reparent and reorder in the mind-map
The mind-map SHALL support dragging a node to change its parent and sibling order, realized as a **heading rewrite** on the single document: the dragged section's heading level is adjusted and its lines — together with its descendant sections — are moved to the new position. The center node SHALL NOT be draggable. Dropping a node onto another node SHALL nest it under that node (its heading level set one deeper than the target); dropping a node onto empty canvas SHALL move it to the top level. Adding child/sibling nodes (inserting a new heading), renaming a node (editing its heading text — a structural edit, since floating windows cannot change headings), and deleting a node (removing its heading and its subtree, with a confirmation showing how many descendant sections will be removed) SHALL be available from the mind-map. Dragging SHALL work on both pointer (mouse) and touch devices; a press that does not move beyond a small threshold SHALL be treated as a tap (open the editor) rather than a drag. Every such structural operation SHALL be treated as a structural change that closes open floating windows (see the `notes-shared-editing` capability). A structural operation that cannot be applied (e.g. it would create a cycle) SHALL leave the document unchanged.

#### Scenario: Drag a node under a new parent
- **WHEN** a user drags a node onto another node
- **THEN** the dragged section's heading SHALL be re-leveled and moved to nest under the drop target

#### Scenario: Drop on empty canvas moves to top level
- **WHEN** a user drags a node onto empty canvas
- **THEN** the dragged section SHALL be moved to the top level of the document

#### Scenario: Drag works on touch devices
- **WHEN** a user drags a node on a touch device
- **THEN** the reparent SHALL behave the same as with a mouse, and a tap (no drag) SHALL open the editor instead of moving nodes

#### Scenario: Structural operation closes floating windows
- **WHEN** a user drags, adds, or deletes a node
- **THEN** all open floating section windows SHALL close

#### Scenario: Delete confirms descendant count
- **WHEN** a user deletes a node that has descendants
- **THEN** the system SHALL confirm the deletion and indicate how many descendant sections will also be removed

#### Scenario: Rename a node
- **WHEN** a user renames a node from the mind-map
- **THEN** the node's heading text SHALL be rewritten in the document (a structural edit that closes open floating windows)

#### Scenario: Invalid operation leaves the document unchanged
- **WHEN** a structural operation cannot be applied (e.g. it would create a cycle)
- **THEN** the document SHALL be left unchanged

### Requirement: Mind-map count reflects non-empty notes
The count shown in the mind-map header SHALL be the number of nodes — heading sections plus the center/preamble — whose section leaf body is non-empty after trimming whitespace, not the raw number of nodes.

#### Scenario: Empty document counts as zero
- **WHEN** the mind-map shows only an empty center node
- **THEN** the header count SHALL be 0

#### Scenario: Only sections with content are counted
- **WHEN** the document has an empty preamble and two headings whose leaf bodies are non-empty
- **THEN** the header count SHALL be 2

## ADDED Requirements

### Requirement: Root center node
The mind-map SHALL always render a single center node labeled `(root)`, even when the document is empty. The center node SHALL represent the document **preamble** — any text before the first heading. All headings SHALL appear as descendants of the center node by relative depth. Clicking the center node SHALL open a floating editor for the preamble (creating the note row lazily on first content). The center node SHALL NOT be draggable, movable, or deletable.

#### Scenario: Center node always present
- **WHEN** an authenticated user opens a paper's note, even with no content yet
- **THEN** the mind-map SHALL show a single center node labeled `(root)`

#### Scenario: Edit the preamble from the center node
- **WHEN** the user clicks the center node
- **THEN** the system SHALL open a floating editor for the preamble, persisting the note row lazily once content is written

#### Scenario: Center node cannot be moved or deleted
- **WHEN** the user attempts to drag or delete the center node
- **THEN** the system SHALL NOT move or delete it

### Requirement: Undo structural edits
The mind-map SHALL maintain a front-end-only undo history of structural edits (drag, add, delete). An Undo control SHALL restore the document to its state before the most recent structural edit, and SHALL support undoing successive structural edits.

#### Scenario: Undo a wrong move
- **WHEN** a user drags a node to the wrong place and then activates Undo
- **THEN** the document SHALL return to its arrangement before that move

#### Scenario: Undo successive edits
- **WHEN** a user performs several structural edits and activates Undo repeatedly
- **THEN** each Undo SHALL revert the most recent remaining structural edit in turn

## REMOVED Requirements

### Requirement: Undo drag moves
**Reason**: Drag moves are now document heading rewrites, and add/delete are structural edits too; the undo history generalizes to all structural edits.
**Migration**: Replaced by "Undo structural edits".

### Requirement: Root note is the mind-map center
**Reason**: There is no root note row; the mind-map center now represents the paper and the document preamble.
**Migration**: Replaced by "Root center node"; the former root body becomes the document preamble edited from the center node.
