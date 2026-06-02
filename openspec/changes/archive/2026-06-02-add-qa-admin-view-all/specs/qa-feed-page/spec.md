## MODIFIED Requirements

### Requirement: QA feed API endpoint
The system SHALL provide `GET /api/qa/free` that returns free QA entries across all papers, ordered by `created_at` descending, with paper info, **creator identity**, and results included, **paginated** via `page` (default 1) and `page_size` (default 20) query parameters. The endpoint SHALL accept an optional `scope` query parameter with value `mine` (default) or `all`. When `scope=all` **and** the authenticated user is an admin (`role === 'admin'`), the endpoint SHALL return every user's free QA entries; in all other cases (including a non-admin sending `scope=all`) it SHALL return only entries owned by the current user. Each returned entry SHALL include `user_id` (the creator's user id, or `null`) and `username` (the creator's username, or `null` when no creator is resolvable). The response SHALL be a `{ data, pagination }` envelope whose `pagination` object contains `page`, `page_size`, `total`, and `total_pages`. The endpoint SHALL require authentication.

#### Scenario: Fetch own free QA entries (paginated)
- **WHEN** an authenticated user calls `GET /api/qa/free?page=1&page_size=20` (no `scope`, or `scope=mine`)
- **THEN** the response SHALL return `{ "data": [...], "pagination": { "page", "page_size", "total", "total_pages" } }`, where `data` contains at most `page_size` of that user's free QA entries (each with fields `entry_id`, `paper_id`, `paper_title`, `status`, `error`, `prompt`, `created_at`, `results`, `user_id`, `username`) and `total` is the user's full free-QA count

#### Scenario: Admin fetches all users' free QA entries
- **WHEN** an admin user calls `GET /api/qa/free?scope=all`
- **THEN** the response SHALL include free QA entries created by every user (not just the admin's own), ordered by `created_at` descending, paginated, each carrying its creator's `user_id` and `username`

#### Scenario: Non-admin requesting all scope is downgraded
- **WHEN** a non-admin authenticated user calls `GET /api/qa/free?scope=all`
- **THEN** the system SHALL ignore the `all` scope and return only that user's own free QA entries (identical to `scope=mine`)

#### Scenario: Creator identity included
- **WHEN** any free QA entry is returned
- **THEN** the entry SHALL include `user_id` and `username` for the creator, or both `null` when the entry has no resolvable creator

#### Scenario: Default pagination
- **WHEN** an authenticated user calls `GET /api/qa/free` with no pagination params
- **THEN** the system SHALL default to `page=1` and `page_size=20`

#### Scenario: Ordering by creation time
- **WHEN** the result set has multiple free QA entries across different papers (and, for `scope=all`, across different users)
- **THEN** entries SHALL be ordered by `created_at` descending (newest first) before pagination is applied

#### Scenario: No free QA entries
- **WHEN** the result set for the requested scope is empty
- **THEN** the response SHALL return `{ "data": [], "pagination": { "page": 1, "page_size": 20, "total": 0, "total_pages": 0 } }`

#### Scenario: Anonymous request rejected
- **WHEN** an anonymous client calls `GET /api/qa/free`
- **THEN** the system SHALL respond with 401 Unauthorized

### Requirement: QA feed panel structure
Each QA entry SHALL be rendered as a paper-title/time header line ABOVE the card, plus a shadcn-vue `Card` below it whose expand/collapse is driven by `Collapsible` (`CollapsibleTrigger` header, `CollapsibleContent` body) — it SHALL NOT use ad-hoc `v-if`/manual-toggle markup for collapse. The above-card line SHALL show the paper title (as a clickable link to `/papers/:id`, allowed to use the full line width — not truncated to a narrow fixed width) on the left and the creation time right-aligned. When the feed is viewed in the all-users scope, the above-card line SHALL also show the asker's username (the entry's `username`) so entries by different users are distinguishable; when viewing the own-entries scope, or when no `username` is present, the username SHALL be omitted. The card header itself SHALL be kept simple: a status indicator, the question text as a bold (`font-semibold`) primary line, and an answer-count or model `Badge` — no separate expand/collapse chevron. A `Separator` SHALL divide the header from the body. The card body SHALL be collapsed by default.

#### Scenario: Panel built from shadcn primitives
- **WHEN** a QA entry renders
- **THEN** it SHALL be an above-card paper/time line plus a shadcn `Card` using `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` for expand/collapse, with a `Separator` between the card header and body

#### Scenario: Paper title and time sit above the card
- **WHEN** a QA entry for paper "Attention Is All You Need" is displayed
- **THEN** the paper title SHALL appear as a link ABOVE the card (left-aligned, using the full available width), with the creation time right-aligned on the same line, and SHALL NOT be rendered inside the card

#### Scenario: Asker username shown in all-users scope
- **WHEN** the feed is viewed in the all-users scope and a QA entry has a `username`
- **THEN** the above-card line SHALL display that username as the entry's asker

#### Scenario: Asker username omitted in own scope
- **WHEN** the feed is viewed in the own-entries scope (or the entry has no `username`)
- **THEN** the above-card line SHALL NOT display an asker username

#### Scenario: Card header content
- **WHEN** a QA entry with question "What is the main contribution?" is displayed
- **THEN** the card header SHALL show a status indicator, the question text as a bold primary line, and a `Badge` indicating the number of answers (or the single model name), with no expand/collapse chevron

#### Scenario: Status indicator is labeled
- **WHEN** a card shows its done / running / failed status icon
- **THEN** the icon SHALL be wrapped in a `Tooltip` whose content names the status

#### Scenario: Panel default state
- **WHEN** the /qa page loads
- **THEN** all QA entry cards SHALL be collapsed (body hidden)

#### Scenario: Panel expand/collapse
- **WHEN** a user clicks on a collapsed card header
- **THEN** the `Collapsible` SHALL expand the body to show the full QA results
- **WHEN** a user clicks on an expanded card header
- **THEN** the body SHALL collapse

#### Scenario: Paper link is independent of the card
- **WHEN** a user clicks the paper title link above a card
- **THEN** the app SHALL navigate to the paper detail page WITHOUT toggling the card's expand/collapse state (the link is outside the card)

### Requirement: QA feed page requires login
The `/qa` page SHALL require an authenticated user. The sidebar Q&A entry SHALL remain visible to anonymous users, but selecting it SHALL prompt for login instead of opening the feed. By default the feed SHALL display only the current user's free QA entries. Admin users SHALL additionally be offered a scope toggle (in the `AppPage` header `#actions` slot) to switch between viewing their own entries and viewing all users' entries; non-admin users SHALL NOT see this toggle.

#### Scenario: Authenticated user opens the feed
- **WHEN** an authenticated user navigates to `/qa`
- **THEN** the page SHALL load and display only that user's free QA entries by default

#### Scenario: Anonymous user attempts the feed
- **WHEN** an anonymous user selects the Q&A sidebar entry or navigates to `/qa`
- **THEN** the system SHALL prompt for login and SHALL NOT display any QA entries

#### Scenario: Admin sees the scope toggle
- **WHEN** an admin user views the `/qa` page
- **THEN** the page header `#actions` slot SHALL include a control to switch the feed scope between own entries and all users' entries

#### Scenario: Non-admin does not see the scope toggle
- **WHEN** a non-admin user views the `/qa` page
- **THEN** no scope toggle SHALL be shown, and the feed SHALL display only that user's own entries

#### Scenario: Admin switches to all-users scope
- **WHEN** an admin activates the all-users option on the scope toggle
- **THEN** the page SHALL re-fetch the feed with `scope=all` from the first page and display every user's free QA entries, each labeled with its asker
