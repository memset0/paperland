## ADDED Requirements

### Requirement: Unified desktop header height
The desktop sidebar header and the PaperDetail page header SHALL both use `h-12` (48px) height, matching the mobile navbar height. The bottom border of both headers SHALL be at the same vertical position when viewed side-by-side. Border color SHALL be `border-gray-200` consistently.

#### Scenario: Desktop sidebar header matches page header
- **WHEN** the viewport width is ≥768px and the user is on the PaperDetail page
- **THEN** the sidebar header and the PaperDetail top bar SHALL both be exactly 48px tall, with their bottom borders perfectly aligned and same border color

#### Scenario: Mobile layout unchanged
- **WHEN** the viewport width is <768px
- **THEN** the mobile top navbar and drawer header SHALL remain at `h-12` (48px) with no visual changes

### Requirement: Fixed icon-only sidebar on desktop
The desktop sidebar SHALL be a permanent narrow (52px) icon-only sidebar. There SHALL be no expand/collapse toggle. Navigation icons SHALL be centered within the sidebar width.

#### Scenario: Desktop sidebar displays icons only
- **WHEN** a user views the application on a desktop viewport (≥768px)
- **THEN** the sidebar SHALL display at 52px width showing only centered navigation icons and the BookOpen logo icon in the header, with no text labels

### Requirement: Hover tooltip on nav icons
Each navigation icon in the desktop sidebar SHALL display a tooltip to the right of the icon on hover, showing the navigation label. The tooltip SHALL render on a single line with high z-index to avoid being covered by content.

#### Scenario: Tooltip appears on hover
- **WHEN** the user hovers over a navigation icon in the desktop sidebar
- **THEN** a dark tooltip SHALL appear to the right of the icon displaying the nav label in a single line (whitespace-nowrap) at z-index high enough to overlay all content

### Requirement: GitHub link in sidebar footer
The desktop sidebar SHALL display a GitHub icon at the bottom, linking to the project repository. The link SHALL open in a new tab and include a hover tooltip.

#### Scenario: GitHub link display and behavior
- **WHEN** the user views the desktop sidebar
- **THEN** a GitHub icon SHALL be visible at the bottom of the sidebar, styled consistently with nav icons, and clicking it SHALL open the project GitHub repository in a new tab
