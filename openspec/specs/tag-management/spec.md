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
The tag management page SHALL display each tag with its name, color preview, and the number of associated papers.

#### Scenario: View tag list
- **WHEN** user opens the tag management page
- **THEN** the system displays all tags with their color swatch, name, and associated paper count

#### Scenario: Empty tag list
- **WHEN** user opens the tag management page and no tags exist
- **THEN** the system displays an empty state message

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

