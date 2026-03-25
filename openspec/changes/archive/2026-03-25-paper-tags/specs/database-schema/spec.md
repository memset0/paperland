## MODIFIED Requirements

### Requirement: Tags table schema
The `tags` table SHALL include id, name, and color columns.

#### Scenario: Tag record structure
- **WHEN** a tag exists in the database
- **THEN** it has columns: `id` (integer, auto-increment PK), `name` (text, unique, not null), `color` (text, not null, default empty string)

### Requirement: Papers table includes tags_json
The `papers` table SHALL include a `tags_json` column for denormalized tag storage.

#### Scenario: Papers tags_json column
- **WHEN** a paper exists in the database
- **THEN** it has a `tags_json` (text, nullable) column storing JSON array of `[{"id": number, "name": string}]`

#### Scenario: Migration backfills tags_json
- **WHEN** the migration runs on existing data
- **THEN** existing papers have their tags_json populated from current paper_tags relationships
