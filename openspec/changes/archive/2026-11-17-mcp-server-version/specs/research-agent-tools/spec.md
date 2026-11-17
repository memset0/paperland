## ADDED Requirements

### Requirement: MCP server version follows Paperland version
The MCP `initialize` result SHALL report `serverInfo.version` equal to the `version` field of the root `package.json`, read when the backend starts, and its instructions SHALL begin with `Paperland MCP server <version>.`.

#### Scenario: Version reported on connect
- **WHEN** the root `package.json` version is `2.3.16` and a client sends `initialize`
- **THEN** `serverInfo.version` SHALL be `2.3.16` and the instructions SHALL start with `Paperland MCP server 2.3.16.`
