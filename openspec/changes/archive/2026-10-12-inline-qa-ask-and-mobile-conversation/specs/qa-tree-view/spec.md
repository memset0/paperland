## MODIFIED Requirements

### Requirement: Floating windows share one mechanism
All floating windows of the app — note editor windows and the Q&A tree window — SHALL be implemented by one shared window mechanism: the same window shell (move, bottom-right resize, fullscreen on mobile) and one shared stacking order in which the most recently pressed window is on top. Any number of these windows SHALL be able to be open at the same time. Per-kind differences (title, remembered size) SHALL be options of the shared shell, not separate implementations. The question box is not a floating window.

#### Scenario: Several windows at once
- **WHEN** the user opens the Q&A tree and a note window
- **THEN** both are open together and pressing one brings it to the front

#### Scenario: Same behaviour everywhere
- **WHEN** the user drags or resizes any of these windows on desktop
- **THEN** they move by the title bar and resize from the bottom-right grip the same way
