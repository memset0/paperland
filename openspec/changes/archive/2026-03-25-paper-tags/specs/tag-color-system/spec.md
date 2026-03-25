## ADDED Requirements

### Requirement: Tags have assigned colors
Each tag SHALL have a color attribute stored as a hex color string. When a tag is created, the system SHALL assign a random color from a predefined palette.

#### Scenario: New tag gets random color
- **WHEN** a new tag is created (via any path: manual add, API, Zotero sync)
- **THEN** the tag is assigned a random color from the predefined palette

#### Scenario: Tag color stored in database
- **WHEN** a tag exists in the system
- **THEN** its color is stored in the `tags.color` column as a hex string (e.g., `#6366f1`)

### Requirement: Tag color editable in management page
The tag management page SHALL allow users to change a tag's color via a color picker.

#### Scenario: Change tag color
- **WHEN** user selects a new color for a tag in the color picker
- **THEN** the system updates the tag's color in the database and refreshes the frontend color cache

### Requirement: Frontend tag color caching
The frontend SHALL cache all tag colors in a Pinia store, fetched once per page load from `GET /api/tags`.

#### Scenario: Initial color cache load
- **WHEN** a page that displays tags is loaded
- **THEN** the system fetches all tags (with colors) once and caches them in the tags store

#### Scenario: Cache refresh on color change
- **WHEN** user changes a tag color on the tag management page
- **THEN** the tags store cache is immediately refreshed

#### Scenario: Cache refresh on page reload
- **WHEN** user refreshes the browser page
- **THEN** the tags store fetches fresh color data from the backend

### Requirement: Tags rendered with their assigned color
All tag displays across the application SHALL use the tag's assigned color for rendering.

#### Scenario: Tag badge uses color
- **WHEN** a tag is displayed (in paper list, paper detail, or tag management)
- **THEN** the tag badge uses the tag's color for background/text styling
