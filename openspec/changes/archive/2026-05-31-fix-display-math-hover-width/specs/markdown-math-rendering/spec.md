## MODIFIED Requirements

### Requirement: Click math formula to copy LaTeX source
The system SHALL copy the LaTeX source code of a math formula to the clipboard when the user clicks on it, and display a toast notification confirming the copy.

#### Scenario: Click inline math to copy
- **WHEN** the user clicks on an inline math formula (e.g., rendered from `$E=mc^2$`)
- **THEN** the LaTeX source text `E=mc^2` SHALL be copied to the clipboard
- **AND** a toast notification "LaTeX 已复制到剪贴板" SHALL appear at the bottom center of the screen

#### Scenario: Click display math to copy
- **WHEN** the user clicks on a display math formula (e.g., rendered from `$$\int_0^1 f(x)\,dx$$`)
- **THEN** the LaTeX source text `\int_0^1 f(x)\,dx` SHALL be copied to the clipboard
- **AND** a toast notification SHALL appear at the bottom center of the screen

#### Scenario: Toast auto-dismiss
- **WHEN** the toast notification is shown
- **THEN** it SHALL automatically disappear after 2 seconds with a fade-out animation

#### Scenario: Click does not interfere with text selection
- **WHEN** the user is selecting text that spans across a math formula (for highlighting)
- **THEN** the click-to-copy SHALL NOT be triggered

#### Scenario: Math formula hover hint
- **WHEN** the user hovers over a math formula
- **THEN** the formula SHALL display a subtle background color and pointer cursor to indicate it is clickable

#### Scenario: Display math hover hint covers only the formula width
- **WHEN** the user hovers over a display (block) math formula whose rendered width is narrower than the surrounding content block
- **THEN** the hover background SHALL cover only the formula's actual rendered width (the visible KaTeX box), NOT the full width of the centered block container
- **AND** the formula SHALL remain horizontally centered within its block

#### Scenario: Over-wide display math caps at full width and scrolls
- **WHEN** a display math formula's rendered width exceeds the available container width
- **THEN** the formula's block SHALL cap at 100% of the container width and provide horizontal scrolling (`overflow-x: auto`) so the full formula remains reachable
- **AND** the start (left edge) of the formula SHALL remain reachable when scrolling
