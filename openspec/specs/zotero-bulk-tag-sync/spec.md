## ADDED Requirements

### Requirement: Bulk tag sync button in preferences
The plugin preferences UI SHALL include a "Sync All Tags" button in a dedicated section below the API configuration. Clicking the button SHALL trigger a bulk tag sync operation.

#### Scenario: Button visible in preferences
- **WHEN** the user opens plugin preferences
- **THEN** a "Sync All Tags" button is visible below the API Token section

#### Scenario: Button disabled during sync
- **WHEN** a bulk tag sync is in progress
- **THEN** the button SHALL be disabled to prevent duplicate operations

### Requirement: Bulk tag sync iterates all arXiv items
The bulk sync SHALL iterate all regular items in the current Zotero library, extract arXiv IDs using `extractArxivId()`, and skip items without arXiv IDs.

#### Scenario: Items with arXiv IDs are processed
- **WHEN** the library contains items with arXiv IDs in archiveID, Extra, or URL fields
- **THEN** each item's arXiv ID is extracted and looked up in Paperland

#### Scenario: Items without arXiv IDs are skipped
- **WHEN** an item has no arXiv ID in any field
- **THEN** the item is skipped without any API call

### Requirement: Lookup without auto-create
The bulk sync SHALL use `GET /external-api/v1/papers?arxiv_id=X` to check if the paper exists in Paperland. Papers not found in Paperland SHALL be skipped — no auto-creation.

#### Scenario: Paper exists in Paperland
- **WHEN** the lookup returns a paper with ID
- **THEN** the plugin proceeds to sync tags for this paper

#### Scenario: Paper not found in Paperland
- **WHEN** the lookup returns 404
- **THEN** the paper is skipped and counted as "not found"

### Requirement: Tag sync for matched papers
For each paper that exists in both Zotero and Paperland, the plugin SHALL call `PATCH /external-api/v1/papers/:id/tags` with `{ add: tagNames }` using the Zotero item's tags.

#### Scenario: Paper has tags in Zotero
- **WHEN** a matched paper's Zotero item has tags ["ml", "transformer"]
- **THEN** the plugin sends `{ add: ["ml", "transformer"] }` to the tag sync endpoint

#### Scenario: Paper has no tags in Zotero
- **WHEN** a matched paper's Zotero item has no tags
- **THEN** the tag sync call is skipped for this paper

### Requirement: Progress and result feedback
The plugin SHALL display progress during sync and a summary when complete.

#### Scenario: Progress display during sync
- **WHEN** sync is in progress processing paper 15 of 42 arXiv papers
- **THEN** the status label shows progress like "Syncing 15/42..."

#### Scenario: Completion summary
- **WHEN** sync completes with 30 synced, 10 not found, and 2 errors
- **THEN** the status label shows a summary with these counts

#### Scenario: Error during individual paper sync
- **WHEN** a network error occurs while syncing one paper
- **THEN** the error is logged, the paper is counted as errored, and sync continues with remaining papers
