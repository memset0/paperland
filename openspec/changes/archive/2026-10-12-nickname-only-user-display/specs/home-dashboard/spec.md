## MODIFIED Requirements

### Requirement: Leaderboard podium and overflow table
The Home usage dashboard SHALL show the leaderboard for the selected window, visible to every signed-in user, in the API's order (estimated cost descending, then total tokens). The first three entries SHALL be shown as a podium: the 1st place in the center on the tallest step, 2nd place on the left, 3rd place on the right on the shortest step, each step showing its rank, the entry's display name (nickname only when set, otherwise username, or "Unattributed" for usage without a user), estimated cost and total tokens. When fewer than three entries exist, only the occupied places SHALL be shown. When more than three entries exist, entries from rank 4 onward SHALL be listed in a table below the podium with rank, user, calls, tokens, cached share and estimated cost; with three or fewer entries no table SHALL be shown. When no usage exists in the window, the dashboard SHALL show an empty state "No usage recorded yet" instead of the podium. The signed-in user's own entry SHALL be visually marked wherever it appears.

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

#### Scenario: Nickname on all leaderboard ranks
- **WHEN** a user with nickname "Alice" and username "alice_login" appears on the podium or overflow table
- **THEN** their name and name tooltip SHALL show only "Alice" without "alice_login"
