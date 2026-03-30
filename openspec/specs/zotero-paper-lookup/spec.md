## ADDED Requirements

### Requirement: arXiv ID extraction from Zotero item
The plugin SHALL extract the arXiv ID from the selected Zotero item by checking these fields in order:
1. `archiveID` field (format: `arXiv:XXXX.XXXXX`)
2. `extra` field (parse `arXiv: XXXX.XXXXX` pattern)
3. `url` field (parse from `arxiv.org/abs/XXXX.XXXXX` URL pattern)

The `arXiv:` prefix SHALL be stripped before use with the Paperland API.

### Requirement: ArXiv ID extraction strips version suffix
The `extractArxivId()` function SHALL strip any version suffix (e.g. `v1`, `v3`, `v12`) from the extracted arXiv ID before returning it. The returned ID MUST be the base ID without version information.

#### Scenario: Modern format with version suffix in archiveID
- **WHEN** a Zotero item has archiveID `arXiv:2401.10774v3`
- **THEN** `extractArxivId()` returns `2401.10774`

#### Scenario: Modern format without version suffix
- **WHEN** a Zotero item has archiveID `arXiv:2401.10774`
- **THEN** `extractArxivId()` returns `2401.10774`

#### Scenario: Legacy format with version suffix in Extra field
- **WHEN** a Zotero item has Extra field containing `arXiv: cond-mat/0312345v2`
- **THEN** `extractArxivId()` returns `cond-mat/0312345`

#### Scenario: URL format with version suffix
- **WHEN** a Zotero item has URL `https://arxiv.org/abs/2301.12345v5`
- **THEN** `extractArxivId()` returns `2301.12345`

#### Scenario: Legacy URL format with version suffix
- **WHEN** a Zotero item has URL `https://arxiv.org/abs/hep-th/9901001v1`
- **THEN** `extractArxivId()` returns `hep-th/9901001`

#### Scenario: arXiv ID in archiveID field
- **WHEN** the selected item has `archiveID` = `arXiv:2603.04948`
- **THEN** the extracted arXiv ID is `2603.04948`

#### Scenario: arXiv ID in Extra field
- **WHEN** the selected item has no `archiveID` but `extra` contains `arXiv: 1706.03762`
- **THEN** the extracted arXiv ID is `1706.03762`

#### Scenario: arXiv ID in URL
- **WHEN** the selected item has no `archiveID` or Extra match but `url` is `https://arxiv.org/abs/2301.12345`
- **THEN** the extracted arXiv ID is `2301.12345`

#### Scenario: No arXiv ID found
- **WHEN** the selected item has no arXiv ID in any checked field
- **THEN** the extraction returns null, and the sidebar shows a placeholder

### Requirement: Paper lookup via external API
The plugin SHALL look up papers in Paperland using `GET /external-api/v1/papers/full?arxiv_id={id}&auto_create=true` with the configured Bearer token. This endpoint returns the paper's internal ID and auto-creates the paper if it doesn't exist.

#### Scenario: Paper exists
- **WHEN** the plugin calls the API with `arxiv_id=2603.04948` and the paper exists
- **THEN** the API returns the paper object with its internal `id`, and the plugin constructs the URL `{host}/papers/{id}`

#### Scenario: Paper auto-created
- **WHEN** the plugin calls the API with `arxiv_id=2603.04948` and the paper does not exist
- **THEN** the API creates the paper, runs services (arXiv fetch, Semantic Scholar, etc.), and returns the new paper object with its internal `id`

#### Scenario: API error handling
- **WHEN** the API call fails (network error, invalid token, server error)
- **THEN** the sidebar panel displays an error message with the failure reason (e.g., "Failed to connect to Paperland" or "Invalid API token")

### Requirement: Paper ID caching
The plugin SHALL cache the mapping from arXiv ID to Paperland internal ID in memory during the Zotero session. Cached entries SHALL be used to avoid redundant API calls when re-selecting a previously viewed paper.

#### Scenario: Cache hit on re-selection
- **WHEN** the user re-selects a paper whose arXiv ID was already resolved to Paperland ID `42`
- **THEN** the plugin skips the API call and immediately loads `{host}/papers/42`

#### Scenario: Cache cleared on restart
- **WHEN** Zotero restarts
- **THEN** the in-memory cache is empty and papers are re-resolved via API on first selection

### Requirement: Detail page URL construction
The plugin SHALL construct the paper detail page URL as `{host}/papers/{id}` where `host` is from preferences and `id` is the Paperland internal ID from the API response.

#### Scenario: URL with configured host
- **WHEN** host is `https://paperland.dev.mem.ac` and paper ID is `42`
- **THEN** the constructed URL is `https://paperland.dev.mem.ac/papers/42`

#### Scenario: Host with trailing slash
- **WHEN** host is `https://paperland.dev.mem.ac/` (trailing slash)
- **THEN** the constructed URL is `https://paperland.dev.mem.ac/papers/42` (no double slash)

### Requirement: Zotero tag sync via External API
The Zotero plugin SHALL sync tags to Paperland using the existing `PATCH /external-api/v1/papers/:id/tags` endpoint, automatically creating tags that don't exist in Paperland.

#### Scenario: Sync tags from Zotero
- **WHEN** the Zotero plugin sends `PATCH /external-api/v1/papers/:id/tags` with `{ add: ["tag1", "tag2"] }`
- **THEN** the system adds the specified tags to the paper, creating any tags that don't exist (with random colors), and updates papers.tags_json

#### Scenario: External API tag creation assigns color
- **WHEN** a tag is created via External API (tag name not found in system)
- **THEN** the new tag is assigned a random color from the predefined palette
