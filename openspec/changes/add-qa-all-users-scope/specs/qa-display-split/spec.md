## MODIFIED Requirements

### Requirement: Preset QA is public, User QA is owner-scoped
On the paper detail page, Preset Q&A SHALL remain public. For authenticated users, the User Q&A card SHALL default to `mine` and provide `all` to show every user's entries for that paper. All-scope entries SHALL display asker identity. Anonymous users SHALL see no User Q&A. Another user's entry SHALL be read-only for non-admin viewers.

#### Scenario: Anonymous visitor sees only template QA
- **WHEN** an anonymous visitor opens a paper with preset and user QA
- **THEN** Preset Q&A SHALL be visible and User Q&A SHALL contain no entries

#### Scenario: User sees only their own free QA
- **WHEN** an authenticated user opens a paper or selects `mine`
- **THEN** only that user's User Q&A entries SHALL be displayed

#### Scenario: Another user's free QA hidden
- **WHEN** the viewer remains in `mine`
- **THEN** other users' entries SHALL remain hidden
- **AND WHEN** the viewer explicitly selects `all`
- **THEN** those entries SHALL appear with asker labels and read-only actions as applicable

## ADDED Requirements

### Requirement: Paper User QA scope selector
The User Q&A card SHALL provide an accessible mine/all selector to authenticated viewers. Changing scope SHALL refetch the current paper, keep Preset Q&A unchanged, and preserve the selected scope while the paper detail view remains mounted.

#### Scenario: Switch to all on a paper
- **WHEN** the viewer selects `all`
- **THEN** the card SHALL reload all User Q&A for that paper without changing Preset Q&A

#### Scenario: Asker identity
- **WHEN** an all-scope entry is rendered
- **THEN** it SHALL visibly identify the asker by username when resolvable

