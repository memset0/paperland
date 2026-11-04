## ADDED Requirements

### Requirement: Semantic Scholar supplies basic fields and abstract
When enriching a paper, `semantic_scholar_service` SHALL populate the paper's basic fields (`title`, `authors`) and `abstract` from the Semantic Scholar response when those fields are empty. This makes Semantic Scholar the primary metadata source, so a metadata-only (`listed=false`) paper has complete textual information without any arxiv fetch.

#### Scenario: S2 fills empty basic fields and abstract
- **WHEN** `semantic_scholar_service` runs for a paper whose `abstract`/`authors`/`title` are empty and Semantic Scholar returns them
- **THEN** those fields SHALL be filled from the Semantic Scholar response

#### Scenario: S2 does not overwrite existing fields
- **WHEN** the paper already has a non-empty `abstract`
- **THEN** Semantic Scholar SHALL NOT overwrite it

### Requirement: Semantic Scholar runs for metadata-only papers
`semantic_scholar_service` SHALL NOT be `requires_listed`; it SHALL run for `listed=false` papers, providing ids, the citation graph, basic fields, and abstract before any promotion.

#### Scenario: S2 enriches a metadata-only paper
- **WHEN** a `listed=false` paper is ingested with an `arxiv_id`/`corpus_id`
- **THEN** `semantic_scholar_service` SHALL run and produce its enrichment (corpus_id, citation graph, basic fields, abstract)
