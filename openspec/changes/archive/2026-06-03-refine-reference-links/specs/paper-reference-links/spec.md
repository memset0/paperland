## MODIFIED Requirements

### Requirement: Reference link fields
Each reference link SHALL have a required `url`, an optional `title`, and a `description`. The `url` SHALL be a syntactically valid absolute URL whose scheme is `http` or `https`. The `title` MAY be omitted, `null`, or empty (all stored as "no title", `null`); when a non-empty `title` is provided it SHALL be trimmed and SHALL NOT exceed the title length limit. The `description` is normally auto-derived (see "Auto-derived link description") and is not entered by the user; it MAY be `null` (e.g. when the page could not be crawled) and, when present, SHALL be trimmed and SHALL NOT exceed the description length limit.

#### Scenario: Only the url is required
- **WHEN** a user submits a link with a valid `http(s)` url and no title
- **THEN** the system SHALL store the link with a `null` title and SHALL NOT reject it for the missing title

#### Scenario: Missing or invalid url rejected
- **WHEN** a user submits a link with a missing/empty url, or a url that is not a valid absolute http/https URL (e.g. `javascript:alert(1)` or `not a url`)
- **THEN** the system SHALL reject the request with a 400 error and SHALL NOT create a link

#### Scenario: Description stored as provided
- **WHEN** a link is created or updated with a derived description string
- **THEN** the system SHALL store that description, treating empty/`null` as "no description"

### Requirement: Create, update, and delete reference links
The system SHALL expose authenticated endpoints to create, update, and delete a user's reference links. Creating SHALL be done via `POST /api/papers/:id/reference-links`; updating via `PATCH /api/reference-links/:id`; deleting via `DELETE /api/reference-links/:id`. All three SHALL require an authenticated user. Creation SHALL require only a valid `url`; `title` and `description` are optional. Update and delete SHALL operate only on links owned by the requesting user; a link that does not exist or is not owned by the requester SHALL respond `404`. Update SHALL apply only the provided fields, SHALL validate any provided `url` (and any non-empty `title`) under the same rules as creation, and SHALL refresh `updated_at`.

#### Scenario: Create a link from a url
- **WHEN** an authenticated user POSTs `{ url, description? }` (no title) to `/api/papers/:id/reference-links`
- **THEN** the system SHALL create the link owned by that user for that paper with a `null` title and respond `201` with the created link

#### Scenario: Update a subset of fields
- **WHEN** an authenticated owner PATCHes `/api/reference-links/:id` with only `{ url }`
- **THEN** the system SHALL update just the url, leave title and description unchanged, refresh `updated_at`, and return the updated link

#### Scenario: Delete a link
- **WHEN** an authenticated owner DELETEs `/api/reference-links/:id`
- **THEN** the system SHALL remove the link and report success

#### Scenario: Mutating another user's link is rejected
- **WHEN** an authenticated user PATCHes or DELETEs a `/api/reference-links/:id` they do not own
- **THEN** the system SHALL respond `404` and SHALL NOT modify the link

#### Scenario: Unauthenticated mutation rejected
- **WHEN** an unauthenticated request attempts to create, update, or delete a reference link
- **THEN** the system SHALL reject it with an authentication error and SHALL NOT modify any data

### Requirement: Reference links section in the paper detail page
The paper detail page SHALL present a "参考链接" section that lists the current user's reference links for the paper. The controls to add, edit, and delete links SHALL be presented only to an authenticated user; an unauthenticated viewer SHALL NOT see add/edit/delete affordances. Each link SHALL render as a hyperlink to its `url` that opens in a new tab with `rel="noopener noreferrer"`, using a display label resolved by the fallback chain `title → description → url` (the `title` when present, otherwise the `description`, otherwise the raw `url`). After a successful add/edit/delete the displayed list SHALL reflect the change without a full page reload.

