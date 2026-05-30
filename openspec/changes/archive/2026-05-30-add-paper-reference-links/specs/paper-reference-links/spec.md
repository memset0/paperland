## ADDED Requirements

### Requirement: Per-user reference link list per paper
The system SHALL let each user maintain a private list of reference links for each paper, keyed by `(user_id, paper_id)`. A user's reference links for a paper SHALL be visible only to that user and SHALL NOT be affected by other users' reference links on the same paper. Each link SHALL be stored as its own row carrying a stable `id`, the owning `user_id`, the `paper_id`, and `created_at`/`updated_at` timestamps.

#### Scenario: Links are private to the owner
- **WHEN** user A adds a reference link to paper 123 and user B requests paper 123's reference links
- **THEN** user B's list SHALL NOT include user A's link

#### Scenario: Links are scoped per paper
- **WHEN** a user requests the reference links for a given paper
- **THEN** the system SHALL return only that user's links for that paper, and no links belonging to other papers

#### Scenario: Removing a paper removes its reference links
- **WHEN** a paper is deleted
- **THEN** all reference links belonging to that paper (across all users) SHALL be removed

### Requirement: Reference link fields
Each reference link SHALL have a `title` (required), a `url` (required), and a `description` (optional). The `url` SHALL be a syntactically valid absolute URL whose scheme is `http` or `https`. The `title` SHALL be non-empty after trimming. The `description` MAY be omitted, `null`, or empty, all of which SHALL be stored as "no description" (`null`).

#### Scenario: Valid link with all fields
- **WHEN** a user submits a link with a non-empty title, an `https://` url, and a description
- **THEN** the system SHALL store the link with all three fields

#### Scenario: Description omitted
- **WHEN** a user submits a link with only a title and url and no description
- **THEN** the system SHALL store the link with a null description and SHALL NOT reject it

#### Scenario: Missing or empty required field rejected
- **WHEN** a user submits a link with an empty/whitespace title, or with a missing/empty url
- **THEN** the system SHALL reject the request with a 400 error and SHALL NOT create a link

#### Scenario: Non-http(s) url rejected
- **WHEN** a user submits a link whose url is not a valid absolute http/https URL (e.g. `javascript:alert(1)` or `not a url`)
- **THEN** the system SHALL reject the request with a 400 error

### Requirement: Create, update, and delete reference links
The system SHALL expose authenticated endpoints to create, update, and delete a user's reference links. Creating SHALL be done via `POST /api/papers/:id/reference-links`; updating via `PATCH /api/reference-links/:id`; deleting via `DELETE /api/reference-links/:id`. All three SHALL require an authenticated user. Update and delete SHALL operate only on links owned by the requesting user; a link that does not exist or is not owned by the requester SHALL respond `404`. Update SHALL apply only the provided fields, SHALL validate any provided `title`/`url` under the same rules as creation, and SHALL refresh `updated_at`.

#### Scenario: Create a link
- **WHEN** an authenticated user POSTs a valid `{ title, url, description? }` to `/api/papers/:id/reference-links`
- **THEN** the system SHALL create the link owned by that user for that paper and respond `201` with the created link

#### Scenario: Update a subset of fields
- **WHEN** an authenticated owner PATCHes `/api/reference-links/:id` with only `{ title }`
- **THEN** the system SHALL update just the title, leave url and description unchanged, refresh `updated_at`, and return the updated link

#### Scenario: Delete a link
- **WHEN** an authenticated owner DELETEs `/api/reference-links/:id`
- **THEN** the system SHALL remove the link and report success

#### Scenario: Mutating another user's link is rejected
- **WHEN** an authenticated user PATCHes or DELETEs a `/api/reference-links/:id` they do not own
- **THEN** the system SHALL respond `404` and SHALL NOT modify the link

#### Scenario: Unauthenticated mutation rejected
- **WHEN** an unauthenticated request attempts to create, update, or delete a reference link
- **THEN** the system SHALL reject it with an authentication error and SHALL NOT modify any data

### Requirement: List reference links
The system SHALL expose `GET /api/papers/:id/reference-links` returning the requesting user's reference links for that paper, ordered by `created_at` ascending (insertion order) with `id` as a tiebreaker. For an unauthenticated request the endpoint SHALL return an empty list rather than an error.

#### Scenario: List in insertion order
- **WHEN** an authenticated user has added several links to a paper and requests the list
- **THEN** the system SHALL return that user's links for that paper ordered oldest-first

#### Scenario: Anonymous list is empty
- **WHEN** an unauthenticated client requests a paper's reference links
- **THEN** the system SHALL respond with an empty list and no error

### Requirement: Reference links section in the paper detail page
The paper detail page SHALL present a "参考链接" section that lists the current user's reference links for the paper and provides controls to add, edit, and delete them. Each link's `title` SHALL render as a hyperlink to its `url` that opens in a new tab with `rel="noopener noreferrer"`; the optional `description`, when present, SHALL render as secondary text beneath the title. After a successful add/edit/delete the displayed list SHALL reflect the change without a full page reload.

#### Scenario: Render links with titles and descriptions
- **WHEN** the paper detail page loads for a user who has reference links on the paper
- **THEN** each link SHALL appear as a clickable title (opening the url in a new tab) with its description shown as secondary text when present

#### Scenario: Add a link from the UI
- **WHEN** the user fills the add form with a title and url (description optional) and submits
- **THEN** the new link SHALL be created and appear in the list without a full page reload

#### Scenario: Edit and delete from the UI
- **WHEN** the user edits a link's fields and saves, or deletes a link
- **THEN** the list SHALL update in place to reflect the edit or removal
