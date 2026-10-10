# home-dashboard Specification

## Purpose
Provides the site's welcome page at `/`: a dashboard that gives signed-in users an overview of the site, starting with a usage dashboard that shows their own model usage and a podium-style leaderboard of all users.

## Requirements

### Requirement: Home page at the site root
The frontend SHALL serve a Home page at `/` titled "Home". It SHALL be a management page wrapped in the shared `AppPage` layout with the route's `meta.title` "Home" and a home icon, and the sidebar SHALL list a "Home" entry above "Papers" that is active only on `/`. Anonymous visitors opening `/` SHALL see the login screen and then Home after logging in. The paper list SHALL NOT be shown at `/`.

#### Scenario: Signed-in user opens the site root
- **WHEN** a signed-in user opens `/`
- **THEN** the Home page SHALL render inside `AppPage` with the title "Home" and the browser tab title "Home - Paperland" style formatting used by other pages
- **AND** the sidebar "Home" entry SHALL be highlighted and the "Papers" entry SHALL NOT be

#### Scenario: Anonymous visitor opens the site root
- **WHEN** an anonymous visitor opens `/`
- **THEN** the login screen SHALL be shown, and after logging in the Home page SHALL appear

### Requirement: Paper list lives at /papers
The paper list SHALL be served at `/papers` with its existing behavior (including its `tags` and sort query parameters), and the sidebar "Papers" entry SHALL link to `/papers` and be active on `/papers` and on paper detail pages (`/papers/:id`). Every in-app navigation that targets the paper list — the paper detail back button, clicking a tag on paper detail, the redirect after deleting a paper, and the "Back to papers" link of the arXiv quick-open error page — SHALL go to `/papers` (keeping any query such as `tags`).

#### Scenario: Tag click from paper detail
- **WHEN** a user clicks tag 5 on a paper detail page
- **THEN** the app SHALL navigate to `/papers?tags=5` and show the paper list filtered by that tag

#### Scenario: Back from paper detail
- **WHEN** a user clicks the back button on a paper detail page
- **THEN** the app SHALL navigate to `/papers`

#### Scenario: Papers sidebar entry on detail page
- **WHEN** a user is on `/papers/42`
- **THEN** the sidebar "Papers" entry SHALL be highlighted and "Home" SHALL NOT be

### Requirement: Usage dashboard time window
The Home usage dashboard SHALL offer a time-window switch with exactly three options in this order: "All time", "Last 7 days", "Last 30 days". "All time" SHALL be selected when the page opens. The selected window SHALL apply to every usage figure on the dashboard (own usage and leaderboard): "All time" SHALL request the usage APIs without `days`, and the other options SHALL request them with `days=7` and `days=30` respectively.

#### Scenario: Default window
- **WHEN** a user opens Home
- **THEN** "All time" SHALL be selected and the dashboard SHALL load `GET /api/usage/me` and `GET /api/usage/leaderboard` without a `days` parameter

#### Scenario: Switch to last 7 days
- **WHEN** the user selects "Last 7 days"
- **THEN** the dashboard SHALL reload both its own-usage figures and the leaderboard with `days=7`

### Requirement: Own usage summary on Home
The Home usage dashboard SHALL show the signed-in user's own usage for the selected window: calls, total tokens, share of input served from cache, and estimated cost, plus a per-category breakdown (Q&A, Deep Research, Translation) with calls, input tokens, output tokens and cost. It SHALL note that cost is estimated at API rates, that models without pricing count as $0, and that calls before usage tracking started are not included.

#### Scenario: User views own usage
- **WHEN** a `user`-role account opens Home
- **THEN** it SHALL see its own totals and per-category breakdown loaded from `GET /api/usage/me`

### Requirement: Leaderboard podium and overflow table
The Home usage dashboard SHALL show the leaderboard for the selected window, visible to every signed-in user, in the API's order (estimated cost descending, then total tokens). The first three entries SHALL be shown as a podium: the 1st place in the center on the tallest step, 2nd place on the left, 3rd place on the right on the shortest step, each step showing its rank, the entry's display name (nickname with username, or username, or "Unattributed" for usage without a user), estimated cost and total tokens. When fewer than three entries exist, only the occupied places SHALL be shown. When more than three entries exist, entries from rank 4 onward SHALL be listed in a table below the podium with rank, user, calls, tokens, cached share and estimated cost; with three or fewer entries no table SHALL be shown. When no usage exists in the window, the dashboard SHALL show an empty state "No usage recorded yet" instead of the podium. The signed-in user's own entry SHALL be visually marked wherever it appears.

#### Scenario: Five users with usage
- **WHEN** the leaderboard returns five entries
- **THEN** entries 1–3 SHALL appear on the podium in the order 2nd · 1st · 3rd with the 1st place tallest
- **AND** entries 4 and 5 SHALL appear in a table below the podium with ranks 4 and 5

#### Scenario: Only two users with usage
- **WHEN** the leaderboard returns two entries
- **THEN** the podium SHALL show the 1st and 2nd places only and no table SHALL be shown

#### Scenario: Regular user sees the leaderboard
- **WHEN** a `user`-role account opens Home
- **THEN** it SHALL see the podium (and table, if any) for all users, with its own entry marked

#### Scenario: Empty window
- **WHEN** no usage was recorded in the last 7 days and the user selects "Last 7 days"
- **THEN** the leaderboard area SHALL show "No usage recorded yet"
