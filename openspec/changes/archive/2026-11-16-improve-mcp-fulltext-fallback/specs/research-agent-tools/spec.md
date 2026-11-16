# Spec Delta

## MODIFIED Requirements

### Requirement: Site paper tools
The MCP server SHALL provide:
- `search_papers(query, limit?)`: listed papers whose title, authors, or abstract contain every whitespace-separated term of `query` (case-insensitive), at most `limit` results (default 10, capped by `agent_tools.search_max_results`). Each result SHALL include the paper id, title, up to five authors, year, venue, S2 paperId and CorpusId, arXiv id, whether readable full text exists, whether the paper is in the caller's personal library, and its in-app link `paperland://paper/<id>`.
- `get_paper(paper_id)`: the paper's title, authors, abstract, year, venue, external ids, tags, source link, in-app link, whether it is in the caller's library, the full-text source, length and `precision` when available, `precise_pending`, and its PDF status (`pdf_status`: available, fetching or upload_required). It SHALL work for any paper id, listed or not.
- `read_paper(paper_id, offset?, max_chars?)`: the paper's full text chosen by `content_priority` (the same text Q&A uses), returning `text`, `offset`, `total_chars`, `source`, `precision` (`precise` for user input or doc2x Markdown, `rough` for any other PDF-derived text), `precise_pending` (true while a doc2x parse is eligible and has neither produced text nor failed), and `next_offset` (null at the end). Every `rough` result SHALL include a `note` saying the text may garble layout, formulas and tables, and that the agent should call `read_paper` again on the user's next question to get the precise text; when `precise_pending` is true the note SHALL say a precise version is in progress. When no stored text exists but the paper's local PDF is readable, it SHALL extract the whole PDF's text on the fly with the configured local PDF tools (same limits, timeout and concurrency as `read_pdf_page`), with `source` `pdf_text` and `precision` `rough`. When neither stored text nor a readable local PDF exists, it SHALL return a non-error result with `status` `not_ready`, `text` null, the PDF status, the abstract, for arXiv papers the links `https://arxiv.org/html/<arxiv_id>` and `https://arxiv.org/abs/<arxiv_id>`, and a `note` telling the agent to use the abstract or those links now and call `read_paper` again on the user's next question. `max_chars` SHALL default to and be capped by `agent_tools.read_max_chars`. With `outline: true` it SHALL instead return the Markdown headings (level, title, character offset) outside code blocks.
- `get_paper_qa(paper_id, max_chars_per_answer?)`: the Q&A entries of the paper visible to the caller under the existing Q&A sharing rules (template entries and free entries whose owner is the caller or shares Q&A), each with its question, entry type, and its latest done, non-deleted answer (model name, completion time, answer truncated to `max_chars_per_answer`, default and cap `agent_tools.qa_answer_max_chars`), newest first, at most 20 entries.

#### Scenario: Read a long paper in pages
- **WHEN** an agent calls `read_paper` with offset 0 on a paper whose text is 50,000 characters and `read_max_chars` is 20,000
- **THEN** it SHALL receive the first 20,000 characters with `next_offset` 20000 and `total_chars` 50000

#### Scenario: Paper without full text
- **WHEN** `read_paper` is called for an arXiv paper with no stored text and no local PDF yet
- **THEN** the result SHALL NOT be a tool error and SHALL contain `status` `not_ready`, the PDF status, the abstract, the arXiv HTML and abstract links, and a note to re-check on the user's next question

#### Scenario: Rough text from the PDF while parsing is queued
- **WHEN** `read_paper` is called for a paper whose local PDF exists but whose parsed text is not stored yet
- **THEN** it SHALL return paginated text extracted from the PDF with `source` `pdf_text`, `precision` `rough` and a note to re-check on the user's next question

#### Scenario: Rough stored text while doc2x is pending
- **WHEN** a paper has `pdf_parsed` text and its doc2x parse is eligible but has not finished
- **THEN** `read_paper` SHALL return that text with `precision` `rough`, `precise_pending` true and a note that a precise version is in progress

#### Scenario: Precise text
- **WHEN** a paper has doc2x Markdown or user-provided text chosen by `content_priority`
- **THEN** `read_paper` SHALL return it with `precision` `precise`, `precise_pending` false and no re-check note

#### Scenario: Private Q&A is not exposed
- **WHEN** another user's free Q&A entry exists on the paper and that user does not share Q&A
- **THEN** `get_paper_qa` for the caller SHALL NOT include it
