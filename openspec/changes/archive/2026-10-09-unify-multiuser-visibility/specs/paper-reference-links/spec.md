## MODIFIED Requirements

### Requirement: Per-user reference link list per paper
The system SHALL let each user maintain their own list of reference links for each paper, keyed by `(user_id, paper_id)`. A user's links SHALL be editable only by that user and SHALL NOT be affected by other users' links on the same paper. Visibility of a user's links to others SHALL follow that user's `reference_links` sharing switch (see the `data-sharing-preferences` capability). Each link SHALL be stored as its own row carrying a stable `id`, the owning `user_id`, the `paper_id`, and `created_at`/`updated_at` timestamps.

#### Scenario: Links are private to the owner
- **WHEN** user A, who does not share reference links, adds a link to paper 123 and non-admin user B requests paper 123's links with `scope=all`
- **THEN** user B's list SHALL NOT include user A's link

#### Scenario: Shared links visible in all scope
- **WHEN** user A shares reference links and user B requests paper 123's links with `scope=all`
- **THEN** user B's list SHALL include user A's link attributed to A, and B SHALL NOT be able to edit or delete it

#### Scenario: Links are scoped per paper
- **WHEN** a user requests the reference links for a given paper
- **THEN** the system SHALL return only links for that paper, and no links belonging to other papers

#### Scenario: Removing a paper removes its reference links
- **WHEN** a paper is deleted
- **THEN** all reference links belonging to that paper (across all users) SHALL be removed

### Requirement: List reference links
The system SHALL expose `GET /api/papers/:id/reference-links?scope=mine|all` (default `mine`). `mine` SHALL return the requesting user's links; `all` SHALL follow the uniform all-scope rules. Results SHALL be ordered by `created_at` ascending (insertion order) with `id` as a tiebreaker, and each link SHALL carry `user_id`, `username`, and `shared`. For an unauthenticated request the endpoint SHALL return an empty list rather than an error.

#### Scenario: List in insertion order
- **WHEN** an authenticated user has added several links to a paper and requests the list
- **THEN** the system SHALL return that user's links for that paper ordered oldest-first

#### Scenario: Anonymous list is empty
- **WHEN** an unauthenticated client requests a paper's reference links
- **THEN** the system SHALL respond with an empty list and no error

### Requirement: Reference links section in the paper detail page
The paper detail page SHALL present a "参考链接" section that lists reference links for the paper, with a Mine / All selector for authenticated users (default Mine). The controls to add links SHALL be presented only to an authenticated user, and edit/delete controls SHALL be presented only on the viewer's own links; an unauthenticated viewer SHALL NOT see add/edit/delete affordances. Links owned by someone else SHALL show the owner's username (and, for an admin viewing an unshared link, a "Private" marker). Each link SHALL render as a hyperlink to its `url` that opens in a new tab with `rel="noopener noreferrer"`, using a display label resolved by the fallback chain `title → description → url`. After a successful add/edit/delete the displayed list SHALL reflect the change without a full page reload.

#### Scenario: Link label uses the fallback chain
- **WHEN** a link has no title but has a description
- **THEN** the link SHALL render with the description as its label; **AND WHEN** a link has neither title nor description, it SHALL render with its url as the label

#### Scenario: Management controls hidden when unauthenticated
- **WHEN** an unauthenticated user views the paper detail page
- **THEN** the 参考链接 section SHALL NOT show add, edit, or delete controls

#### Scenario: Others' links are read-only and attributed
- **WHEN** a user switches the section to All and another user's link appears
- **THEN** the link SHALL show its owner's username and SHALL NOT show edit or delete controls

#### Scenario: Add a link from the UI
- **WHEN** an authenticated user enters a url (and optionally a title) and submits
- **THEN** the new link SHALL be created and appear in the list without a full page reload

#### Scenario: Form fields — required url, optional title, read-only description
- **WHEN** an authenticated user opens the add/edit form
- **THEN** the form SHALL present a required url input and an optional title input, and SHALL show the auto-derived description as read-only text (no manual description input)

#### Scenario: Edit and delete from the UI
- **WHEN** an authenticated user edits one of their own links' url and saves, or deletes one of their own links
- **THEN** the list SHALL update in place to reflect the edit or removal

#### Scenario: Deleting a link asks for confirmation
- **WHEN** an authenticated user clicks delete on a reference link
- **THEN** the UI SHALL ask for confirmation first, and SHALL only remove the link if the user confirms (cancelling leaves it untouched)
