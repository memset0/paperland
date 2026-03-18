## ADDED Requirements

### Requirement: Prevent duplicate paper creation
The system SHALL maintain an in-memory Map of papers currently being initialized. Concurrent requests to create the same paper SHALL resolve to the same record.

#### Scenario: Concurrent creation with same arxiv_id
- **WHEN** two simultaneous requests try to create a paper with arxiv_id="1706.03762"
- **THEN** only one paper record SHALL be created, and both requests SHALL receive the same paper

#### Scenario: Corpus ID resolves to existing arxiv_id
- **WHEN** a paper is created via corpus_id, and the service resolves it to an arxiv_id that already exists
- **THEN** the system SHALL merge into the existing paper record instead of creating a duplicate

### Requirement: Dedup map cleanup
The dedup map entry SHALL be removed after paper creation completes (success or failure).

#### Scenario: Map cleanup after creation
- **WHEN** paper creation completes
- **THEN** the corresponding key SHALL be removed from the dedup map
