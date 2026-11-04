## ADDED Requirements

### Requirement: Papers kind column
The `papers` table SHALL have a `kind` column (text, not null, default `'paper'`) holding `paper` or `article`. It SHALL be added by an additive migration in which every existing paper gets `paper`.

#### Scenario: Existing papers after migration
- **WHEN** the migration runs on a database with existing papers
- **THEN** every existing paper SHALL have kind `paper` and no other column SHALL change
