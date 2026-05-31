## MODIFIED Requirements

### Requirement: Tag list displays name, color, and paper count
The tag management page SHALL display all of the current user's tags in a data table (no pagination; the page itself scrolls), with columns in this order: visibility, tag id, name, and paper count, plus a trailing per-row actions control. Each tag's name SHALL be rendered as a chip styled with that tag's own assigned color (a true-color preview consistent with how the tag appears in the paper list and paper detail views); there SHALL NOT be a separate dedicated color column — the color is conveyed by the name chip and edited from the actions menu. Per-row operations (rename, change color, toggle visibility, delete) SHALL be reachable from a single per-row actions menu rather than a row of always-visible icon buttons. The toolbar SHALL show a count of visible tags over the total number of tags. All user-facing labels on this page SHALL be in English.

#### Scenario: View tag list
- **WHEN** user opens the tag management page
- **THEN** the system displays all of the user's tags in a table, each row showing (in order) a visibility control, the tag id, the tag name rendered in its assigned color, and the associated paper count, plus an actions menu
- **AND** the toolbar SHALL display the number of visible tags out of the total number of tags

#### Scenario: Empty tag list
- **WHEN** user opens the tag management page and no tags exist
- **THEN** the system displays an empty state message

#### Scenario: Per-row actions via menu
- **WHEN** user opens a tag row's actions menu
- **THEN** the menu SHALL offer rename, change-color, show/hide, and delete actions for that tag

## ADDED Requirements

### Requirement: Search tags by name on the management page
The tag management page SHALL provide a search input that filters the displayed tags by name in real time, case-insensitively, as the user types.

#### Scenario: Filter tags by query
- **WHEN** user types text into the tag search input
- **THEN** the table SHALL show only tags whose name contains the query (case-insensitive) and SHALL hide the rest

#### Scenario: No tags match the query
- **WHEN** the search query matches none of the user's tags
- **THEN** the page SHALL show a distinct "no matching tags" state, separate from the empty-no-tags state

#### Scenario: Clearing the search restores the full list
- **WHEN** user clears the search input
- **THEN** the table SHALL again show all of the user's tags

### Requirement: Sort tags on the management page
The tag management page SHALL allow sorting the tag table by name, by paper count, or by tag id, in ascending or descending order, controlled by clicking the corresponding column header. The default order SHALL be by name ascending.

#### Scenario: Default sort
- **WHEN** user opens the tag management page
- **THEN** tags SHALL be ordered by name ascending

#### Scenario: Sort by a column
- **WHEN** user clicks a sortable column header (name, paper count, or id)
- **THEN** the table SHALL reorder by that column ascending
- **AND WHEN** user clicks the same header again
- **THEN** the order SHALL toggle to descending

### Requirement: Create a tag from the management page
The tag management page SHALL allow the current user to create a new tag directly on the page via an inline editing affordance (not a separate full modal flow). A newly created tag SHALL be assigned a color automatically.

#### Scenario: Create a tag inline
- **WHEN** user activates the "new tag" affordance, enters a non-empty name, and confirms
- **THEN** the system creates a tag owned by the current user with that name and an automatically assigned color, and the new tag appears in the table

#### Scenario: Create with empty name
- **WHEN** user activates the "new tag" affordance but leaves the name empty
- **THEN** the system SHALL NOT submit the create request

#### Scenario: Create a duplicate name
- **WHEN** user tries to create a tag whose name already exists among their tags
- **THEN** the system SHALL NOT create a duplicate and SHALL surface an error notification

### Requirement: Internal API to create a tag
The system SHALL provide a `POST /api/tags` endpoint to create a tag for the current user. It SHALL require an authenticated user, enforce per-user name uniqueness (`(user_id, name)`), and assign a color from the predefined palette when none is supplied.

#### Scenario: Create tag
- **WHEN** an authenticated user calls `POST /api/tags` with a name unique among their tags
- **THEN** the system creates the tag owned by that user, assigns a palette color if none was provided, and returns the created tag with id, name, color, visible, and paper_count 0

#### Scenario: Create tag name conflict
- **WHEN** `POST /api/tags` is called with a name that already exists among the current user's tags
- **THEN** the system SHALL respond 409 Conflict with the conflicting target tag info and SHALL NOT create a duplicate

#### Scenario: Anonymous create rejected
- **WHEN** an anonymous client calls `POST /api/tags`
- **THEN** the system SHALL respond 401 Unauthorized
