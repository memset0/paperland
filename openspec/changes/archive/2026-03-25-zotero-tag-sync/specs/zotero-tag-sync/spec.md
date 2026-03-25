## ADDED Requirements

### Requirement: Zotero plugin syncs item tags to Paperland
The Zotero plugin SHALL automatically sync the current Zotero item's tags to Paperland when the sidebar panel renders a paper.

#### Scenario: Item has tags
- **WHEN** user selects a Zotero item with tags and the sidebar panel resolves the paper ID
- **THEN** the plugin calls `PATCH /external-api/v1/papers/:id/tags` with `{ add: [tag names] }` to sync all Zotero item tags to Paperland

#### Scenario: Item has no tags
- **WHEN** user selects a Zotero item with no tags
- **THEN** the plugin does NOT make a tag sync API call

#### Scenario: Sync uses add-only mode
- **WHEN** tags are synced from Zotero to Paperland
- **THEN** the plugin only adds tags (never removes), preserving any tags manually added in Paperland

### Requirement: API module provides syncTags function
The plugin's API module SHALL expose a `syncTags(paperId, tagNames)` function that calls the External API tag endpoint.

#### Scenario: Successful tag sync
- **WHEN** `syncTags(42, ["ML", "transformer"])` is called
- **THEN** the function sends `PATCH /external-api/v1/papers/42/tags` with `{ add: ["ML", "transformer"] }` using Bearer token auth

#### Scenario: Tag sync failure
- **WHEN** the tag sync API call fails (network error, auth error, etc.)
- **THEN** the function returns `{ ok: false, error: string }` without throwing

### Requirement: Panel displays tag sync status
The sidebar panel SHALL display the tag sync result in the status area.

#### Scenario: Tags synced successfully
- **WHEN** tags are synced successfully
- **THEN** the panel status shows the number of synced tags (e.g., "已同步 3 个标签")

#### Scenario: No tags to sync
- **WHEN** the Zotero item has no tags
- **THEN** no tag sync status is shown (only the paper ID status line)

#### Scenario: Tag sync fails silently
- **WHEN** tag sync fails
- **THEN** the panel still displays the paper normally; the tag sync error is logged to console but not shown to the user
