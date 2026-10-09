## MODIFIED Requirements

### Requirement: Paper list shows citation and reference counts
The paper list table SHALL display, for each paper, its citation count (the number of papers that cite it) and its reference count (the number of papers it cites), sourced from the paper's `metadata`. The citation count SHALL come from `metadata.citation_count`; the reference count SHALL come from `metadata.reference_count`. For papers enriched before `reference_count` was captured, the list API SHALL fill `reference_count` from the length of the stored `references` array, so the list does not need the full references. The two metrics SHALL be presented in two dedicated, independent table columns (one for the citation/cited-by count and one for the reference count), not combined into a single cell. Labels/affordances MAY be in English.

#### Scenario: Counts shown when enrichment is present
- **WHEN** a paper's metadata contains `citation_count` 1234 and `reference_count` 56
- **THEN** the list row SHALL show 1234 as the citation (cited-by) count in the citations column and 56 as the reference count in the references column (two separate columns)

#### Scenario: Reference count falls back to references length
- **WHEN** a paper's stored metadata has no `reference_count` but has a `references` array of length 40
- **THEN** the list API SHALL return `reference_count` 40 and the list row SHALL show 40 as the reference count

#### Scenario: Zero is shown distinctly from unknown
- **WHEN** a paper is enriched and its `citation_count` is 0
- **THEN** the list row SHALL show 0 (not a placeholder), because the value is known to be zero
