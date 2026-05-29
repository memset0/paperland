# paper-list-citation-metrics Specification

## Purpose
TBD - created by archiving change add-citation-counts-and-id-sync. Update Purpose after archive.
## Requirements
### Requirement: Paper list shows citation and reference counts
The paper list table SHALL display, for each paper, its citation count (the number of papers that cite it) and its reference count (the number of papers it cites), sourced from the paper's `metadata`. The citation count SHALL come from `metadata.citation_count`; the reference count SHALL come from `metadata.reference_count`, falling back to the length of `metadata.references` when `reference_count` is absent (for papers enriched before `reference_count` was captured). The two metrics SHALL be presented in two dedicated, independent table columns (one for the citation/cited-by count and one for the reference count), not combined into a single cell. Labels/affordances MAY be in English.

#### Scenario: Counts shown when enrichment is present
- **WHEN** a paper's metadata contains `citation_count` 1234 and `reference_count` 56
- **THEN** the list row SHALL show 1234 as the citation (cited-by) count in the citations column and 56 as the reference count in the references column (two separate columns)

#### Scenario: Reference count falls back to references length
- **WHEN** a paper's metadata has no `reference_count` but has a `references` array of length 40
- **THEN** the list row SHALL show 40 as the reference count

#### Scenario: Zero is shown distinctly from unknown
- **WHEN** a paper is enriched and its `citation_count` is 0
- **THEN** the list row SHALL show 0 (not a placeholder), because the value is known to be zero

### Requirement: Graceful display when metrics are unavailable
When a paper has no citation/reference enrichment in its `metadata` (e.g. a manually-added paper or one not yet enriched), the corresponding metric SHALL render a neutral placeholder rather than `0` or empty, so an unknown value is visually distinct from a known zero. Large counts SHALL be rendered with locale thousands separators for readability.

#### Scenario: Placeholder when metric is absent
- **WHEN** a paper's metadata has no `citation_count` (and/or no reference data)
- **THEN** the corresponding metric in the list row SHALL render a neutral placeholder (e.g. `–`)

#### Scenario: Thousands separators on large counts
- **WHEN** a paper's `citation_count` is 45000
- **THEN** the displayed value SHALL include locale thousands separators (e.g. `45,000`)

