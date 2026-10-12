## ADDED Requirements

### Requirement: Feed QA reading indicators
The QA feed SHALL display the same current-viewer indicators as PaperDetail. A feed page SHALL obtain counts without separate highlight/note requests per card.

#### Scenario: Load a feed page
- **WHEN** up to page_size entries across several papers load
- **THEN** counts SHALL be batched by the page's entries/papers and rendered on each collapsed card

#### Scenario: Cross-surface consistency
- **WHEN** the same entry appears on PaperDetail and feed
- **THEN** both surfaces SHALL show the same current-viewer counts after refresh

