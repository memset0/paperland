## MODIFIED Requirements

### Requirement: QA feed API endpoint
The system SHALL provide `GET /api/qa/free` with pagination, paper info, results, creator identity, and `scope=mine|all`. `mine` SHALL be the default. Every authenticated user MAY request `all`; the result SHALL be ordered by `created_at` descending before pagination and SHALL include `user_id`/`username` per entry.

#### Scenario: Fetch own free QA entries (paginated)
- **WHEN** a user calls the endpoint without scope or with `scope=mine`
- **THEN** only that user's entries and scope-correct totals SHALL be returned

#### Scenario: Admin fetches all users' free QA entries
- **WHEN** an admin requests `scope=all`
- **THEN** all users' entries SHALL be returned with asker identity under normal pagination

#### Scenario: Non-admin requesting all scope is downgraded
- **WHEN** a non-admin requests `scope=all`
- **THEN** the request SHALL no longer be downgraded and SHALL return all users' entries with asker identity

#### Scenario: Creator identity included
- **WHEN** a free QA entry is returned
- **THEN** it SHALL contain its creator `user_id` and `username`, or null only for unresolved legacy attribution

#### Scenario: Default pagination
- **WHEN** pagination is omitted
- **THEN** page 1 and page_size 20 SHALL be used

#### Scenario: Ordering by creation time
- **WHEN** multiple entries exist in the requested scope
- **THEN** they SHALL be sorted newest-first before pagination

#### Scenario: No free QA entries
- **WHEN** the requested scope is empty
- **THEN** data SHALL be empty and pagination totals SHALL be zero

#### Scenario: Anonymous request rejected
- **WHEN** an anonymous caller requests the feed
- **THEN** the system SHALL return 401

### Requirement: QA feed panel actions
Each expanded panel SHALL retain copy, pin, and result rendering. Regenerate/delete SHALL be available to the entry owner or an administrator and SHALL be hidden for a non-admin viewing someone else's entry.

#### Scenario: Regenerate from feed panel
- **WHEN** an owner or administrator regenerates a result
- **THEN** normal regeneration SHALL start

#### Scenario: Delete result from feed panel
- **WHEN** an owner or administrator deletes a result
- **THEN** it SHALL be removed from the panel

#### Scenario: Copy answer from feed panel
- **WHEN** any authorized viewer copies a visible answer
- **THEN** its text SHALL be copied with feedback

#### Scenario: Pin result from feed panel
- **WHEN** any authorized viewer pins a visible result
- **THEN** existing client-side pin ordering SHALL apply

#### Scenario: Other user's panel is read-only
- **WHEN** a non-admin expands another user's all-scope entry
- **THEN** regenerate/delete SHALL not be displayed

### Requirement: QA feed page requires login
The `/qa` page SHALL require login, default to mine, and offer every authenticated user a mine/all selector. All scope SHALL show asker labels. Anonymous navigation SHALL continue to prompt for login.

#### Scenario: Authenticated user opens the feed
- **WHEN** an authenticated user opens `/qa`
- **THEN** mine scope SHALL load first

#### Scenario: Anonymous user attempts the feed
- **WHEN** an anonymous user opens `/qa`
- **THEN** login SHALL be requested and no QA displayed

#### Scenario: Admin sees the scope toggle
- **WHEN** an admin views the page
- **THEN** the common mine/all selector SHALL be visible

#### Scenario: Non-admin does not see the scope toggle
- **WHEN** a non-admin views the page
- **THEN** no admin-only control SHALL appear, but the common mine/all selector SHALL be visible

#### Scenario: Admin switches to all-users scope
- **WHEN** an admin selects all
- **THEN** the feed SHALL reload page 1 with every user's entries and asker labels

#### Scenario: Non-admin switches to all-users scope
- **WHEN** a non-admin selects all
- **THEN** the same all-scope behavior SHALL apply

