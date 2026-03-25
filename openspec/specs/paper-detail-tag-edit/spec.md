### Requirement: Paper detail page supports inline tag editing
The paper detail page SHALL allow users to edit a paper's tags via an inline editor.

#### Scenario: Enter tag edit mode
- **WHEN** user clicks the edit button next to the tags section header
- **THEN** the tag display switches to a TagSelector component pre-populated with current tag names

#### Scenario: Add a tag
- **WHEN** user selects or creates a tag in the TagSelector during edit mode
- **THEN** the tag is added to the editing list (not yet saved)

#### Scenario: Remove a tag
- **WHEN** user removes a tag in the TagSelector during edit mode
- **THEN** the tag is removed from the editing list (not yet saved)

#### Scenario: Save tags
- **WHEN** user clicks the save button
- **THEN** the system calls `PUT /api/papers/:id/tags` with the full tag list, refreshes the paper detail and tag cache, and exits edit mode

#### Scenario: Cancel editing
- **WHEN** user clicks the cancel button
- **THEN** the editing is discarded and the original tags are restored

#### Scenario: Paper with no tags shows add button
- **WHEN** a paper has no tags
- **THEN** the detail page shows a "+ 添加标签" button that enters edit mode
