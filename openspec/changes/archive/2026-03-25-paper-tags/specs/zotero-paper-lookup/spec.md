## MODIFIED Requirements

### Requirement: Zotero tag sync via External API
The Zotero plugin SHALL sync tags to Paperland using the existing `PATCH /external-api/v1/papers/:id/tags` endpoint, automatically creating tags that don't exist in Paperland.

#### Scenario: Sync tags from Zotero
- **WHEN** the Zotero plugin sends `PATCH /external-api/v1/papers/:id/tags` with `{ add: ["tag1", "tag2"] }`
- **THEN** the system adds the specified tags to the paper, creating any tags that don't exist (with random colors), and updates papers.tags_json

#### Scenario: External API tag creation assigns color
- **WHEN** a tag is created via External API (tag name not found in system)
- **THEN** the new tag is assigned a random color from the predefined palette