#### Scenario: Link label uses the fallback chain
- **WHEN** a link has no title but has a description
- **THEN** the link SHALL render with the description as its label; **AND WHEN** a link has neither title nor description, it SHALL render with its url as the label

#### Scenario: Management controls hidden when unauthenticated
- **WHEN** an unauthenticated user views the paper detail page
- **THEN** the 参考链接 section SHALL NOT show add, edit, or delete controls

#### Scenario: Add a link from the UI
- **WHEN** an authenticated user enters a url (and optionally a title) and submits
- **THEN** the new link SHALL be created and appear in the list without a full page reload

#### Scenario: Form fields — required url, optional title, read-only description
- **WHEN** an authenticated user opens the add/edit form
- **THEN** the form SHALL present a required url input and an optional title input, and SHALL show the auto-derived description as read-only text (no manual description input)

#### Scenario: Edit and delete from the UI
- **WHEN** an authenticated user edits a link's url and saves, or deletes a link
- **THEN** the list SHALL update in place to reflect the edit or removal

#### Scenario: Deleting a link asks for confirmation
- **WHEN** an authenticated user clicks delete on a reference link
- **THEN** the UI SHALL ask for confirmation first, and SHALL only remove the link if the user confirms (cancelling leaves it untouched)

## ADDED Requirements

### Requirement: Auto-derived link description
When adding or editing a reference link, the description SHALL be derived automatically from the linked page rather than typed by the user. The frontend SHALL, after the user provides a valid `http(s)` url, request a server-side preview and populate the link's description with the derived value; the description field SHALL be read-only in the UI. The derived description SHALL have the form `${page_title} (${hostname})` when a page title is available, where `hostname` is the url's host. When no page title is available but the page was reachable, the description MAY be the `hostname` alone. When the page cannot be crawled, the description SHALL be `null` and the link SHALL still be saveable on the url alone.

#### Scenario: Description derived from page title and hostname
- **WHEN** the user enters a url whose page has the title `Build software better, together` and host `github.com`
- **THEN** the preview SHALL yield the description `Build software better, together (github.com)` and the UI SHALL fill it in without letting the user edit it

#### Scenario: Description omitted when crawl fails
- **WHEN** the user enters a url that cannot be reached or has no usable page title
- **THEN** the preview SHALL return no description, and the link SHALL still be saveable using only the url (which becomes its display label)

### Requirement: Reference link preview endpoint
The system SHALL expose an authenticated endpoint `GET /api/reference-links/preview` that accepts a `url` query parameter and returns metadata derived by crawling the page server-side: at least the derived `description`, the `hostname`, and the page `title` (which MAY be `null`). The endpoint SHALL require an authenticated user. It SHALL validate the `url` as an absolute `http(s)` URL and reject otherwise with `400`. The server-side fetch SHALL be bounded by a configurable timeout and maximum response size, with the user-agent, timeout, and size limit configured in `config.yml`. A crawl that times out, errors, returns a non-success status, or yields no page title SHALL NOT be treated as a request error: the endpoint SHALL respond `200` with a `null` title/description (and the resolved `hostname` when available).

#### Scenario: Preview requires authentication
- **WHEN** an unauthenticated request calls `GET /api/reference-links/preview?url=…`
- **THEN** the system SHALL reject it with an authentication error

#### Scenario: Invalid url rejected
- **WHEN** an authenticated user calls the preview endpoint with a missing or non-http(s) url
- **THEN** the system SHALL respond `400` and SHALL NOT attempt a crawl

#### Scenario: Successful preview returns derived description
- **WHEN** an authenticated user previews a reachable url whose page has a `<title>`
- **THEN** the system SHALL respond `200` with the page `title`, the `hostname`, and `description = "${title} (${hostname})"`

#### Scenario: Failed crawl returns a null description without error
- **WHEN** an authenticated user previews a url that times out, errors, or has no usable title
- **THEN** the system SHALL respond `200` with a `null` description rather than a 4xx/5xx error
