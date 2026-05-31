## ADDED Requirements

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
