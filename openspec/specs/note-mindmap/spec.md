# note-mindmap Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.
## Requirements
### Requirement: Branching mind-map view of small notes
The small notes of a (user, paper) SHALL be presented as a branching mind-map — an automatically laid-out hierarchical node view where parent/child relationships are shown as connected nodes (not a left-indented outline, and not a free-placement infinite canvas). Each node SHALL display the note's title. A node whose `body` is non-empty SHALL additionally display a small grey, parenthesised character count of its body (e.g. `(123)`) next to the title; a node with an empty body SHALL NOT display a count.

#### Scenario: Tree renders as a branching map
- **WHEN** an authenticated user views a paper's small notes
- **THEN** the notes SHALL render as a branching mind-map with parent/child nodes connected, each node showing its title

#### Scenario: Node shows title only
- **WHEN** a node is displayed in the mind-map
- **THEN** it SHALL show the note's title and SHALL NOT inline the full body

#### Scenario: Non-empty node shows a character count
- **WHEN** a node's body is non-empty
- **THEN** the node SHALL display, next to its title, a grey parenthesised count of the number of characters in its body

#### Scenario: Empty node shows no character count
- **WHEN** a node's body is empty
- **THEN** the node SHALL NOT display any character-count badge

### Requirement: Open a note's editor from its node
Clicking a mind-map node SHALL open that note's floating editor window (see the `note-editor-window` capability).

#### Scenario: Click a node to edit
- **WHEN** a user clicks a mind-map node
- **THEN** the system SHALL open a floating editor window for that note

### Requirement: Drag to reparent and reorder in the mind-map
The mind-map SHALL support dragging a `note` node to change its parent and sibling order, committing the change via the move endpoint, with optimistic update and rollback on failure. The root note SHALL NOT be draggable. Dropping a node onto another node SHALL reparent it under that node; dropping a node onto empty canvas SHALL reparent it directly under the root note (there is no separate parentless top level). Dragging SHALL work on both pointer (mouse) and touch devices; a press that does not move beyond a small threshold SHALL be treated as a tap (open the editor) rather than a drag. Adding child/sibling nodes and deleting a node (with a confirmation showing how many descendants will be removed) SHALL be available from the mind-map, except the root note SHALL NOT be deletable.

#### Scenario: Drag a node under a new parent
- **WHEN** a user drags a node onto another node
- **THEN** the dragged node SHALL be reparented under the drop target via the move endpoint

#### Scenario: Drop on empty canvas reparents under the root
- **WHEN** a user drags a node onto empty canvas
- **THEN** the dragged node SHALL be reparented directly under the root note (not made parentless)

#### Scenario: Drag works on touch devices
- **WHEN** a user drags a node on a touch device
- **THEN** the reparent SHALL behave the same as with a mouse, and a tap (no drag) SHALL open the editor instead of creating or moving nodes

#### Scenario: Rolled back on move failure
- **WHEN** a move is rejected by the server (e.g. it would create a cycle)
- **THEN** the mind-map SHALL revert to the pre-drag arrangement

#### Scenario: Delete confirms descendant count
- **WHEN** a user deletes a node that has descendants
- **THEN** the system SHALL confirm the deletion and indicate how many descendant notes will also be removed

### Requirement: Undo drag moves
The mind-map SHALL maintain a front-end-only undo history of drag moves. An Undo control SHALL restore the most recent move to its previous parent and order, and SHALL support undoing successive moves. Creating a new note SHALL clear this history.

#### Scenario: Undo a wrong move
- **WHEN** a user drags a node to the wrong place and then activates Undo
- **THEN** the node SHALL return to its previous parent and position

#### Scenario: Creating a note clears the undo history
- **WHEN** a user creates a new note
- **THEN** the move-undo history SHALL be cleared

### Requirement: Root note is the mind-map center
The mind-map SHALL always render the (user, paper) root note as its single center node, even when no root row is yet persisted — in that case it SHALL render an empty placeholder root. All other notes SHALL appear as descendants of the center node. Clicking the center node SHALL open the root note's floating editor (creating the root note lazily on first content). The root note SHALL NOT be draggable, movable, or deletable.

#### Scenario: Center root node always present
- **WHEN** an authenticated user opens a paper's notes, even with no notes yet
- **THEN** the mind-map SHALL show a single center root node (an empty placeholder if not yet persisted)

#### Scenario: Edit the root from its center node
- **WHEN** the user clicks the center root node
- **THEN** the system SHALL open the root note's editor, persisting the root note lazily once content is written

#### Scenario: Root node cannot be moved or deleted
- **WHEN** the user attempts to drag or delete the center root node
- **THEN** the system SHALL NOT move or delete it

### Requirement: Mind-map count reflects non-empty notes
The count shown in the mind-map header SHALL be the number of notes (including the root note) whose `body` is non-empty after trimming whitespace, not the raw number of nodes.

#### Scenario: Empty placeholder root counts as zero
- **WHEN** the mind-map shows only an empty root node
- **THEN** the header count SHALL be 0

#### Scenario: Only notes with content are counted
- **WHEN** the mind-map shows an empty root and two child nodes with non-empty bodies
- **THEN** the header count SHALL be 2

