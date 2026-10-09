## MODIFIED Requirements

### Requirement: Owner-scoped reads
Reads of user-owned data SHALL follow the visibility class defined in the `data-sharing-preferences` capability. Always-private data (tags, the image-host list, API tokens, Q&A reading preferences) SHALL return only rows owned by the current authenticated user. Optionally-shared data (highlights, notes, free Q&A, reference links) SHALL default to rows owned by the current user (`scope=mine`); with an explicit `scope=all` a non-admin SHALL additionally receive other users' rows whose owner shares that data type (plus published notes), and an admin SHALL receive every user's rows. Anonymous reads SHALL return public preset Q&A and published notes where applicable and an empty set for other user-owned collections, with HTTP 200 (not 401) on public endpoints.

#### Scenario: Owner sees own data
- **WHEN** an authenticated user reads tags, or reads highlights, notes, free Q&A, or reference links with `scope=mine`
- **THEN** only rows owned by that user SHALL be returned

#### Scenario: Other users do not see it
- **WHEN** a user reads tags, or reads optionally-shared data with `scope=all` while its owner's switch for that type is off
- **THEN** a non-admin SHALL NOT receive those rows

#### Scenario: Shared data visible in all scope
- **WHEN** a non-admin reads free Q&A with `scope=all` and another user shares Q&A
- **THEN** that user's free Q&A SHALL be returned with `user_id` and `username`

#### Scenario: Anonymous gets empty, not error
- **WHEN** an anonymous client reads a public owner-aware endpoint (e.g. `GET /api/highlights`)
- **THEN** the response SHALL be HTTP 200 with public preset Q&A or published notes where applicable and empty private/user collections

### Requirement: QA Result streams follow entry visibility
An authenticated viewer SHALL be allowed to subscribe only to a Result whose parent QA entry is visible to that viewer through the `all`-scope read rules: preset entries, the viewer's own free entries, free entries of users who share Q&A, and — for an admin — every free entry. Anonymous viewers SHALL NOT open Result SSE streams, and a denied request SHALL NOT disclose whether a private Result exists.

#### Scenario: Viewer subscribes to a visible all-scope Result
- **WHEN** a logged-in viewer can read another user's free QA entry through all scope
- **THEN** the viewer MAY observe that Result stream but SHALL receive no mutation authority

#### Scenario: Viewer denied a non-shared Result
- **WHEN** a non-admin requests the stream of a Result whose free entry belongs to a user who does not share Q&A
- **THEN** the request SHALL be rejected as not found

#### Scenario: Anonymous viewer requests a stream
- **WHEN** an anonymous viewer requests a Result SSE stream, including for a preset entry
- **THEN** the request SHALL be rejected before opening the stream
