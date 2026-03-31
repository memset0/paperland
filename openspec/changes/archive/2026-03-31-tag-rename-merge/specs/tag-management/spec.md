## MODIFIED Requirements

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
