## MODIFIED Requirements

### Requirement: Draggable panel divider
The system SHALL provide a draggable divider between the left and right panels. The divider SHALL use Pointer Events API with `setPointerCapture` to ensure reliable tracking during fast drag movements. The visible divider width SHALL be 2px with an invisible hit area of at least 12px for easy grabbing.

#### Scenario: Start dragging the divider
- **WHEN** user presses pointer down on the divider (or its hit area)
- **THEN** pointer capture is set on the divider element
- **AND** the cursor changes to `col-resize`
- **AND** text selection is disabled on the page

#### Scenario: Drag divider at normal speed
- **WHEN** user drags the divider at normal speed
- **THEN** the left panel width SHALL update in real-time following the pointer position
- **AND** the width SHALL be constrained between 20% and 80%

#### Scenario: Drag divider at high speed
- **WHEN** user drags the divider quickly, moving the cursor far from the divider
- **THEN** the left panel width SHALL still follow the pointer position accurately due to pointer capture
- **AND** no tracking loss SHALL occur

#### Scenario: Release divider
- **WHEN** user releases the pointer after dragging
- **THEN** pointer capture is released
- **AND** the divider returns to its default visual state
- **AND** CSS transitions for width are re-enabled

### Requirement: Divider visual appearance
The divider SHALL have a visible width of 2px with a subtle background color. On hover, the divider SHALL show a highlight color. The invisible hit area SHALL extend the clickable region to at least 12px total width.

#### Scenario: Divider default appearance
- **WHEN** the divider is in its default state
- **THEN** it SHALL display as a 2px wide vertical line with `bg-gray-300` color

#### Scenario: Divider hover appearance
- **WHEN** user hovers over the divider hit area
- **THEN** the visible divider SHALL change to `bg-indigo-400` color

#### Scenario: Divider active/dragging appearance
- **WHEN** user is actively dragging the divider
- **THEN** the visible divider SHALL change to `bg-indigo-500` color
