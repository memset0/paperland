# topic-git Specification

## Purpose

Let local agents maintain research Topics using standard Git clients while protecting version history and publishing coherent validated content with recoverable indexing.

## Requirements

### Requirement: Portable Topic repository
Each Topic SHALL have its own server-side repository in configurable persistent storage, supporting standard authenticated HTTPS clone, pull, commit and push. A repository SHALL contain versioned Topic metadata, a shared reference catalog and Markdown documents with a documented format version; v2 uses topic.json, references.json and pages/report.md while v1 history remains readable. PDFs and large media SHALL remain in existing site storage.

#### Scenario: Agent maintains a Topic
- **WHEN** a member clones a Topic, edits its required files, commits and pushes
- **THEN** a successful push SHALL immediately make that complete version available to readers without a separate publication action

### Requirement: Main branch fast-forward updates
Only fast-forward changes to the Topic's main branch SHALL be accepted. Deleting main, force updates, other refs and stale concurrent writes SHALL be refused. The server SHALL serialize publication per Topic and recheck the authenticated user's current edit permission before updating it.

#### Scenario: Concurrent editors
- **WHEN** two editors push from the same original head and the first push succeeds
- **THEN** the second stale push SHALL fail and require fetching/merging the first update

### Requirement: Validate introduced versions before accepting
Every introduced commit SHALL have valid required files, bounded UTF-8 content, valid paper references, unique stable IDs and a non-cyclic directory tree. Unsafe paths, symlinks, submodules, executable published files, malformed formats and oversized payloads SHALL be rejected. Validation SHALL NOT execute repository code or contact external services.

#### Scenario: Invalid intermediate commit
- **WHEN** a push contains an invalid intermediate version followed by a valid tip
- **THEN** the entire push SHALL be rejected without changing the published report, list or tags

#### Scenario: Corrupt list or unsafe entry
- **WHEN** papers.json is invalid or the tree contains a symlink or submodule
- **THEN** the push SHALL fail with an actionable reason and the prior complete version SHALL remain readable

### Requirement: Coherent publication and recovery
A successful push SHALL publish report, list, current hierarchical index and uploader audit consistently. If synchronization fails or the process stops, readers SHALL retain the preceding complete indexed version until recovery finishes. Durable recovery data SHALL connect the validated commit with the original uploader. Success SHALL NOT be reported before indexing completes.

#### Scenario: Crash after Git advances
- **WHEN** Git advances but database publication is interrupted
- **THEN** recovery SHALL idempotently publish the matching validated snapshot and original push audit before accepting another update
- **AND** readers SHALL never receive a report from one commit and list/tags from another

### Requirement: Configurable limits and restoration
Repository location, Git executable and operation/content limits SHALL be configurable with safe defaults. Restoring repositories together with database/audit data SHALL preserve Topic ownership and versions, and permit rebuilding derived current indexes without rewriting history.

#### Scenario: Move persistent storage
- **WHEN** the deployment restores the same database and Topic repositories at a newly configured location
- **THEN** Topics, history and authorized Git access SHALL remain usable

### Requirement: Supplementary document files
The repository SHALL allow bounded safe pages/*.md files alongside its required root files. Validation SHALL enforce individual and aggregate size limits, safe non-executable blobs, valid frontmatter and existing reference subsets for every introduced version. Web metadata-only rename SHALL preserve every document blob. Current/history snapshots SHALL include the same complete document set as their catalog.

#### Scenario: Push a report split
- **WHEN** a member adds two valid research pages and their reference-number subsets in one commit
- **THEN** readers SHALL see both pages and the matching catalog at that commit

### Requirement: V2 pages and agent workspace
Format2 SHALL publish nested pages/**/*.md, defaulting to pages/report.md, with references.json as the sole numbered catalog. Root AGENTS.md SHALL be an agent-guide exception. README and auxiliary regular files SHALL be Git workspace content without website rendering/execution. Path and resource limits SHALL apply; symlinks/submodules and executable published files SHALL remain forbidden.

#### Scenario: Agent stores working artifacts
- **WHEN** an authorized editor pushes valid pages/catalog plus bounded scripts, notes or binary workspace files
- **THEN** Git SHALL preserve those files while the website publishes only the validated document/catalog snapshot
- **AND** no auxiliary code SHALL run on the server

### Requirement: Preserve legacy versions during layout migration
V1 history SHALL stay readable. Current repositories SHALL migrate to format2 through a new audited commit preserving original report blobs, reference numbers, ACLs and untouched workspace files. Repeating migration SHALL not create duplicate commits. Upgraded repositories SHALL reject format downgrade.

#### Scenario: Move an existing report
- **WHEN** migration moves root report.md into pages/report.md
- **THEN** the old commit SHALL remain reachable and the moved report body SHALL be preserved
