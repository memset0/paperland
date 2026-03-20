# paper-modified-time Specification

## Purpose
Paper updated_at tracking — automatically updates the paper's modification timestamp when QA or highlight operations are performed.

## Requirements

### Requirement: Paper updated_at field
The `papers` table SHALL have an `updated_at` column (text, not null, ISO 8601) that records the timestamp of the most recent user-initiated modification to the paper or its associated data.

#### Scenario: New paper has updated_at equal to created_at
- **WHEN** a new paper is created via `POST /api/papers`
- **THEN** the paper's `updated_at` SHALL equal its `created_at` value

#### Scenario: updated_at included in API responses
- **WHEN** a paper is returned from `GET /api/papers` or `GET /api/papers/:id`
- **THEN** the response SHALL include the `updated_at` field as an ISO 8601 string

### Requirement: QA operations update paper updated_at
The system SHALL update the paper's `updated_at` timestamp when QA operations are performed on it.

#### Scenario: Free QA question updates updated_at
- **WHEN** a free question is submitted via `POST /api/papers/:id/qa/free`
- **THEN** the paper's `updated_at` SHALL be set to the current timestamp

#### Scenario: Template QA trigger updates updated_at
- **WHEN** template QA is triggered via `POST /api/papers/:id/qa/template` and at least one template is triggered
- **THEN** the paper's `updated_at` SHALL be set to the current timestamp

#### Scenario: Template QA trigger with no new templates does not update
- **WHEN** template QA is triggered but all templates already have results
- **THEN** the paper's `updated_at` SHALL NOT be changed

#### Scenario: Template regenerate updates updated_at
- **WHEN** a template is regenerated via `POST /api/papers/:id/qa/template/:name/regenerate`
- **THEN** the paper's `updated_at` SHALL be set to the current timestamp

#### Scenario: QA entry regenerate updates updated_at
- **WHEN** a QA entry is regenerated via `POST /api/qa/:entryId/regenerate`
- **THEN** the associated paper's `updated_at` SHALL be set to the current timestamp

### Requirement: Highlight operations update paper updated_at
The system SHALL update the paper's `updated_at` timestamp when highlights are created, updated, or deleted for that paper.

#### Scenario: Creating a highlight updates updated_at
- **WHEN** a highlight is created via `POST /api/highlights` with pathname `/papers/:id`
- **THEN** the paper identified by `:id` SHALL have its `updated_at` set to the current timestamp

#### Scenario: Updating a highlight updates updated_at
- **WHEN** a highlight is updated via `PUT /api/highlights/:id` and the highlight belongs to a paper page
- **THEN** the associated paper's `updated_at` SHALL be set to the current timestamp

#### Scenario: Deleting a highlight updates updated_at
- **WHEN** a highlight is deleted via `DELETE /api/highlights/:id` and the highlight belongs to a paper page
- **THEN** the associated paper's `updated_at` SHALL be set to the current timestamp

#### Scenario: Non-paper highlight does not update any paper
- **WHEN** a highlight operation is performed with a pathname that does not match `/papers/:id`
- **THEN** no paper's `updated_at` SHALL be modified

### Requirement: Migration backfills updated_at
The database migration SHALL add the `updated_at` column and backfill existing data.

#### Scenario: Existing papers get updated_at from created_at
- **WHEN** the migration runs on a database with existing papers
- **THEN** each paper's `updated_at` SHALL be set to its `created_at` value
