## MODIFIED Requirements

### Requirement: Source column display in paper list
The paper list SHALL display a "Source" column replacing the current "arXiv ID" column, showing clickable source tags.

#### Scenario: arXiv paper source display
- **WHEN** a paper has a link matching `arxiv.org` domain
- **THEN** the system SHALL display a red tag with text `arxiv:{arxiv_id}` that links to the paper's link URL

#### Scenario: Non-arXiv paper source display
- **WHEN** a paper has a link that does not match `arxiv.org`
- **THEN** the system SHALL display a gray tag with the link's domain name (e.g., `mem.ac`) that links to the paper's link URL

#### Scenario: Paper without source
- **WHEN** a paper has no link (null)
- **THEN** the system SHALL display `-`
