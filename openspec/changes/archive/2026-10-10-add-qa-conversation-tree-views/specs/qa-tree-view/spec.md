## ADDED Requirements

### Requirement: Q&A tree view in a floating window
The paper page SHALL offer a Q&A tree that opens in a floating window without changing the Q&A list. The tree SHALL be a mind map of the paper's visible Q&As (respecting the current mine/all scope). Root nodes SHALL be entries without a visible parent; a follow-up SHALL be drawn under its parent question regardless of which of the parent's answers it continued. Each node SHALL show the question (template prompt for preset Q&A), its status, and its `QA-<id>`. The window SHALL be movable and resizable, SHALL coexist with other floating windows, and SHALL close when the user leaves the paper.

#### Scenario: Open the tree
- **WHEN** the user clicks the Q&A tree button in the Q&A list header
- **THEN** a floating window shows the tree and the Q&A list underneath stays as it was

#### Scenario: Children bound to the parent question
- **WHEN** question A has answers A1 and A2, follow-up B continues A1 and follow-up C continues A2
- **THEN** the tree shows B and C as siblings directly under A

#### Scenario: Parent not visible
- **WHEN** a follow-up's parent entry is not in the current scope
- **THEN** the follow-up is shown as a root node

### Requirement: Tree nodes open threads
Clicking a tree node SHALL open that question's thread in the conversation view, ending at the question's preferred answer (the pinned model's answer if any, else the most recently requested one). Where the conversation view is unavailable, clicking SHALL reveal the entry in the list instead.

#### Scenario: Click a node on a wide screen
- **WHEN** the user clicks follow-up node B in the tree
- **THEN** the conversation view opens on B's thread

### Requirement: Floating windows share one mechanism
All floating windows of the app — note editor windows, the Q&A tree window, and the floating question box — SHALL be implemented by one shared window mechanism: the same window shell (move, bottom-right resize, fullscreen on mobile) and one shared stacking order in which the most recently pressed window is on top. Any number of these windows SHALL be able to be open at the same time. Per-kind differences (title bar vs. bare card, remembered size vs. fresh geometry) SHALL be options of the shared shell, not separate implementations.

#### Scenario: Several windows at once
- **WHEN** the user opens the question box, the Q&A tree, and a note window
- **THEN** all three are open together and pressing one brings it to the front

#### Scenario: Same behaviour everywhere
- **WHEN** the user drags or resizes any of these windows on desktop
- **THEN** they move and resize the same way (bare question box: drag empty areas; titled windows: drag the title bar)
