# paper-list-payload Specification

## Purpose
TBD - created by archiving change slim-paper-list-response. Update Purpose after archive.

## Requirements

### Requirement: Paper list items omit full text and carry slim metadata
Each item returned by `GET /api/papers` SHALL NOT include the paper's full text (`contents`). Its `metadata` SHALL contain only the keys the list renders: `citation_count`, `reference_count`, and `s2_url`, each present only when known. When the stored metadata has no `reference_count` but has a `references` array, the item's `reference_count` SHALL be that array's length. A paper with no stored metadata SHALL have `metadata` `null`. All other item fields (id, identifiers, title, authors, abstract, listed, listable, tags, in_library, timestamps, etc.) SHALL be unchanged. `GET /api/papers/:id` SHALL continue to return full `contents` and full `metadata`.

#### Scenario: List item has no full text
- **WHEN** a paper has parsed full text and `GET /api/papers` is called
- **THEN** its list item SHALL NOT have a `contents` key
- **AND** `GET /api/papers/:id` for the same paper SHALL return its full `contents`

#### Scenario: Metadata is slimmed
- **WHEN** a paper's stored metadata has `citation_count` 10, `reference_count` 3, `s2_url`, and a `references` array
- **THEN** its list item's `metadata` SHALL be exactly `{ citation_count: 10, reference_count: 3, s2_url }`

#### Scenario: Reference count derived from references
- **WHEN** a paper's stored metadata has no `reference_count` but a `references` array of length 40
- **THEN** its list item's `metadata.reference_count` SHALL be 40

### Requirement: Paper list paginates in the database
`GET /api/papers` SHALL fetch only the requested page from the database (applying the same filters and ordering) and SHALL compute `pagination.total` with a count query, rather than loading every matching paper. The full-text column SHALL NOT be read for the list.

#### Scenario: Page and total
- **WHEN** 45 papers match and `page=3&page_size=20` is requested
- **THEN** the response SHALL contain the 5 papers at positions 41–45 in the requested order
- **AND** `pagination` SHALL be `{ page: 3, page_size: 20, total: 45, total_pages: 3 }`
