## Purpose

Give Topic maintainers a discoverable versioned repository contract with validated navigation and safe, history-preserving upgrades.

## ADDED Requirements

### Requirement: Canonical schema v1
The current complete Topic contract SHALL be named schema v1 and declared as schema_version: 1 in topic.json. It SHALL require pages/report.md, references.json and reports.yml. Previous format_version: 1/2 encodings SHALL remain readable as legacy layouts, including historical commits. Unknown future versions SHALL fail with supported-version guidance rather than being misinterpreted.

#### Scenario: Read existing history
- **WHEN** a caller reads a legacy root-report or pages-layout commit
- **THEN** its content SHALL remain readable and its legacy encoding SHALL be identified separately from the current schema v1

#### Scenario: Unsupported schema
- **WHEN** a push declares schema_version: 2 before that version is supported
- **THEN** validation SHALL reject the push and state the supported schema versions

### Requirement: Complete ordered reports manifest
Schema v1 reports.yml SHALL declare schema_version: 1, default_page: pages/report.md and an ordered reports tree. Entries SHALL reference existing pages under pages/ or be titled groups with children. Every published page SHALL occur exactly once. Invalid, duplicate, omitted or unsafe paths, excessive nesting and inconsistent versions SHALL reject the complete push.

#### Scenario: Add a page without navigation
- **WHEN** a new pages/results.md is pushed without adding it to reports.yml
- **THEN** publication SHALL fail with the omitted page path and the previous complete version SHALL remain visible

#### Scenario: Reorder without renaming
- **WHEN** a maintainer reorders valid manifest entries
- **THEN** readers SHALL see that order while page routes and reference numbers remain unchanged

### Requirement: Discoverable schema and migration instructions
MCP SHALL offer a read-only version-specific schema contract with required files, complete examples, reference rules, limits and supported legacy migrations. get_topic SHALL identify the selected commit's encoding, current/supported schema versions and whether migration is needed. Unsupported requested versions SHALL return an actionable error. Guidance SHALL use schema v1 consistently and preserve the caller's Topic scope.

#### Scenario: Agent opens an old Topic
- **WHEN** get_topic reads a legacy format_version: 2 commit
- **THEN** the response SHALL identify it as legacy, report schema v1 as current, and explain adding reports.yml and the canonical metadata without rewriting previous commits

### Requirement: Idempotent audited schema migration
Current repositories SHALL migrate through new audited commits, preserving page bodies, reference identities/numbers, ACLs and auxiliary files. Migration SHALL support a read-only plan, consistent database backup, restart recovery and verification. Repeated migration SHALL skip completed repositories. Schema v1 commits SHALL not downgrade to legacy encodings.

#### Scenario: Retry a completed upgrade
- **WHEN** migration runs again after completion
- **THEN** it SHALL create no duplicate commits and SHALL preserve later edits

#### Scenario: Read pre-migration pages
- **WHEN** a reader selects a commit from before schema migration
- **THEN** its original pages, references and navigation fallback SHALL still display together
