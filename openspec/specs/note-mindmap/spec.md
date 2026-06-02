# note-mindmap Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.
## Requirements
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

### Requirement: Content nodes from leading blockquotes
The mind-map SHALL derive read-only **content nodes** from the leading blockquotes of each node's content block. A node's content block is the document **preamble** for the center node, or the **leaf body** for a heading node. Scanning the content block from its start (ignoring leading blank lines, respecting fenced code blocks), each maximal run of consecutive `>`-prefixed lines that appears **before** the first non-blank, non-blockquote line SHALL become one content node, in document order. A content node SHALL render its blockquote's inner Markdown (the leading `> ` stripped) using the project's Markdown renderer, so plain text, images, and formulas all display. Content nodes SHALL be attached to their node and SHALL be ordered **before** that node's heading children.

#### Scenario: A leading blockquote becomes a content node
- **WHEN** a node's content block begins with a blockquote
- **THEN** the mind-map SHALL show a content node rendering that blockquote's content, attached to the node

#### Scenario: Multiple consecutive blockquotes become multiple content nodes
- **WHEN** a node's content block begins with several consecutive blockquote blocks (separated by blank lines)
- **THEN** the mind-map SHALL show one content node per blockquote block, in order

#### Scenario: Content nodes precede heading children
- **WHEN** a node has both leading-blockquote content nodes and heading children
- **THEN** the content nodes SHALL be displayed before the heading children

#### Scenario: Only leading blockquotes count
- **WHEN** a blockquote appears after non-blockquote content in a node's content block
- **THEN** it SHALL NOT become a content node (it remains ordinary rendered Markdown in the section body)

#### Scenario: Rich content renders
- **WHEN** a leading blockquote contains an image or a formula
- **THEN** the content node SHALL render the image or formula (not raw Markdown)

### Requirement: Content nodes are read-only and visually distinct
Content nodes SHALL NOT be interactive: they SHALL NOT open an editor on click, SHALL NOT be draggable, and SHALL NOT offer add / rename / delete actions. Content nodes SHALL be visually distinguished from heading nodes: a heading/center node SHALL keep a full border, while a content node SHALL render with only a **bottom-half border** (the lower portion of the left and right edges with rounded bottom corners plus the bottom edge), its content sitting above that border. The connector line drawn from a parent to a content node SHALL be **as thin as the node border** — thinner than the connector drawn to a heading node.

#### Scenario: Content node is not clickable or editable
- **WHEN** a user clicks or tries to drag a content node
- **THEN** no editor SHALL open and the node SHALL NOT move, and no action menu SHALL appear

#### Scenario: Content node has the bottom-half border style
- **WHEN** a content node is displayed
- **THEN** it SHALL render with the bottom-half-border style, distinct from the full border of heading/center nodes

#### Scenario: Connector to a content node is thinner
- **WHEN** a connector is drawn to a content node
- **THEN** its stroke SHALL be as thin as the node border, thinner than a connector drawn to a heading node

### Requirement: Node actions in a tooltip below the node
The per-node actions (add child, add sibling, rename, delete — the center node offers only add child) SHALL NOT be shown inline within the node. Instead they SHALL appear in a tooltip positioned **directly below** the node. The reveal and the node-tap behavior SHALL differ by device:

- **Hover-capable (desktop)**: hovering a node SHALL reveal the tooltip; it SHALL remain open while the pointer is over either the node or the tooltip (so the user can move into it to click an action) and SHALL dismiss when neither is hovered. **Clicking the node body SHALL open its floating editor** (unchanged).
- **Touch (no hover)**: to avoid mis-taps, **tapping a node SHALL reveal the tooltip instead of opening the editor**. The touch tooltip SHALL additionally include an **Edit** action that opens the floating editor. The tooltip SHALL dismiss on an outside tap (or when an action is chosen).

#### Scenario: Actions are hidden until revealed
- **WHEN** a node is shown and not hovered (desktop) / not tapped (touch)
- **THEN** its action buttons SHALL NOT be visible inline in the node

#### Scenario: Hover reveals the tooltip and click edits (desktop)
- **WHEN** on a hover-capable device the user hovers a node, then clicks the node body
- **THEN** the tooltip SHALL appear directly below the node, and clicking the node SHALL open its floating editor

#### Scenario: Tooltip stays open while moving into it (desktop)
- **WHEN** the user moves the pointer from the node into the tooltip
- **THEN** the tooltip SHALL remain open so an action can be clicked

#### Scenario: Tap reveals the tooltip on touch (no direct edit)
- **WHEN** on a touch device (no hover) the user taps a node
- **THEN** the tooltip SHALL appear directly below the node and the editor SHALL NOT open directly; the tooltip SHALL include an Edit action to open the editor

#### Scenario: Tooltip dismisses
- **WHEN** the pointer leaves both the node and its tooltip (desktop) or the user taps outside / chooses an action (touch)
- **THEN** the tooltip SHALL dismiss

### Requirement: Node width and heading text wrapping

Mind-map nodes SHALL have a bounded maximum width that is comfortably wide for typical headings. When a heading or center node's text exceeds that maximum width, the text SHALL wrap onto multiple lines and be shown in **full**; it SHALL NOT be truncated with an ellipsis (`…`). Very long unbroken tokens (e.g. a URL with no spaces) SHALL also wrap within the node's maximum width rather than overflow it. The grey parenthesised character-count badge SHALL remain beside the heading text when the heading wraps. Connectors drawn to a node SHALL remain correctly anchored when the node grows taller because its text wrapped.

#### Scenario: Long heading wraps and shows full text

- **WHEN** a heading node's text is longer than the node's maximum width
- **THEN** the text SHALL wrap onto multiple lines and the full heading SHALL be visible, with no ellipsis truncation

#### Scenario: Short heading stays on a single line

- **WHEN** a heading node's text fits within the node's maximum width
- **THEN** it SHALL render on a single line as before

#### Scenario: Character count stays beside a wrapped heading

- **WHEN** a heading node whose leaf body is non-empty has text that wraps onto multiple lines
- **THEN** the grey parenthesised character-count badge SHALL still be displayed beside the heading text

#### Scenario: Connector stays anchored to a taller node

- **WHEN** a node becomes taller because its heading wrapped onto multiple lines
- **THEN** the connector from its parent SHALL remain correctly anchored to the node

