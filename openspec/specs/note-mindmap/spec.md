# note-mindmap Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.
## Requirements
### Requirement: Branching mind-map view of small notes
The small notes of a (user, paper) SHALL be presented as a branching mind-map — an automatically laid-out hierarchical node view where parent/child relationships are shown as connected nodes (not a left-indented outline, and not a free-placement infinite canvas). Each node SHALL display only the note's title.

#### Scenario: Tree renders as a branching map
- **WHEN** an authenticated user views a paper's small notes
- **THEN** the notes SHALL render as a branching mind-map with parent/child nodes connected, each node showing only its title

#### Scenario: Node shows title only
- **WHEN** a node is displayed in the mind-map
- **THEN** it SHALL show the note's title and SHALL NOT inline the full body

### Requirement: Open a note's editor from its node
Clicking a mind-map node SHALL open that note's floating editor window (see the `note-editor-window` capability).

#### Scenario: Click a node to edit
- **WHEN** a user clicks a mind-map node
- **THEN** the system SHALL open a floating editor window for that note

### Requirement: Drag to reparent and reorder in the mind-map
The mind-map SHALL support dragging a node to change its parent and sibling order, committing the change via the move endpoint, with optimistic update and rollback on failure. Dragging SHALL work on both pointer (mouse) and touch devices; a press that does not move beyond a small threshold SHALL be treated as a tap (open the editor) rather than a drag. Adding child/sibling nodes and deleting a node (with a confirmation showing how many descendants will be removed) SHALL be available from the mind-map.

#### Scenario: Drag a node under a new parent
- **WHEN** a user drags a node onto another node
- **THEN** the dragged node SHALL be reparented under the drop target via the move endpoint

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

