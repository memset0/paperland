## MODIFIED Requirements

### Requirement: Highlight data model
The system SHALL store highlights in a `highlights` table with fields: `id`, `user_id`, `pathname`, `content_hash`, `start_offset`, `end_offset`, `text`, `color`, `note`, `created_at`. The `user_id` SHALL reference `users.id` and identify the owner of the highlight.

#### Scenario: Highlight record structure
- **WHEN** a highlight is created
- **THEN** the record SHALL contain `user_id` (owner), `pathname` (page path without hostname), `content_hash` (MD5 of content with all whitespace removed), `start_offset` and `end_offset` (rendered text offsets), `text` (highlighted text for verification), `color` (one of yellow/green/blue/pink), `note` (nullable), and `created_at` timestamp

### Requirement: Batch query highlights by pathname
The system SHALL provide `GET /api/highlights?pathname=<path>` that returns the current user's highlights for the given page path in a single request. The result SHALL be scoped to the authenticated user; anonymous requests SHALL return an empty list with HTTP 200.

#### Scenario: Load all highlights for a page
- **WHEN** an authenticated user loads a page at pathname `/papers/42`
- **THEN** a single `GET /api/highlights?pathname=/papers/42` request SHALL return all of that user's highlights for that page, across all content_hash values

#### Scenario: No highlights for page
- **WHEN** `GET /api/highlights?pathname=/papers/42` is called and the current user has no highlights there
- **THEN** the response SHALL return `{ "data": [] }`

#### Scenario: Anonymous user sees no highlights
- **WHEN** an anonymous client calls `GET /api/highlights?pathname=/papers/42`
- **THEN** the response SHALL return `{ "data": [] }` with HTTP 200

### Requirement: Create highlight
The system SHALL provide `POST /api/highlights` to create a new highlight record owned by the current authenticated user. Anonymous requests SHALL be rejected with 401.

#### Scenario: Create highlight with note
- **WHEN** an authenticated user sends a POST request with `{ pathname, content_hash, start_offset, end_offset, text, color, note }`
- **THEN** the system SHALL create the highlight record with `user_id` set to that user and return it with the assigned `id` and `created_at`

#### Scenario: Create highlight without note
- **WHEN** an authenticated user sends a POST request with `note` as null
- **THEN** the system SHALL create the highlight record with note as null, owned by that user

#### Scenario: Anonymous create rejected
- **WHEN** an anonymous client sends `POST /api/highlights`
- **THEN** the system SHALL respond with 401 and create nothing

### Requirement: Update highlight
The system SHALL provide `PUT /api/highlights/:id` to update a highlight's color or note, only when the highlight belongs to the current authenticated user.

#### Scenario: Update highlight color
- **WHEN** the owner sends a PUT request with `{ color: "green" }`
- **THEN** the highlight's color SHALL be updated to green

#### Scenario: Update highlight note
- **WHEN** the owner sends a PUT request with `{ note: "important finding" }`
- **THEN** the highlight's note SHALL be updated

#### Scenario: Update another user's highlight rejected
- **WHEN** a user sends `PUT /api/highlights/:id` for a highlight owned by a different user (or is anonymous)
- **THEN** the system SHALL respond 404 (not owner) or 401 (anonymous) and SHALL NOT modify it

### Requirement: Delete highlight
The system SHALL provide `DELETE /api/highlights/:id` to delete a highlight, only when it belongs to the current authenticated user.

#### Scenario: Delete existing highlight
- **WHEN** the owner sends a DELETE request for one of their highlight IDs
- **THEN** the highlight record SHALL be removed and the corresponding `<mark>` element SHALL be removed from the DOM

#### Scenario: Delete another user's highlight rejected
- **WHEN** a user sends `DELETE /api/highlights/:id` for a highlight owned by a different user (or is anonymous)
- **THEN** the system SHALL respond 404 (not owner) or 401 (anonymous) and SHALL NOT delete it

## ADDED Requirements

### Requirement: Highlights are owner-scoped
Highlights SHALL be private to their owner. Reads SHALL return only the current user's highlights, and only the owner SHALL be able to create, update, or delete a highlight. Anonymous users SHALL neither see nor create highlights.

#### Scenario: Highlights not shared between users
- **WHEN** user A highlights text on `/papers/42` and user B opens the same page
- **THEN** user B SHALL NOT see user A's highlights, and vice versa

#### Scenario: Anonymous viewer sees no highlights and cannot create
- **WHEN** an anonymous visitor opens a paper or QA page
- **THEN** no highlights SHALL be rendered, and attempting to create a highlight SHALL prompt for login
