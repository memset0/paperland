## ADDED Requirements

### Requirement: Paper QA reading indicators
Each PaperDetail QA entry SHALL include current-viewer highlight/note-anchor counts and show non-zero compact indicators in the collapsed header.

#### Scenario: Entry is collapsed
- **WHEN** counts are non-zero
- **THEN** indicators SHALL remain visible without expanding the answer

#### Scenario: Viewer changes reading data
- **WHEN** the viewer adds/removes a highlight or note link
- **THEN** refresh SHALL update the displayed counts

