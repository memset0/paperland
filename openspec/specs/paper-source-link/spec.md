# paper-source-link Specification

## Purpose
论文来源链接功能 — 包括 link 字段的存储、自动生成、数据回填、前端来源标签展示。

## Requirements

### Requirement: Paper link field storage
The system SHALL store an optional `link` field on each paper, containing the full URL to the paper's original source.

#### Scenario: Paper created with link
- **WHEN** a paper is created via API with a `link` parameter
- **THEN** the paper's `link` field SHALL be set to the provided URL

#### Scenario: Paper created without link
- **WHEN** a paper is created without a `link` parameter
- **THEN** the paper's `link` field SHALL be null

### Requirement: Automatic arXiv link generation
The system SHALL automatically set the `link` field to `https://arxiv.org/abs/{arxiv_id}` for papers with an arxiv_id, when link is empty.

#### Scenario: arXiv service sets link
- **WHEN** the arxiv_service executes for a paper with arxiv_id and the paper's link is null
- **THEN** the system SHALL set link to `https://arxiv.org/abs/{arxiv_id}`

#### Scenario: arXiv service does not overwrite existing link
- **WHEN** the arxiv_service executes for a paper that already has a non-null link
- **THEN** the system SHALL NOT modify the existing link

### Requirement: Existing data backfill
The system SHALL backfill link for all existing papers that have arxiv_id but no link.

#### Scenario: Migration backfill
- **WHEN** the database migration runs
- **THEN** all papers with non-null arxiv_id and null link SHALL have link set to `https://arxiv.org/abs/{arxiv_id}`

### Requirement: Manual paper creation with link
The frontend manual paper creation form SHALL include an optional link input field.

#### Scenario: User creates paper with link
- **WHEN** a user fills in the manual creation form with a title and a link URL
- **THEN** the created paper SHALL have the provided link stored

#### Scenario: User creates paper without link
- **WHEN** a user fills in the manual creation form without a link
- **THEN** the created paper SHALL have a null link

### Requirement: Source column display in paper list
The paper list SHALL display a "来源" (Source) column replacing the current "arXiv ID" column, showing clickable source tags.

#### Scenario: arXiv paper source display
- **WHEN** a paper has a link matching `arxiv.org` domain
- **THEN** the system SHALL display a red tag with text `arxiv:{arxiv_id}` that links to the paper's link URL

#### Scenario: Non-arXiv paper source display
- **WHEN** a paper has a link that does not match `arxiv.org`
- **THEN** the system SHALL display a gray tag with the link's domain name (e.g., `mem.ac`) that links to the paper's link URL

#### Scenario: Paper without source
- **WHEN** a paper has no link (null)
- **THEN** the system SHALL display `-`

### Requirement: Internal API link support
The `POST /api/papers` endpoint SHALL accept an optional `link` string parameter.

#### Scenario: Create paper with link via internal API
- **WHEN** a client sends `POST /api/papers` with `{ "title": "My Paper", "link": "https://example.com/paper" }`
- **THEN** the created paper SHALL have link set to `https://example.com/paper`

### Requirement: External API link support
The `POST /external-api/v1/papers` and `POST /external-api/v1/papers/batch` endpoints SHALL accept an optional `link` string parameter.

#### Scenario: Create paper with link via external API
- **WHEN** a client sends `POST /external-api/v1/papers` with `{ "title": "My Paper", "link": "https://example.com/paper" }`
- **THEN** the created paper SHALL have link set to `https://example.com/paper`

#### Scenario: Batch create papers with link
- **WHEN** a client sends `POST /external-api/v1/papers/batch` with papers containing `link` fields
- **THEN** each created paper SHALL have its respective link stored
