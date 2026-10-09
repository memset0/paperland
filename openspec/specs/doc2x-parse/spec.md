# doc2x-parse Specification

## Purpose
Precise PDF-to-Markdown parsing of a paper through the locally installed doc2x CLI, stored as a separate text source (`contents.doc2x_parsed`) that Q&A prefers over mechanical extraction, with the doc2x parse id persisted for later reuse.

## Requirements
### Requirement: Doc2X parse service
The system SHALL provide a paper-bound service `doc2x_parse` that depends on `pdf_path` and produces `contents.doc2x_parsed`. It SHALL convert the paper's PDF to Markdown via the doc2x CLI with `$`-delimited formulas, keeping the full document including the references section, and store the Markdown text in `contents.doc2x_parsed`. The existing mechanical `pdf_parse_service` output (`contents.pdf_parsed`) SHALL remain unchanged and both services MAY run in parallel.

#### Scenario: Successful parse
- **WHEN** `doc2x_parse` runs for a paper whose PDF exists
- **THEN** `contents.doc2x_parsed` SHALL contain the doc2x Markdown (including the references section) and the execution SHALL end `done`

#### Scenario: Mechanical parse unaffected
- **WHEN** a new paper with a PDF is added
- **THEN** `pdf_parse_service` SHALL still run and write `contents.pdf_parsed` independently of `doc2x_parse`

#### Scenario: Artifacts kept on disk
- **WHEN** a parse succeeds
- **THEN** the Markdown and its extracted images SHALL be kept under `data/doc2x/<paperId>/parse/`

### Requirement: Parse id persisted
When a doc2x parse succeeds, the doc2x parse task id from the CLI receipt SHALL be stored in the database as `metadata.doc2x_parse_id`.

#### Scenario: Parse id stored
- **WHEN** `doc2x_parse` completes for a paper
- **THEN** `metadata.doc2x_parse_id` SHALL hold the doc2x parse id (`op_…`) of that run

### Requirement: Automatic parse only for new papers
`doc2x_parse` SHALL be scheduled automatically by the dependency graph only for papers whose `created_at` is at or after the configured `doc2x.auto_since`, or for which the user has explicitly requested a doc2x parse. Papers outside that set SHALL be silently skipped by automatic scheduling (no execution record). When `doc2x.enabled` is false, `doc2x_parse` SHALL never be scheduled automatically.

#### Scenario: New paper auto-parses
- **WHEN** a paper created after `auto_since` obtains a `pdf_path`
- **THEN** `doc2x_parse` SHALL be queued automatically

#### Scenario: Old paper not backfilled
- **WHEN** another service completes for a paper created before `auto_since` that has never requested a doc2x parse
- **THEN** `doc2x_parse` SHALL NOT be queued and no `blocked` record SHALL be written for it

#### Scenario: Metadata-only paper deferred
- **WHEN** a new paper is metadata-only (`listed=0`)
- **THEN** `doc2x_parse` SHALL be deferred until the paper is promoted, like other `requires_listed` services

### Requirement: Manual doc2x parse
`POST /api/papers/:id/doc2x/parse` (logged-in users) SHALL record a parse request for the paper and start `doc2x_parse`. It SHALL return 409 when a parse for that paper is already pending/running or `contents.doc2x_parsed` already exists, 404 for an unknown paper, and 422 when the paper has no PDF or doc2x is disabled.

#### Scenario: Manual parse of an old paper
- **WHEN** a user requests a doc2x parse for an old paper with a PDF and no running parse
- **THEN** the API SHALL respond 202 and a `doc2x_parse` execution SHALL start

#### Scenario: Duplicate parse request
- **WHEN** a parse for the paper is already pending or running
- **THEN** the API SHALL respond 409 and SHALL NOT create another execution

#### Scenario: Retry after failure
- **WHEN** the latest `doc2x_parse` execution for the paper failed
- **THEN** a manual request SHALL start a new execution

### Requirement: Doc2X CLI failures are reported clearly
A doc2x CLI invocation that cannot run SHALL fail the execution with a clear message: a missing CLI binary SHALL report that the doc2x CLI is not installed; an authentication failure (exit code 2) SHALL report that `doc2x login` is required; a run exceeding `doc2x.timeout` SHALL be killed and reported as a timeout; other failures SHALL include the CLI's error message.

#### Scenario: Not logged in
- **WHEN** the doc2x CLI exits with code 2
- **THEN** the execution SHALL be `failed` with an error telling the user to run `doc2x login`
