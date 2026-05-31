## MODIFIED Requirements

### Requirement: Tags rendered with their assigned color
All tag displays across the application SHALL use the tag's assigned color for rendering. On the tag management page specifically, each tag's name SHALL be rendered as a chip styled with the tag's own color (consistent with its appearance in the paper list and paper detail), not merely shown as plain text next to a separate color swatch.

#### Scenario: Tag badge uses color
- **WHEN** a tag is displayed (in paper list, paper detail, or tag management)
- **THEN** the tag badge uses the tag's color for background/text styling

#### Scenario: Management page renders tag name as a colored chip
- **WHEN** the tag management page lists tags
- **THEN** each tag's name SHALL appear as a chip styled with that tag's assigned color, matching its appearance elsewhere in the app
