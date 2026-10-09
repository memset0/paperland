## ADDED Requirements

### Requirement: S2 paper cache table
The database SHALL have an `s2_papers` table caching Semantic Scholar metadata independently of the `papers` table, with columns: `id` (integer primary key), `s2_paper_id` (text, unique, nullable), `corpus_id` (text, unique, nullable), `arxiv_id`, `doi`, `title`, `authors` (JSON array of names), `year`, `venue`, `abstract`, `tldr`, `citation_count`, `influential_citation_count`, `reference_count`, `publication_date`, `url`, `open_access_pdf_url` (all nullable), `status` (`ok` | `not_found`, not null), `fetched_at` (not null), `created_at` (not null). A row SHALL have at least one of `s2_paper_id` or `corpus_id`. Deleting papers SHALL NOT affect this table. The table SHALL be created by an additive migration.

#### Scenario: Cache row for an unlisted paper
- **WHEN** metadata for a paper not in the library is fetched from S2
- **THEN** an `s2_papers` row with `status = ok` and both ids SHALL exist, and no `papers` row SHALL be created

#### Scenario: Paper deletion leaves cache intact
- **WHEN** a library paper is deleted
- **THEN** `s2_papers` rows SHALL remain unchanged

## MODIFIED Requirements

### Requirement: Papers table
The database SHALL have a `papers` table with columns: `id` (integer, primary key, autoincrement), `arxiv_id` (text, nullable, unique), `corpus_id` (text, nullable, unique), `title` (text, not null), `authors` (text, not null, JSON array), `abstract` (text, nullable), `contents` (text, nullable, JSON object), `pdf_path` (text, nullable), `metadata` (text, nullable, JSON), `link` (text, nullable), `created_at` (text, not null, ISO 8601), `updated_at` (text, not null, ISO 8601).

Deletion of a paper SHALL be performed via application-level cascade within a single database transaction. The application SHALL delete all related records from `qa_results` (via `qa_entries`, including soft-deleted results), `qa_entries`, `service_executions`, `paper_tags`, and `highlights` (matched by `pdf_path`) before deleting the paper record. No database-level ON DELETE CASCADE constraints are required.

#### Scenario: Create paper with arxiv_id
- **WHEN** a paper is inserted with arxiv_id "2401.12345" and title "Test Paper"
- **THEN** the paper SHALL be stored and retrievable by id or arxiv_id, with `updated_at` set equal to `created_at`

#### Scenario: Unique constraint on arxiv_id
- **WHEN** a paper with arxiv_id "2401.12345" already exists and another insert attempts the same arxiv_id
- **THEN** the database SHALL reject the insert with a unique constraint violation

#### Scenario: Contents stored as JSON
- **WHEN** a paper is inserted with contents `{"user_input": "some text", "pdf_parsed": null}`
- **THEN** the contents field SHALL store the JSON string and it SHALL be parseable back to the original object

#### Scenario: Cascade delete paper and all associations
- **WHEN** a paper with id 5 is deleted and it has qa_entries, qa_results, service_executions, paper_tags, and highlights
- **THEN** all associated records SHALL be deleted within the same transaction before the paper record is removed
- **AND** the transaction SHALL either fully complete or fully roll back on error

## REMOVED Requirements

### Requirement: QA result citations table
**Reason**: 引用关系以回答 Markdown 为唯一来源，`#cite:` 的 S2 元数据由 `s2_papers` 缓存（回答完成时预热）提供；`qa_result_cites` 只是按论文过滤的派生副本，且与「cite 独立于所属论文」的原则冲突。
**Migration**: 迁移 `0033_drop_qa_result_cites` 删除该表；需要某回答的引用时从其 Markdown 中提取 `#cite:` 链接。
