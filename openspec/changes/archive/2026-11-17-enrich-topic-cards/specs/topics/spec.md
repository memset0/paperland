# Spec Delta

## MODIFIED Requirements

### Requirement: Topics list layout
The web Topics list SHALL show each Topic as a shadcn card with a monogram tile in a stable per-Topic color, the title, the description clamped to two lines (space reserved when empty), the Archived badge or the reader's role when it is not Owner, and a footer with page count, reference count, owner and last update. Cards in a row SHALL have equal heights. Mine/All and search SHALL be above the cards. Active and archived Topics SHALL be on separate "Active" and "Archived (N)" tabs. While loading, skeleton cards SHALL be shown. Each tab SHALL have its own empty state.

#### Scenario: Archived Topics on their own tab
- **WHEN** a reader opens the Topics list and one listed Topic is archived
- **THEN** it SHALL appear only on the "Archived (1)" tab and not among the active cards

#### Scenario: Search across tabs
- **WHEN** a reader searches and matches exist only among archived Topics
- **THEN** the Archived tab count SHALL reflect the matches and the Active tab SHALL say no active topics match

#### Scenario: Card shows the Topic's size
- **WHEN** a Topic's published version has 13 pages and 98 references
- **THEN** its card SHALL show "13 pages" and "98 references"

## ADDED Requirements

### Requirement: Topic summary counts
Topic summaries returned by the Topic list API and MCP `list_topics` SHALL include `page_count` (documents in the published version) and `reference_count` (entries in its reference catalog), both 0 when nothing is published.

#### Scenario: Counts in the list API
- **WHEN** a reader lists Topics and one Topic's published version has 2 pages and 3 references
- **THEN** that summary SHALL have `page_count` 2 and `reference_count` 3
