# Proposal

## Why

Folder sorting and a repeated folder/index page make Topic navigation difficult to scan. Agents also need a single, explicit versioned contract for pages, global references and safe migration, rather than learning it from earlier conversations.

## What Changes

- Name the current complete repository contract **schema v1**, declared as `schema_version: 1` in `topic.json`.
- Add a root `reports.yml` navigation manifest defining ordered pages and nested groups. Keep `pages/report.md` as the default document and use page frontmatter titles/icons.
- Render this curated tree without repeating a folder's index page; preserve clean routes, collapsed references and citation cards.
- Continue reading the previous `format_version: 1/2` layouts as legacy encodings, including historical commits. Reject unsupported future versions with actionable guidance.
- Expose current/detected/supported versions, full format examples, validation rules and explicit migration instructions through MCP. Provide an idempotent audited migration and migrate current repositories without rewriting history.
- Maintain Topic3's tailored navigation through its own MCP and authenticated Git identity.

## Capabilities

### New Capabilities

- `topic-schema`: Repository schema discovery, legacy compatibility, navigation manifest validation and migration guidance.

### Modified Capabilities

- `topics`: Manifest-driven navigation with ordered nested groups and frontmatter metadata; canonical schema v1 terminology.
- `topic-git`: Schema v1 repository files and migration without losing historical layouts or auxiliary files.
- `research-agent-tools`: Discoverable version-specific contract and migration instructions over MCP.

## Impact

Topic parsers, normalized snapshot/shared types, Git validation and migration, Topic navigation components, MCP tools and initialize instructions, offline tests, and docs/topics.md plus the three architecture documents. No database schema change or new dependency. `reports.yml` is the chosen manifest filename; the existing default `pages/report.md` remains fixed.
