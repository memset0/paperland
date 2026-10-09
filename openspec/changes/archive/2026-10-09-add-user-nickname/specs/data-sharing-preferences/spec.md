## MODIFIED Requirements

### Requirement: Uniform mine/all read scope
Every list or overlay of optionally-shared data SHALL accept a scope of `mine` or `all` (default `mine`) and SHALL apply these rules for an authenticated caller:
- `mine` SHALL return only rows owned by the caller.
- `all` for a non-admin SHALL return the caller's own rows plus rows of other users whose sharing switch for that data type is on (and, for notes, other users' published notes regardless of switch).
- `all` for an admin SHALL return every user's rows regardless of sharing switches.
Each returned row SHALL carry its owner's `user_id`, `username`, and `display_name` (the owner's nickname when set, otherwise their username), and a `shared` boolean giving whether the row is visible to non-admin others (the owner's switch, or a note's published state). Anonymous callers SHALL receive only always-shared data and published notes; optionally-shared data otherwise SHALL be empty with HTTP 200 where the endpoint is public.

#### Scenario: Non-admin all scope
- **WHEN** user B (non-admin) requests `all` and user A shares Q&A while user C does not
- **THEN** the response SHALL include B's own, A's, and not C's free Q&A

#### Scenario: Admin all scope ignores switches
- **WHEN** an admin requests `all` and user C does not share Q&A
- **THEN** the response SHALL include user C's free Q&A with `shared: false`

#### Scenario: Owner attribution
- **WHEN** any row not owned by the caller is returned
- **THEN** it SHALL carry the owner's `username` and `display_name`

### Requirement: Scope selector and attribution in the UI
Each page or panel that lists optionally-shared data — the `/notes` page, the `/qa` feed, the paper detail User Q&A card, the paper detail reference links section, highlight rendering on paper and Q&A content, and the paper detail "others' notes" section — SHALL offer authenticated users a Mine / All selector (except where the section by definition shows only others' data). Every item not owned by the viewer SHALL display its owner's display name (nickname when set, otherwise username). Wherever another requirement says an item shows its owner's or asker's username, the UI SHALL show this display name. For an admin, items with `shared: false` that belong to someone else SHALL additionally display a "Private" marker.

#### Scenario: Other user's item labeled
- **WHEN** a user views the All scope and sees an item owned by someone else
- **THEN** the item SHALL show the owner's display name

#### Scenario: Admin sees private marker
- **WHEN** an admin views the All scope and an item belongs to a user who does not share that type
- **THEN** the item SHALL show a "Private" marker in addition to the display name


#### Scenario: Nickname shown instead of username
- **WHEN** user A has nickname `Alice W` and user B views A's shared item in the All scope
- **THEN** the item SHALL show `Alice W`, and SHALL show A's username when A clears the nickname
