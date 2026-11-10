## Purpose

Make current Topic reference associations searchable through permission-scoped root tags, with legacy hierarchy compatibility, private manual tagging and historical content kept separate.

## ADDED Requirements

### Requirement: Source-aware hierarchical associations
Every Topic SHALL generate a root tag named for the Topic. Legacy directories SHALL retain stable Topic/directory tag identity and ancestor associations. New flat catalogs SHALL not require directories, and the reader SHALL use per-page reference subsets. Papers SHALL support multiple Topic/directory associations without relying on display names as identity.

#### Scenario: Rename or move a directory
- **WHEN** a directory is renamed or moved while retaining its ID
- **THEN** its tag identity SHALL remain stable and current ancestor filtering SHALL reflect the new tree

### Requirement: Permission-scoped generated tags
Generated Topic tags SHALL be visible/searchable only through the viewer's current Topic access, in a namespace distinct from private manual tags. Revoking access SHALL remove that viewer's Topic badge/filter visibility. Topic changes SHALL NOT create, rename, merge or delete private manual tags.

#### Scenario: Same display name as a manual tag
- **WHEN** a user has a manual tag named like a shared Topic
- **THEN** both SHALL retain independent identity and updating the Topic SHALL leave the manual tag and its associations unchanged

### Requirement: Root badges and descendant-inclusive search
Paper list/detail default badges SHALL show only each accessible Topic's root tag. Directory associations SHALL remain available for hierarchical filters. Root filtering SHALL include all papers in the Topic; a directory filter SHALL include that directory and descendants, combining with existing paper search, scope and manual tag filters.

#### Scenario: Paper in a deeply nested directory
- **WHEN** a paper belongs to a child directory
- **THEN** only the Topic root SHALL appear as its default Topic badge
- **AND** root, parent and child filters SHALL all include that paper

### Requirement: Latest index and historical presentation
Successful publication SHALL atomically replace only the generated associations sourced by that Topic's current version. Historical views SHALL render historical directories without mutating the current index. Unimported external entries SHALL remain in the list without creating phantom paper associations; explicit imports SHALL add current associations for the resolved paper.

#### Scenario: Remove an entry from one Topic
- **WHEN** a push removes a paper from a Topic
- **THEN** that Topic's obsolete associations SHALL disappear
- **AND** manual tags and other Topics' associations SHALL remain

#### Scenario: View an earlier directory tree
- **WHEN** a reader opens an old version
- **THEN** it SHALL show the earlier tree while normal paper filtering continues to use the latest published tree
