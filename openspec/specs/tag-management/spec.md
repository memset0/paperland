# tag-management Specification

## Purpose
Tag CRUD operations including listing, renaming (with merge support), deleting, and color updates via a dedicated management page and Internal API endpoints.

## Requirements

### Requirement: Tag management page accessible from sidebar
The system SHALL provide a dedicated tag management page at `/tags` route, accessible via a Tag icon in the sidebar navigation.

#### Scenario: Navigate to tag management
- **WHEN** user clicks the Tag icon in the sidebar
- **THEN** the system navigates to `/tags` and displays the tag management page with a list of all tags

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
The system SHALL allow deleting a tag with a confirmation dialog.

#### Scenario: Delete tag confirmed
- **WHEN** user clicks delete on a tag and confirms the deletion dialog
- **THEN** the system removes the tag and all its paper associations, updates affected papers' tags_json

#### Scenario: Delete tag cancelled
- **WHEN** user clicks delete on a tag and cancels the deletion dialog
- **THEN** the tag remains unchanged

### Requirement: Internal API for tag management
The system SHALL provide Internal API endpoints for tag CRUD operations.

#### Scenario: List all tags
- **WHEN** `GET /api/tags` is called
- **THEN** the system returns all tags with id, name, color, and paper_count

#### Scenario: Rename tag (no conflict)
- **WHEN** `PATCH /api/tags/:id` is called with a new unique name
- **THEN** the system updates the tag name and returns the updated tag

#### Scenario: Rename tag (name conflict)
- **WHEN** `PATCH /api/tags/:id` is called with a name that already exists
- **THEN** the system returns 409 Conflict with the conflicting target tag info

#### Scenario: Merge tags
- **WHEN** `POST /api/tags/:id/merge` is called with `{ target_id }` body
- **THEN** the system moves all paper associations to target tag, deletes source tag, updates affected papers' tags_json

#### Scenario: Delete tag
- **WHEN** `DELETE /api/tags/:id` is called
- **THEN** the system removes the tag, its paper associations, and updates affected papers' tags_json

#### Scenario: Update tag color
- **WHEN** `PATCH /api/tags/:id` is called with a new color value
- **THEN** the system updates the tag color and returns the updated tag
