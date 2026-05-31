# tag-management Specification

## Purpose
Tag CRUD operations including listing, renaming (with merge support), deleting, and color updates via a dedicated management page and Internal API endpoints.
## Requirements
### Requirement: Tag management page accessible from sidebar
The system SHALL provide a dedicated tag management page at `/tags` route, accessible via a Tag icon in the sidebar navigation. The page SHALL require an authenticated user; the sidebar Tag icon SHALL remain visible to anonymous users but selecting it SHALL prompt for login instead of opening the page.

#### Scenario: Navigate to tag management while logged in
- **WHEN** an authenticated user clicks the Tag icon in the sidebar
- **THEN** the system navigates to `/tags` and displays the tag management page with a list of that user's tags

#### Scenario: Anonymous user attempts tag management
- **WHEN** an anonymous user clicks the Tag icon in the sidebar
- **THEN** the system SHALL prompt for login and SHALL NOT display tag data

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

### Requirement: Rename tag with inline editing
The system SHALL allow renaming a tag via inline editing on the tag management page.

#### Scenario: Rename to unique name
- **WHEN** user edits a tag name to a new unique name and confirms
- **THEN** the system updates the tag name and refreshes the list

#### Scenario: Rename to existing name triggers merge confirmation
- **WHEN** user edits a tag name to a name that already exists
- **THEN** the system SHALL display a merge confirmation dialog (not a red error message) explaining that the source tag will be merged into the existing target tag, and that this operation is irreversible
- **AND WHEN** user confirms the merge
- **THEN** the system merges all paper associations from the source tag into the target tag, deletes the source tag, and refreshes the tag list

#### Scenario: User cancels merge
- **WHEN** user edits a tag name to an existing name and the merge confirmation appears
- **AND WHEN** user cancels
- **THEN** the tag name reverts to its original value and no changes are made

#### Scenario: Rename to empty name
- **WHEN** user clears the tag name and confirms
- **THEN** the system SHALL not submit the rename request

### Requirement: Delete tag with confirmation
The system SHALL allow deleting one of the current user's tags with a confirmation dialog.

#### Scenario: Delete tag confirmed
- **WHEN** a user clicks delete on one of their tags and confirms the deletion dialog
- **THEN** the system removes that tag and its paper associations for that user, and refreshes the current user's tag display on affected papers

#### Scenario: Delete tag cancelled
- **WHEN** a user clicks delete on a tag and cancels the deletion dialog
- **THEN** the tag remains unchanged

### Requirement: Internal API for tag management
The system SHALL provide Internal API endpoints for tag CRUD operations. All endpoints SHALL require an authenticated user and SHALL operate only on the current user's tags. Tag name uniqueness SHALL be enforced per user (`(user_id, name)`).

#### Scenario: List all tags
- **WHEN** an authenticated user calls `GET /api/tags`
- **THEN** the system returns only that user's tags with id, name, color, and paper_count

#### Scenario: Rename tag (no conflict)
- **WHEN** `PATCH /api/tags/:id` is called with a new name unique among the current user's tags
- **THEN** the system updates the tag name and returns the updated tag

#### Scenario: Rename tag (name conflict within user)
- **WHEN** `PATCH /api/tags/:id` is called with a name that already exists among the current user's tags
- **THEN** the system returns 409 Conflict with the conflicting target tag info

#### Scenario: Merge tags
- **WHEN** `POST /api/tags/:id/merge` is called with `{ target_id }` body where both tags belong to the current user
- **THEN** the system moves all paper associations to the target tag and deletes the source tag, refreshing the current user's tag display on affected papers

#### Scenario: Delete tag
- **WHEN** `DELETE /api/tags/:id` is called for one of the current user's tags
- **THEN** the system removes the tag and its paper associations and refreshes the current user's tag display on affected papers

#### Scenario: Update tag color
- **WHEN** `PATCH /api/tags/:id` is called with a new color value for one of the current user's tags
- **THEN** the system updates the tag color and returns the updated tag

#### Scenario: Cannot operate on another user's tag
- **WHEN** an authenticated user calls any `/api/tags/:id` endpoint for a tag owned by a different user
- **THEN** the system SHALL respond as if the tag does not exist (404) and SHALL NOT modify it

#### Scenario: Anonymous tag management rejected
- **WHEN** an anonymous client calls any `/api/tags` management endpoint
- **THEN** the system SHALL respond with 401 Unauthorized

### Requirement: Tags are owned per user
Every tag SHALL belong to exactly one user via `tags.user_id`. The tag management page SHALL show and manage only the current user's tags. A user SHALL NOT see, rename, recolor, merge, or delete another user's tags.

#### Scenario: Each user manages an independent tag set
- **WHEN** user A and user B both open the tag management page
- **THEN** each SHALL see only their own tags, and changes by one SHALL NOT affect the other's tags

#### Scenario: Same name allowed across users
- **WHEN** user A has a tag "ML" and user B creates a tag "ML"
- **THEN** both SHALL coexist as distinct, independently managed tags

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

