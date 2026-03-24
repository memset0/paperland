## MODIFIED Requirements

### Requirement: Papers table schema
The papers table SHALL include the following columns: id, arxiv_id, corpus_id, title, authors, abstract, contents, pdf_path, metadata, link, created_at, updated_at.

The `link` column SHALL be a nullable text field storing the full URL to the paper's original source.

#### Scenario: Paper with link
- **WHEN** a paper is inserted with a link value
- **THEN** the link column SHALL store the provided URL string

#### Scenario: Paper without link
- **WHEN** a paper is inserted without a link value
- **THEN** the link column SHALL be null
