## REMOVED Requirements

### Requirement: Usage APIs
**Reason**: The leaderboard is no longer admin-only; replaced by "Usage endpoints" below, which keeps every other rule.
**Migration**: None for clients; `user`-role accounts now receive 200 instead of 403 from `GET /api/usage/leaderboard`.

## ADDED Requirements

### Requirement: Usage endpoints
`GET /api/usage/me` SHALL return the signed-in user's totals (calls, input, cached input, output, total tokens, estimated cost) overall and per category. `GET /api/usage/leaderboard` SHALL be available to every signed-in user (any role) and return one entry per user with usage (id, username, nickname, calls, tokens, estimated cost), sorted by estimated cost descending then total tokens descending; rows without a user SHALL be grouped as one unattributed entry. Anonymous callers SHALL receive 401 from both endpoints. Both endpoints SHALL accept an optional `days` query parameter limiting the window to the last N days; without it they cover all time. Costs SHALL sum only non-null `cost_usd` values.

#### Scenario: Regular user reads own usage
- **WHEN** a `user`-role account calls `GET /api/usage/me`
- **THEN** it SHALL receive only its own totals

#### Scenario: Regular user reads the leaderboard
- **WHEN** a `user`-role account calls `GET /api/usage/leaderboard`
- **THEN** the response SHALL be 200 with an entry for every user that has usage in the window

#### Scenario: Anonymous leaderboard request
- **WHEN** an anonymous caller requests `GET /api/usage/leaderboard`
- **THEN** the response SHALL be 401
