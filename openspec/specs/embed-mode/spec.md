# embed-mode Specification

## Purpose
Embed mode for iframe/sidebar embedding — hides navigation chrome, reduces padding, supports custom background color via URL parameters.

## Requirements

### Requirement: Embed mode activation via URL parameter
The frontend SHALL detect the `embed=1` query parameter in the page URL. When present, the application SHALL enter embed mode, which modifies the UI to be suitable for iframe/sidebar embedding.

#### Scenario: Embed mode activated
- **WHEN** the page is loaded with URL query parameter `embed=1`
- **THEN** the application enters embed mode and applies all embed-specific UI modifications

#### Scenario: Normal mode when parameter absent
- **WHEN** the page is loaded without the `embed` query parameter
- **THEN** the application renders with its default full UI (no changes to existing behavior)

#### Scenario: Embed state persists across in-app navigation
- **WHEN** the page is loaded with `embed=1` and the user navigates within the app
- **THEN** embed mode remains active throughout the session

### Requirement: Hide application navigation chrome in embed mode
In embed mode, the application SHALL hide all top-level navigation elements that are redundant in a sidebar context.

#### Scenario: Desktop sidebar hidden
- **WHEN** embed mode is active on a desktop viewport
- **THEN** the 52px icon sidebar on the left side SHALL NOT be rendered

#### Scenario: Mobile navigation bar hidden
- **WHEN** embed mode is active on a mobile viewport
- **THEN** the 12px top navigation bar and hamburger menu SHALL NOT be rendered

### Requirement: Hide paper detail header in embed mode
In embed mode, the PaperDetail page SHALL hide its title/navigation header bar (the bar containing the back button and paper title).

#### Scenario: Paper detail header hidden
- **WHEN** embed mode is active and the user views `/papers/:id`
- **THEN** the paper detail header (back button + paper title bar) SHALL NOT be rendered
- **AND** the content area SHALL expand to fill the freed space

### Requirement: Custom background color via URL parameter
The frontend SHALL support a `bg` query parameter that accepts a 6-character hexadecimal color code (without `#` prefix). When provided and valid, the page background color SHALL be set to the specified color.

#### Scenario: Valid background color applied
- **WHEN** the page is loaded with `bg=f2f2f2`
- **THEN** the page background color (html element and main content area) SHALL be set to `#f2f2f2`

#### Scenario: Invalid background color ignored
- **WHEN** the page is loaded with `bg=xyz` or `bg=12345` (not a valid 6-char hex)
- **THEN** the background color SHALL remain unchanged (default behavior)

#### Scenario: Background color works independently of embed mode
- **WHEN** the page is loaded with `bg=f2f2f2` but without `embed=1`
- **THEN** the background color SHALL still be applied (bg parameter works independently)

### Requirement: Reduced content padding in embed mode
In embed mode, the content area SHALL use minimal padding to maximize usable space in the narrow sidebar context.

#### Scenario: Narrow layout padding reduced
- **WHEN** embed mode is active and the PaperDetail page renders in single-column (narrow) layout
- **THEN** the content padding SHALL be reduced from `p-5 space-y-5 max-w-3xl mx-auto pb-40` to `p-2 space-y-2` with no max-width constraint and minimal bottom padding

#### Scenario: Normal mode padding unchanged
- **WHEN** embed mode is NOT active
- **THEN** the content padding SHALL remain at its default values

### Requirement: Refresh button in embed mode
In embed mode, the application SHALL display a compact refresh button that allows the user to reload the current page content.

#### Scenario: Refresh button visible in embed mode
- **WHEN** embed mode is active on the PaperDetail page
- **THEN** a refresh button SHALL be displayed at the top of the page in a compact toolbar

#### Scenario: Refresh button triggers page reload
- **WHEN** the user clicks the refresh button in embed mode
- **THEN** the page SHALL perform a full reload (`window.location.reload()`)

#### Scenario: Refresh button not visible in normal mode
- **WHEN** embed mode is NOT active
- **THEN** the refresh button SHALL NOT be rendered
