# panel-collapse Specification

## Purpose
Left panel collapse/expand functionality for the PaperDetail split view, providing a toggle button on the divider to quickly hide or restore the left viewer panel.

## Requirements

### Requirement: Collapse toggle button on divider
The system SHALL display a circular icon button (w-6 h-6, fully round) vertically centered on the panel divider. The button SHALL be hidden by default and only appear when the user hovers over the divider hit area. The button SHALL use `PanelLeftClose` icon when the left panel is expanded and `PanelLeftOpen` icon when collapsed. Clicking the button SHALL NOT trigger a drag operation.

#### Scenario: Button hidden by default
- **WHEN** PaperDetail page loads on a wide screen (>=900px)
- **THEN** the toggle button SHALL be invisible (opacity 0)

#### Scenario: Button appears on divider hover
- **WHEN** user hovers over the divider area (including the invisible hit zone)
- **THEN** the toggle button SHALL smoothly fade in to full opacity

#### Scenario: Button hover feedback
- **WHEN** user hovers over the toggle button itself
- **THEN** the button SHALL show a highlight state (indigo text color, indigo border, elevated shadow)

### Requirement: Collapse left panel on click
The system SHALL collapse the left panel to zero width when the user clicks the toggle button while the left panel is expanded. The system SHALL save the current panel width before collapsing.

#### Scenario: Collapse from expanded state
- **WHEN** left panel is expanded and user clicks the toggle button
- **THEN** left panel width transitions to 0% with a smooth animation (300ms ease)
- **AND** the divider moves to the left edge of the screen
- **AND** the toggle button remains at the vertical center of the left edge
- **AND** the icon changes to `PanelLeftOpen`

#### Scenario: Drag handle disabled when collapsed
- **WHEN** left panel is collapsed
- **THEN** dragging the divider SHALL NOT be possible

### Requirement: Expand left panel on click
The system SHALL restore the left panel to its previously saved width when the user clicks the toggle button while the left panel is collapsed.

#### Scenario: Expand from collapsed state
- **WHEN** left panel is collapsed and user clicks the toggle button
- **THEN** left panel width transitions back to the saved width with a smooth animation (300ms ease)
- **AND** the icon changes to `PanelLeftClose`
- **AND** the divider resumes its position at the boundary between panels
