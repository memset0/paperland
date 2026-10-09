# doc2x-translation Specification

## Purpose
On-demand bilingual translation of a paper's PDF through doc2x, reusing the paper's stored doc2x parse, producing a layout-preserving side-by-side PDF and a derived translation-only PDF for the detail-page viewer.

## Requirements
### Requirement: Doc2X translation service
The system SHALL provide a paper-bound service `doc2x_translate` that depends on `contents.doc2x_parsed` and produces metadata `doc2x_translation`. It SHALL produce a preserved-layout side-by-side PDF (original left, translation right) in the configured target language using the configured model, and SHALL exclude the references section from translation. On success it SHALL store `{ bilingual_pdf_path, translated_pdf_path, parse_id, translate_id, model, target_language, translated_at }` in `metadata.doc2x_translation`, with paths relative to the project root under `data/doc2x/<paperId>/translate/`.

#### Scenario: Successful translation
- **WHEN** `doc2x_translate` runs for a paper
- **THEN** a side-by-side PDF SHALL be stored and `metadata.doc2x_translation.bilingual_pdf_path` SHALL point to it

#### Scenario: References not translated
- **WHEN** the paper contains a references section
- **THEN** the translation request SHALL ask doc2x to skip `reference` elements

### Requirement: Translation reuses the stored parse
When `metadata.doc2x_parse_id` exists, translation SHALL be created from that existing doc2x parse (no new upload or parse, so no page quota is consumed). When no parse id is stored, or reusing it fails, the system SHALL fall back to `doc2x translate` via the CLI (which re-parses the PDF).

#### Scenario: Reuse parse id
- **WHEN** a paper with `metadata.doc2x_parse_id` is translated
- **THEN** the translation SHALL be created from that parse id and `metadata.doc2x_translation.parse_id` SHALL equal it

#### Scenario: Fallback to the CLI
- **WHEN** creating the translation from the stored parse id fails
- **THEN** the system SHALL translate via `doc2x translate` and the execution SHALL still succeed if the CLI succeeds

### Requirement: Translation-only PDF derived from the bilingual PDF
After a successful translation the system SHALL derive a translation-only PDF by keeping only the right half of every page of the bilingual PDF. The derived PDF SHALL have the same number of pages as the bilingual PDF and SHALL be stored as `metadata.doc2x_translation.translated_pdf_path`.

#### Scenario: Same page count
- **WHEN** the bilingual PDF has N pages
- **THEN** the translation-only PDF SHALL have N pages, each showing only the translated (right) half

### Requirement: Translation is requested manually and never auto-starts
`doc2x_translate` SHALL only be scheduled for papers whose translation has been explicitly requested. Automatic dependency-graph scheduling SHALL silently skip papers without a request.

#### Scenario: New paper not translated automatically
- **WHEN** a new paper finishes `doc2x_parse` and no translation was requested
- **THEN** `doc2x_translate` SHALL NOT run

### Requirement: Queueing translation before parse completes
`POST /api/papers/:id/doc2x/translate` (logged-in users) SHALL record a translation request. If `contents.doc2x_parsed` exists, translation SHALL start immediately; otherwise the request SHALL stay queued and translation SHALL start automatically when `doc2x_parse` completes. If no parse is pending/running and none has succeeded, the request SHALL also start `doc2x_parse`. The API SHALL return 404 for an unknown paper and 422 when the paper has no PDF or doc2x is disabled.

#### Scenario: Queue before parse is done
- **WHEN** a user requests translation while `doc2x_parse` is running
- **THEN** the API SHALL respond 202 with status `queued`, and translation SHALL start after the parse finishes

#### Scenario: Old paper without parse
- **WHEN** a user requests translation for a paper that has never been doc2x-parsed
- **THEN** `doc2x_parse` SHALL start and translation SHALL follow once it completes

### Requirement: No duplicate translation requests
The translate API SHALL respond 409 without creating work when the paper's translation is already queued, pending, running, or done. A request after a failed translation SHALL be accepted as a retry, and a request that is queued behind a failed doc2x parse SHALL be accepted and SHALL restart the parse.

#### Scenario: Duplicate while queued
- **WHEN** a translation request is queued waiting for parse and the user requests again
- **THEN** the API SHALL respond 409

#### Scenario: Queued behind a failed parse
- **WHEN** a translation request is queued and the doc2x parse it waits for has failed
- **THEN** a new request SHALL be accepted and SHALL restart `doc2x_parse`

#### Scenario: Retry after failure
- **WHEN** the latest `doc2x_translate` execution failed and parse is done
- **THEN** a new request SHALL start a new execution

### Requirement: Doc2X status API
`GET /api/papers/:id/doc2x` SHALL return `{ enabled, has_pdf, parse: { status, error, finished_at }, translate: { status, error, requested_at, bilingual_pdf_path, translated_pdf_path }, text_sources: { pdf_parsed, doc2x_parsed }, qa_source, qa_needs_confirm }`. Parse status SHALL be one of `none | pending | running | done | failed`; translate status SHALL be one of `idle | queued | pending | running | done | failed`, where `queued` means requested but waiting for parse.

#### Scenario: Status while waiting on parse
- **WHEN** translation was requested and parse is still running
- **THEN** `translate.status` SHALL be `queued` and `parse.status` SHALL be `running`
