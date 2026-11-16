## MODIFIED Requirements

### Requirement: Portable Topic repository
Each Topic SHALL have its own server-side repository in configurable persistent storage, supporting standard authenticated HTTPS clone, pull, commit and push. A repository SHALL contain versioned Topic metadata, a shared reference catalog and Markdown documents with a documented schema version; schema v1 uses topic.json, reports.yml, references.json and pages/report.md while legacy format_version: 1/2 history remains readable. PDFs and large media SHALL remain in existing site storage.

#### Scenario: Agent maintains a Topic
- **WHEN** a member clones a Topic, edits its required files, commits and pushes
- **THEN** a successful push SHALL immediately make that complete version available to readers without a separate publication action

### Requirement: V2 pages and agent workspace
Schema v1 SHALL publish nested pages/**/*.md, defaulting to pages/report.md, with references.json as the sole numbered catalog. Root AGENTS.md SHALL be an agent-guide exception. README and auxiliary regular files SHALL be Git workspace content without website rendering/execution. Path and resource limits SHALL apply; symlinks/submodules and executable published files SHALL remain forbidden.

#### Scenario: Agent stores working artifacts
- **WHEN** an authorized editor pushes valid pages/catalog plus bounded scripts, notes or binary workspace files
- **THEN** Git SHALL preserve those files while the website publishes only the validated document/catalog snapshot
- **AND** no auxiliary code SHALL run on the server

### Requirement: Preserve legacy versions during layout migration
Legacy format_version: 1/2 history SHALL stay readable. Current repositories SHALL migrate to schema v1 through a new audited commit preserving original report blobs, reference numbers, ACLs and untouched workspace files. Repeating migration SHALL not create duplicate commits. Upgraded repositories SHALL reject format downgrade.

#### Scenario: Move an existing report
- **WHEN** migration moves root report.md into pages/report.md
- **THEN** the old commit SHALL remain reachable and the moved report body SHALL be preserved
