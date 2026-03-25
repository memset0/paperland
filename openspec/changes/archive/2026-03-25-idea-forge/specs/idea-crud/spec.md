## ADDED Requirements

### Requirement: List ideas for a project
The system SHALL list all ideas across all categories for a given project by scanning `data/idea-forge/{project}/ideas/{category}/{idea-name}/README.md` files. Each idea entry SHALL include parsed frontmatter fields and the category derived from the directory path.

#### Scenario: List all ideas with default sort
- **WHEN** GET `/api/idea-forge/projects/:name/ideas` is called without query params
- **THEN** the system returns all ideas sorted by `update_time` descending
- **AND** each idea includes: `name`, `category`, `tags`, `create_time`, `update_time`, `my_score`, `llm_score`, `summary`, `my_comment`, `dir_name`

#### Scenario: Filter ideas by category
- **WHEN** GET `/api/idea-forge/projects/:name/ideas?category=unreviewed` is called
- **THEN** only ideas in the `unreviewed` category are returned

#### Scenario: Filter ideas by tag
- **WHEN** GET `/api/idea-forge/projects/:name/ideas?tag=reinforcement-learning` is called
- **THEN** only ideas whose `tags` array includes `reinforcement-learning` are returned

#### Scenario: Sort ideas by create_time
- **WHEN** GET `/api/idea-forge/projects/:name/ideas?sort=create_time&order=asc` is called
- **THEN** ideas are sorted by `create_time` ascending

#### Scenario: Frontmatter parse error
- **WHEN** an idea's README.md has malformed YAML frontmatter
- **THEN** the idea is still returned with `parse_error: true` and empty metadata fields

### Requirement: Get idea detail
The system SHALL return the full content of an idea's README.md including parsed frontmatter, body content, and a `content_hash` (SHA-256 of the raw file bytes).

#### Scenario: Get existing idea
- **WHEN** GET `/api/idea-forge/projects/:name/ideas/:category/:ideaName` is called
- **THEN** the system returns `{ frontmatter: {...}, body: "...", content_hash: "...", category: "...", dir_name: "..." }`

#### Scenario: Idea not found
- **WHEN** GET is called for a non-existent idea
- **THEN** the system returns 404 Not Found

### Requirement: Update idea content
The system SHALL update an idea's README.md file. The request MUST include `content_hash` for conflict detection. The system SHALL update `update_time` in the frontmatter to the current timestamp when the save is triggered by the web UI.

#### Scenario: Successful update
- **WHEN** PUT `/api/idea-forge/projects/:name/ideas/:category/:ideaName` is called with `{ content_hash: "abc...", frontmatter: {...}, body: "..." }`
- **AND** the provided `content_hash` matches the current file's SHA-256
- **THEN** the system writes the updated frontmatter + body to README.md and returns the new `content_hash`

#### Scenario: Conflict detected
- **WHEN** PUT is called with a `content_hash` that does not match the current file
- **THEN** the system returns 409 Conflict with `{ error: { code: "CONFLICT", message: "File has been modified externally" } }`
- **AND** the file is NOT modified

#### Scenario: Update score only
- **WHEN** PUT is called with only `frontmatter.my_score` changed
- **THEN** the system updates the score in frontmatter and saves, preserving all other content

#### Scenario: Update comment only
- **WHEN** PUT is called with only `frontmatter.my_comment` changed
- **THEN** the system updates the comment in frontmatter and saves

### Requirement: Move idea to different category
The system SHALL move an idea directory from one category to another by renaming/moving the directory from `ideas/{old-category}/{idea-name}/` to `ideas/{new-category}/{idea-name}/`. The move operation MUST include `content_hash` for conflict detection (since it modifies `update_time` in frontmatter). If the hash does not match, the move SHALL be rejected with 409 Conflict.

#### Scenario: Move idea to new category
- **WHEN** PATCH `/api/idea-forge/projects/:name/ideas/:category/:ideaName/move` is called with `{ "target_category": "under-review", "content_hash": "abc..." }`
- **AND** the provided `content_hash` matches the current file's SHA-256
- **THEN** the system updates the idea's `update_time` in frontmatter
- **AND** moves the idea directory to `ideas/under-review/{ideaName}/`
- **AND** returns the updated idea detail with the new `content_hash`

#### Scenario: Move conflict detected
- **WHEN** PATCH move is called with a `content_hash` that does not match the current file
- **THEN** the system returns 409 Conflict with `{ error: { code: "CONFLICT", message: "File has been modified externally" } }`
- **AND** the idea is NOT moved

#### Scenario: Target category same as current
- **WHEN** PATCH move is called with `target_category` equal to current category
- **THEN** the system returns 200 with no changes

#### Scenario: Idea name conflict in target category
- **WHEN** an idea with the same `dir_name` already exists in the target category
- **THEN** the system returns 409 Conflict with `{ error: { code: "NAME_CONFLICT", message: "Idea already exists in target category" } }`

#### Scenario: Invalid category
- **WHEN** PATCH move is called with a `target_category` not in `[unreviewed, under-review, validating, archived]`
- **THEN** the system returns 400 Bad Request

### Requirement: Valid idea categories
The system SHALL recognize exactly four idea categories: `unreviewed`, `under-review`, `validating`, `archived`. All API endpoints that accept a category parameter SHALL validate against this list.

#### Scenario: Request with invalid category
- **WHEN** any API endpoint receives a category value not in the allowed list
- **THEN** the system returns 400 Bad Request with an appropriate error message

### Requirement: Frontmatter schema
The system SHALL parse and serialize idea frontmatter with the following fields: `name` (string), `author` (string — the creator of this idea, e.g. `"me"` for human, `"gpt-5.4"` for Codex, `"claude-opus-4.6"` for Claude, etc.), `tags` (string array), `create_time` (ISO 8601 with timezone), `update_time` (ISO 8601 with timezone), `my_score` (number 0-5), `llm_score` (number 0-5), `my_comment` (string), `summary` (string).

#### Scenario: All fields present
- **WHEN** frontmatter contains all expected fields
- **THEN** all fields are parsed and returned with correct types

#### Scenario: Missing optional fields
- **WHEN** frontmatter is missing some fields (e.g., `llm_score`, `my_comment`)
- **THEN** missing fields default to: `author: ""`, `my_score: 0`, `llm_score: 0`, `my_comment: ""`, `summary: ""`, `tags: []`

#### Scenario: Preserve unknown fields
- **WHEN** frontmatter contains fields not in the schema (e.g., added by an agent)
- **THEN** unknown fields are preserved during read and write operations
