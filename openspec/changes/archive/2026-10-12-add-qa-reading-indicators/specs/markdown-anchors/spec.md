## ADDED Requirements

### Requirement: Derive note anchors by QA entry
For an authenticated viewer, the system SHALL parse block-target `paperland://` links in that viewer's note for the paper and count links whose `h` resolves to a QA result content hash. Each link occurrence SHALL contribute once to the owning entry. It SHALL NOT persist a separate anchor table or counter.

#### Scenario: Repeated links
- **WHEN** a note links to answers under one entry three times
- **THEN** that entry's note anchor count SHALL be three

#### Scenario: Ignore non-QA target
- **WHEN** a link is PDF, paper-only, stale, cross-paper, or points to non-QA Markdown
- **THEN** it SHALL not contribute

#### Scenario: Ambiguous hash across entries
- **WHEN** one hash maps to more than one QA entry
- **THEN** the link SHALL not be assigned arbitrarily

#### Scenario: No current-user note
- **WHEN** the viewer has no note for the paper
- **THEN** all note anchor counts SHALL be zero

