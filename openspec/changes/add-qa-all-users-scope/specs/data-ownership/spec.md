## MODIFIED Requirements

### Requirement: Owner-scoped reads
GET endpoints for highlights and tags SHALL remain owner-scoped. User/free QA SHALL default to rows owned by the current authenticated user (`scope=mine`) but every authenticated user MAY explicitly request `scope=all` to read all users' QA with asker attribution. Anonymous paper-QA reads SHALL return public preset QA and no user QA.

#### Scenario: Owner sees own data
- **WHEN** an authenticated user reads free QA with `scope=mine`, highlights, or tags
- **THEN** only rows owned by that user SHALL be returned

#### Scenario: Other users do not see it
- **WHEN** a user reads highlights or tags belonging to someone else
- **THEN** those private rows SHALL remain hidden
- **AND** other users' QA SHALL appear only after explicit `scope=all`

#### Scenario: Anonymous gets empty, not error
- **WHEN** an anonymous user reads a public owner-aware endpoint
- **THEN** the response SHALL remain HTTP 200 with public preset QA where applicable and empty private/user QA collections

## ADDED Requirements

### Requirement: All-scope QA remains read-only for non-owners
Reading another user's QA SHALL NOT grant mutation rights. User QA regeneration/deletion SHALL be limited to its owner or an administrator, and unauthorized mutation SHALL return 404 without changing data.

#### Scenario: Non-owner views another question
- **WHEN** a non-admin opens another user's QA through all scope
- **THEN** the question and results SHALL be readable but management actions SHALL be unavailable

#### Scenario: Non-owner calls mutation API
- **WHEN** that viewer directly calls regenerate or delete
- **THEN** the backend SHALL return 404 and make no change

