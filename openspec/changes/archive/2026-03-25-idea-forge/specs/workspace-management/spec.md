## ADDED Requirements

### Requirement: List projects
The system SHALL return a list of all projects by scanning directories under `data/idea-forge/`. Each project entry SHALL include `name` (directory name), `idea_count` (total ideas across all categories), and `paper_count` (total papers dumped).

#### Scenario: List projects with existing data
- **WHEN** GET `/api/idea-forge/projects` is called
- **THEN** the system returns an array of project objects with `name`, `idea_count`, `paper_count`, and `created_at` (directory creation time)

#### Scenario: No projects exist
- **WHEN** GET `/api/idea-forge/projects` is called and `data/idea-forge/` contains no project directories
- **THEN** the system returns an empty array

### Requirement: Create project
The system SHALL create a new project by initializing the directory structure: `data/idea-forge/{name}/papers/`, `data/idea-forge/{name}/ideas/unreviewed/`, `data/idea-forge/{name}/ideas/under-review/`, `data/idea-forge/{name}/ideas/validating/`, `data/idea-forge/{name}/ideas/archived/`, `data/idea-forge/{name}/AGENTS.md`, and `data/idea-forge/{name}/project.json`. The project MAY include an optional `paper_filter` with `tag_names` to persist the default paper dump filter.

#### Scenario: Create new project
- **WHEN** POST `/api/idea-forge/projects` is called with `{ "name": "my-project" }`
- **THEN** the system creates the full directory structure, writes `project.json`, and returns the project info including `config`

#### Scenario: Create project with paper filter
- **WHEN** POST `/api/idea-forge/projects` is called with `{ "name": "my-project", "paper_filter": { "tag_names": ["rl", "multi-agent"] } }`
- **THEN** the system creates the project and saves the paper filter to `project.json`

#### Scenario: Project name already exists
- **WHEN** POST `/api/idea-forge/projects` is called with a name that already exists
- **THEN** the system returns 409 Conflict with error message

#### Scenario: Invalid project name
- **WHEN** POST `/api/idea-forge/projects` is called with a name containing characters other than `[a-z0-9-_]`
- **THEN** the system returns 400 Bad Request

### Requirement: Project config persistence
Each project SHALL have a `project.json` file storing project-level configuration. The config MAY include `paper_filter: { tag_names: string[] }` to persist the default tag filter for paper dumps. The project list endpoint SHALL return the config for each project.

#### Scenario: Update project config
- **WHEN** PATCH `/api/idea-forge/projects/:name/config` is called with `{ "paper_filter": { "tag_names": ["rl"] } }`
- **THEN** the system updates `project.json` and returns the new config

#### Scenario: Clear paper filter
- **WHEN** PATCH `/api/idea-forge/projects/:name/config` is called with `{ "paper_filter": null }`
- **THEN** the `paper_filter` field is removed from `project.json`

#### Scenario: Read project with config
- **WHEN** GET `/api/idea-forge/projects` is called
- **THEN** each project includes a `config` field with the contents of `project.json`

### Requirement: Dump papers to project
The system SHALL export papers to the project's `papers/` directory. Papers can be selected by tag filter (`tag_ids`) OR by direct paper selection (`paper_ids`). Each paper creates a subdirectory named by the paper's sanitized title, containing `metadata.json` and `full_text.md`.

#### Scenario: Dump papers with tag filter
- **WHEN** POST `/api/idea-forge/projects/:name/dump-papers` is called with `{ "tag_ids": [1, 2] }`
- **THEN** the system exports all papers matching ALL specified tags to `data/idea-forge/{name}/papers/`
- **AND** each paper directory contains `metadata.json` with `{ id, title, authors, abstract, arxiv_id, corpus_id, link, tags, created_at, updated_at }`
- **AND** each paper directory contains `full_text.md` with the resolved paper content (following `content_priority` from config)

#### Scenario: Dump papers by direct selection
- **WHEN** POST `/api/idea-forge/projects/:name/dump-papers` is called with `{ "paper_ids": [10, 20, 30] }`
- **THEN** the system exports exactly those papers to the project's `papers/` directory

#### Scenario: Dump papers without any filter
- **WHEN** POST `/api/idea-forge/projects/:name/dump-papers` is called with no `tag_ids` and no `paper_ids`
- **THEN** the system exports ALL papers to the project

#### Scenario: Paper has no content
- **WHEN** a paper has no resolved content (all content sources empty)
- **THEN** `full_text.md` is created as an empty file

#### Scenario: Paper already dumped
- **WHEN** a paper's directory already exists in `papers/`
- **THEN** the system overwrites the existing files with fresh data

### Requirement: Sanitize paper directory names
The system SHALL sanitize paper titles for use as directory names by: replacing spaces with hyphens, removing special characters except `[a-zA-Z0-9-_]`, truncating to 100 characters, and appending `-{paper_id}` to ensure uniqueness.

#### Scenario: Title with special characters
- **WHEN** a paper title is "Attention Is All You Need: A Survey (2024)"
- **THEN** the directory name is `Attention-Is-All-You-Need-A-Survey-2024-{id}`

### Requirement: Idea-forge directory auto-creation
The system SHALL ensure the `data/idea-forge/` directory exists when the backend starts. If it does not exist, the system SHALL create it.

#### Scenario: First startup without idea-forge directory
- **WHEN** the backend starts and `data/idea-forge/` does not exist
- **THEN** the system creates the `data/idea-forge/` directory

### Requirement: Demo project initialization
The system SHALL include a `data/idea-forge/demo-project/` directory in the repository with a pre-written `AGENTS.md` file describing the project structure, idea format, and workflow conventions for AI agents.

#### Scenario: Demo project exists in repo
- **WHEN** a developer clones the repository
- **THEN** `data/idea-forge/demo-project/AGENTS.md` exists with documentation of the project structure and conventions
