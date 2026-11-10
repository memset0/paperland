## MODIFIED Requirements

### Requirement: Tags are isolated per user
Manual tags SHALL be isolated per user. The `tags` uniqueness constraint SHALL be `(user_id, name)`, so two different users MAY each have a tag with the same name. A paper's manual `paper_tags` associations are owned via their tag's `user_id`. Displayed manual tags SHALL be only the current user's tags; anonymous users SHALL see none. Generated Topic tags SHALL use a separate source-aware namespace and be visible only through effective Topic access (per-Topic default policy and individual grants, with effective permission taking the higher of general and individual access), without exposing any owner's private manual tags.

#### Scenario: Two users with the same tag name
- **WHEN** user A and user B each create a tag named "ML"
- **THEN** both tags SHALL exist as distinct rows owned by their respective users

#### Scenario: Paper list shows only current user's tags
- **WHEN** an authenticated user views the paper list or a paper detail page
- **THEN** each paper SHALL display only that user's manual tags applied to it, plus root badges for Topics the viewer can access

#### Scenario: Anonymous sees no tags
- **WHEN** an anonymous user views the paper list or a paper detail page
- **THEN** no manual or Topic tags SHALL be displayed on any paper

#### Scenario: Shared Topic does not expose private tags
- **WHEN** a user gains access to a Topic
- **THEN** its generated tags SHALL be available without revealing the owner's unrelated manual tag set
