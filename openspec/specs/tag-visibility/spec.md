### Requirement: Tag visibility database field
The `tags` table SHALL have a `visible` column (integer, NOT NULL, default 1) that controls whether the tag appears in the paper list filter bar.

#### Scenario: New tag created via API
- **WHEN** a new tag is created (via paper tag assignment or manual creation)
- **THEN** the tag's `visible` field SHALL be `1` (visible by default)

#### Scenario: Existing tags after migration
- **WHEN** the migration runs on an existing database
- **THEN** all existing tags SHALL have `visible = 1`

### Requirement: Toggle tag visibility via API
The `PATCH /api/tags/:id` endpoint SHALL accept an optional `visible` boolean field to update tag visibility.

#### Scenario: Set tag to hidden
- **WHEN** client sends `PATCH /api/tags/:id` with `{ "visible": false }`
- **THEN** the tag's `visible` field SHALL be set to `0`
- **AND** the response SHALL include `"visible": false`

#### Scenario: Set tag to visible
- **WHEN** client sends `PATCH /api/tags/:id` with `{ "visible": true }`
- **THEN** the tag's `visible` field SHALL be set to `1`
- **AND** the response SHALL include `"visible": true`

#### Scenario: Patch without visible field
- **WHEN** client sends `PATCH /api/tags/:id` with only `name` or `color`
- **THEN** the `visible` field SHALL remain unchanged

### Requirement: GET /api/tags returns visibility
The `GET /api/tags` endpoint SHALL include a `visible` boolean field for each tag.

#### Scenario: Fetch all tags
- **WHEN** client sends `GET /api/tags`
- **THEN** each tag object SHALL include `"visible": true` or `"visible": false`

### Requirement: Paper list filters by tag visibility
The paper list page's tag filter bar SHALL only display tags where `visible` is `true`.

#### Scenario: Hidden tag not shown in filter bar
- **WHEN** a tag has `visible = false`
- **THEN** the tag SHALL NOT appear in the paper list's tag filter bar

#### Scenario: Visible tag shown in filter bar
- **WHEN** a tag has `visible = true`
- **THEN** the tag SHALL appear in the paper list's tag filter bar

#### Scenario: Hidden tag not shown on paper cards in list
- **WHEN** a paper is assigned a tag with `visible = false`
- **THEN** the tag SHALL NOT be displayed on the paper's card in the paper list view

#### Scenario: Visible tag shown on paper cards
- **WHEN** a paper is assigned a tag with `visible = true`
- **THEN** the tag SHALL be displayed on the paper's card in the paper list view

### Requirement: Tag management visibility toggle
The tag management page SHALL display a toggle icon button for each tag to control visibility.

#### Scenario: Visible tag shows eye icon
- **WHEN** a tag has `visible = true` in the tag management page
- **THEN** an eye icon (Eye) SHALL be displayed as a clickable button

#### Scenario: Hidden tag shows eye-off icon
- **WHEN** a tag has `visible = false` in the tag management page
- **THEN** an eye-off icon (EyeOff) SHALL be displayed as a clickable button

#### Scenario: Clicking toggle changes visibility
- **WHEN** user clicks the eye/eye-off icon button for a tag
- **THEN** the system SHALL send `PATCH /api/tags/:id` with the toggled `visible` value
- **AND** the icon SHALL update to reflect the new state

### Requirement: Shared Tag type includes visible
The shared `Tag` interface SHALL include a `visible` boolean field.

#### Scenario: Tag type definition
- **WHEN** the `Tag` type is used across frontend, backend, and shared packages
- **THEN** it SHALL include `visible: boolean`
