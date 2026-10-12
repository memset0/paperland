## ADDED Requirements

### Requirement: QA preferences are viewer-private
QA background preferences SHALL be scoped to the authenticated viewer. Reads SHALL return only that viewer's color for each entry; anonymous reads SHALL return null/default and writes SHALL require login.

#### Scenario: Two viewers read the same entry
- **WHEN** user A chose blue and user B chose purple
- **THEN** each SHALL receive only their own color

#### Scenario: Anonymous reads preset QA
- **WHEN** an anonymous viewer reads a public preset entry
- **THEN** no user's preference SHALL be disclosed

