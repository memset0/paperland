## ADDED Requirements

### Requirement: Upload media by URL
The MCP `upload_image` tool SHALL accept a `url` input (http/https) as an alternative to `path` and `data`, exactly one of the three. The server SHALL download the file under the same rules as `POST /external-api/v1/images?url=` and store it as an image or video. The result SHALL be the same shape as other uploads. The tool description SHALL tell agents that local files larger than a small screenshot should be uploaded with `POST /external-api/v1/images` instead of base64 `data`.

#### Scenario: Video by URL
- **WHEN** an agent calls `upload_image` with `url` pointing to an MP4
- **THEN** the result SHALL contain a `/image/…mp4` URL and Markdown `![alt](url)`

### Requirement: Skill lookup tool
The MCP server SHALL provide the read-only tool `get_skill(name?)` over the skills in `agent_tools.skills_dir`, as specified by the blog import skill requirement. It SHALL be available to personal and agent tokens.

#### Scenario: Read a skill
- **WHEN** an agent calls `get_skill` with name "blog-import"
- **THEN** the result SHALL be the text of `prompts/skills/blog-import/SKILL.md`
