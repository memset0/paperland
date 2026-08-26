# qa-feed-page Specification

## Purpose
Provides a dedicated /qa page that displays all free QA entries across all papers as a chronological feed, with collapsible panels supporting full QA management actions.
## Requirements
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

### Requirement: QA feed page displays chronological list
The /qa page SHALL display the current user's free QA entries as a **paginated** chronological list of collapsible panels, ordered by creation time (newest first), showing one page (default 20 entries) at a time rather than all entries at once. While entries are loading the page SHALL show shadcn `Skeleton` placeholder cards, and the page header SHALL provide a refresh action. When more than one page of entries exists, the page SHALL provide previous/next pagination controls that show the current page number and the total page count.

#### Scenario: Page load shows the first page
- **WHEN** a user navigates to /qa
- **THEN** the page SHALL load the first page of free QA entries (at most `page_size`) and display each as a collapsible panel

#### Scenario: Pagination controls when multiple pages
- **WHEN** the user's free QA entry count exceeds one page
- **THEN** the page SHALL display previous/next controls and a "current / total" page indicator, with previous disabled on the first page and next disabled on the last

#### Scenario: Navigate between pages
- **WHEN** a user activates the next or previous page control
- **THEN** the page SHALL fetch and display that page and scroll the list back to the top

#### Scenario: Loading state shows skeletons
- **WHEN** the feed is loading
- **THEN** the page SHALL display shadcn `Skeleton` placeholder cards in place of the feed list

#### Scenario: Header refresh action
- **WHEN** the page is displayed
- **THEN** the `AppPage` header `#actions` slot SHALL contain a refresh button that re-fetches the current page when activated

#### Scenario: Empty state
- **WHEN** no free QA entries exist
- **THEN** the page SHALL display an appropriate empty state message

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

### Requirement: QA feed panel actions
Each expanded QA panel SHALL support all QA management actions: regenerate with model selection, delete individual results, copy answer, and pin result.

#### Scenario: Regenerate from feed panel
- **WHEN** a user clicks regenerate on a QA result in the feed panel
- **THEN** the system SHALL trigger LLM regeneration for that entry, same as on paper detail page

#### Scenario: Delete result from feed panel
- **WHEN** a user clicks delete on a QA result in the feed panel
- **THEN** the result SHALL be deleted and removed from the panel display

#### Scenario: Copy answer from feed panel
- **WHEN** a user clicks copy on a QA result
- **THEN** the answer text SHALL be copied to clipboard with visual feedback

#### Scenario: Pin result from feed panel
- **WHEN** a user clicks pin on a QA result
- **THEN** the result SHALL be pinned (sorted first among results for that entry)

### Requirement: Feed panel icon actions use shadcn affordances
Within the feed panel body, every icon-only action control (pin, copy, regenerate, delete) SHALL be labeled with a shadcn `Tooltip` rather than the native `title` attribute, and dividers around the action row SHALL be rendered with `Separator` rather than raw borders. Because shadcn `Tooltip`s require an enclosing `TooltipProvider`, the application SHALL provide a `TooltipProvider` around the main router outlet so that tooltips used in page content (including these actions and the panel's status indicator) render without error.

#### Scenario: Icon action shows a tooltip
- **WHEN** a user hovers an icon-only action button (pin / copy / regenerate / delete) in an expanded panel
- **THEN** a shadcn `Tooltip` SHALL show the action's label

#### Scenario: Page-content tooltips render within a provider
- **WHEN** the feed page (or any route component) renders a shadcn `Tooltip` in page content
- **THEN** it SHALL render without throwing a "must be used within TooltipProvider" error, because the app wraps the router outlet in a `TooltipProvider`

#### Scenario: Action row divider uses Separator
- **WHEN** the action row renders beneath an answer
- **THEN** it SHALL be separated from the answer content by a `Separator` component

### Requirement: Regenerate dialog uses checkbox model selection
The feed panel's regenerate dialog SHALL present the available models as a list of shadcn `Checkbox` + `Label` rows for multi-selection, preserving the existing submit behavior (regeneration runs for every selected model).

#### Scenario: Select multiple models with checkboxes
- **WHEN** a user opens the regenerate dialog
- **THEN** each available model SHALL be shown as a `Checkbox` + `Label` row, and toggling a checkbox SHALL add or remove that model from the selection

#### Scenario: Submit regenerates selected models
- **WHEN** a user confirms the dialog with one or more models checked
- **THEN** the system SHALL trigger regeneration for each selected model, exactly as before

### Requirement: Available models fetched once at page level
The list of available models used by the regenerate dialog SHALL be fetched once at the /qa page level (cached in the store and shared by every feed card), rather than once per card. Individual feed panels SHALL NOT each request `/api/config/models` on mount.

#### Scenario: Single models request per page load
- **WHEN** the /qa page renders N feed cards
- **THEN** `/api/config/models` SHALL be requested at most once (by the page), not once per card

#### Scenario: Cards still offer model selection
- **WHEN** a user opens the regenerate dialog on any card
- **THEN** the dialog SHALL list the models from the shared store cache

### Requirement: QA feed polling
The /qa page SHALL poll for updates when any QA entry on the currently displayed page has status "pending" or "running". Polling SHALL re-fetch the current page rather than the whole feed.

#### Scenario: Active entries trigger polling
- **WHEN** the current page contains entries with status "pending" or "running"
- **THEN** the page SHALL poll `GET /api/qa/free` for the current page every 3 seconds until those entries reach "done" or "failed"

#### Scenario: No active entries
- **WHEN** all entries on the current page have status "done" or "failed"
- **THEN** the page SHALL NOT poll

### Requirement: QA result view reuse
The feed panel body SHALL reuse the existing `QAResultView.vue` component for rendering model tabs, markdown answers, and action buttons.

#### Scenario: Result display consistency
- **WHEN** a QA entry is expanded in the feed panel
- **THEN** the results SHALL be rendered identically to how they appear on the paper detail page (same model tabs, markdown rendering, action buttons)

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

### Requirement: QA feed reuses live per-Result rendering
The `/qa` feed SHALL use the same Result tabs, precise lifecycle labels, Thinking timer, stable incremental Markdown preview, final canonical render, stream reconciliation, stop/retry authorization, and terminal errors as PaperDetail. Opening, closing, or collapsing a feed panel SHALL NOT control the underlying Service execution.

#### Scenario: Expand an actively streaming feed entry
- **WHEN** a viewer expands a feed card whose newest Result is streaming
- **THEN** the current persisted answer SHALL appear immediately and continue growing through live updates

#### Scenario: Read-only all-scope viewer
- **WHEN** a user views another user's streaming Result in all scope
- **THEN** live text and status SHALL be visible while stop/retry/delete controls remain hidden

#### Scenario: Feed timer and stream preserve card geometry
- **WHEN** an expanded feed Result moves from Thinking to streaming and then done
- **THEN** its timer/status SHALL use stable geometry, incremental output SHALL not remount the feed card, and completion SHALL perform one final canonical render

### Requirement: Feed polling remains a streaming fallback
The feed SHALL continue polling only its current page while any entry contains an active Result. Live subscriptions SHALL update discovered Results between polls; polling SHALL discover new Result identities, reconcile missed/terminal snapshots, and stop when no Result on the page is active.

#### Scenario: Live connection fails temporarily
- **WHEN** a Result SSE connection fails without a terminal event
- **THEN** current-page polling SHALL eventually reconcile its durable partial or terminal Result state without duplicating text

#### Scenario: All visible Results are terminal
- **WHEN** every Result on the current feed page is done, failed, or cancelled
- **THEN** the feed SHALL close active subscriptions and stop polling that page
