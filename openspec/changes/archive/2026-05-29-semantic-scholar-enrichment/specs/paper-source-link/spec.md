## ADDED Requirements

### Requirement: Semantic Scholar source tag
The paper list and the paper detail view SHALL display a clickable Semantic Scholar source tag when the paper has a `corpus_id`, shown alongside the arXiv source tag. The tag SHALL link to the paper's Semantic Scholar page (using the stored `metadata.s2_url` when present, otherwise `https://www.semanticscholar.org/paper/CorpusID:{corpus_id}`) and open in a new tab.

#### Scenario: Paper with corpus_id shows S2 tag in the list
- **WHEN** a paper in the list has a non-null corpus_id
- **THEN** the list SHALL render a clickable Semantic Scholar tag next to the arXiv source tag, linking to the paper's S2 page

#### Scenario: Paper with corpus_id shows S2 tag in detail
- **WHEN** the paper detail view is shown for a paper with a non-null corpus_id
- **THEN** the detail view SHALL render a clickable Semantic Scholar tag (replacing the previous non-clickable "Corpus: {id}" badge)

#### Scenario: Paper without corpus_id
- **WHEN** a paper has no corpus_id
- **THEN** no Semantic Scholar tag SHALL be rendered
