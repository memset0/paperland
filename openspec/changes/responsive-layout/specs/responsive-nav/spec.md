## ADDED Requirements

### Requirement: Desktop sidebar preserved
On screens >= 768px, the collapsible sidebar navigation SHALL remain as-is.

#### Scenario: Wide screen
- **WHEN** the viewport width is >= 768px
- **THEN** the sidebar SHALL be visible and the top navbar SHALL be hidden

### Requirement: Mobile top navbar with hamburger
On screens < 768px, a top navbar SHALL replace the sidebar, with a hamburger menu button.

#### Scenario: Narrow screen
- **WHEN** the viewport width is < 768px
- **THEN** the sidebar SHALL be hidden and a top navbar with a hamburger icon SHALL appear

### Requirement: Drawer overlay
Clicking the hamburger button SHALL open a slide-out drawer from the left with navigation links.

#### Scenario: Open drawer
- **WHEN** the user taps the hamburger icon
- **THEN** a drawer SHALL slide in from the left with a semi-transparent backdrop

#### Scenario: Close drawer on navigation
- **WHEN** the user taps a navigation link in the drawer
- **THEN** the drawer SHALL close and the selected page SHALL load

#### Scenario: Close drawer on backdrop
- **WHEN** the user taps the backdrop
- **THEN** the drawer SHALL close
