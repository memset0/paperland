## ADDED Requirements

### Requirement: Template QA is public, Free QA is owner-scoped
On the paper detail page, the Template Q&A card SHALL be visible to everyone, including anonymous visitors. The Free Q&A card SHALL display only the current authenticated user's free QA entries; anonymous visitors and other users SHALL NOT see a user's free QA entries.

#### Scenario: Anonymous visitor sees only template QA
- **WHEN** an anonymous visitor opens a paper detail page that has both template and free QA
- **THEN** the Template Q&A card SHALL be shown with its results, and the Free Q&A card SHALL show no entries

#### Scenario: User sees only their own free QA
- **WHEN** an authenticated user opens a paper detail page
- **THEN** the Free Q&A card SHALL show only that user's free QA entries for the paper

#### Scenario: Another user's free QA hidden
- **WHEN** user B opens a paper for which user A created free QA entries
- **THEN** user B SHALL NOT see user A's free QA entries

### Requirement: QA generation requires login
Triggering any LLM action on the paper detail page — generating or regenerating template Q&A, submitting a free question, regenerating, or deleting a result — SHALL require an authenticated user. For anonymous visitors these controls SHALL prompt for login rather than initiate an LLM call.

#### Scenario: Anonymous user attempts to generate template QA
- **WHEN** an anonymous visitor activates the "一键生成" or a single template generate control
- **THEN** the system SHALL prompt for login and SHALL NOT trigger any LLM call

#### Scenario: Anonymous user attempts a free question
- **WHEN** an anonymous visitor attempts to submit a free question
- **THEN** the system SHALL prompt for login and SHALL NOT create a QA entry

#### Scenario: Authenticated user generates normally
- **WHEN** an authenticated user triggers template or free QA
- **THEN** the system SHALL proceed, attributing the free QA entry to that user
