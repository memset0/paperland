# template-yaml-config Specification

## Purpose
Unified QA template configuration in config.yml, including system prompt template and ordered QA question list.

## Requirements
### Requirement: config.yml template fields
The system SHALL support two new top-level fields in `config.yml`:
- `system_prompt`: a multiline string template defining how paper content and question are combined, using `{PAPER}` as the paper content placeholder and `{PROMPT}` as the question placeholder
- `qa`: an ordered array of QA template entries, each with `name` (string identifier) and `prompt` (the question text)

Both fields SHALL be validated by Zod at startup. `system_prompt` SHALL be a required string. `qa` SHALL be a required array with at least one entry.

#### Scenario: Valid config with template fields
- **WHEN** the application starts and `config.yml` contains valid `system_prompt` and `qa` fields
- **THEN** the system SHALL parse both fields and make all templates available for QA operations

#### Scenario: Missing or invalid template fields
- **WHEN** `config.yml` is missing `system_prompt` or `qa`, or they have invalid format
- **THEN** the system SHALL fail startup with a clear Zod validation error (consistent with existing config validation behavior)

#### Scenario: QA entry format
- **WHEN** a QA entry in `config.yml` has `name` and `prompt` fields
- **THEN** the system SHALL use `name` as the template identifier (matching `template_name` in qa_entries table) and `prompt` as the question text

### Requirement: System prompt template for prompt assembly
The system SHALL use the `system_prompt` from `config.yml` to assemble the final prompt sent to the model. The assembly process SHALL replace `{PAPER}` with the resolved paper content and `{PROMPT}` with the specific question.

#### Scenario: Template QA prompt assembly
- **WHEN** a template QA is triggered for a paper
- **THEN** the system SHALL take the `system_prompt` string, replace `{PAPER}` with the paper's resolved content, and replace `{PROMPT}` with the template's `prompt` value

#### Scenario: Free QA prompt assembly
- **WHEN** a free-form question is submitted for a paper
- **THEN** the system SHALL take the `system_prompt` string, replace `{PAPER}` with the paper's resolved content, and replace `{PROMPT}` with the user's question

### Requirement: QA template ordering
The system SHALL preserve the order of QA entries as defined in the `qa` array of `config.yml`. This order SHALL be used consistently in API responses and frontend display.

#### Scenario: API returns templates in config order
- **WHEN** `GET /api/templates` is called
- **THEN** the response SHALL return templates in the exact order they appear in `config.yml`'s `qa` array

#### Scenario: Frontend displays templates in config order
- **WHEN** the TemplateQA component renders the template list
- **THEN** templates SHALL be displayed in the order received from the API (which matches `config.yml` order)

### Requirement: Template loader reads from config
The `template_loader` module SHALL read template data from the loaded `AppConfig` (via `getConfig()`) instead of the filesystem. It SHALL export:
- `loadTemplates()`: returns the ordered `qa` array from config
- `loadTemplate(name)`: returns a single QA entry by name, or null if not found
- `getSystemPrompt()`: returns the `system_prompt` string from config

#### Scenario: loadTemplates returns ordered list
- **WHEN** `loadTemplates()` is called
- **THEN** it SHALL return all QA entries from config in their defined order, each containing `name` and `prompt` fields

#### Scenario: loadTemplate finds by name
- **WHEN** `loadTemplate("abstract")` is called and a QA entry with `name: abstract` exists
- **THEN** it SHALL return `{name: "abstract", prompt: "..."}` with the corresponding prompt

#### Scenario: loadTemplate returns null for missing
- **WHEN** `loadTemplate("nonexistent")` is called and no QA entry matches
- **THEN** it SHALL return null

#### Scenario: getSystemPrompt returns template string
- **WHEN** `getSystemPrompt()` is called
- **THEN** it SHALL return the `system_prompt` string from config containing `{PAPER}` and `{PROMPT}` placeholders

### Requirement: Remove templates directory
The `templates/` directory with individual `.md` files SHALL be removed. All template content SHALL be migrated into `config.yml`.

#### Scenario: Migration from .md files to config.yml
- **WHEN** the refactor is complete
- **THEN** the `templates/` directory SHALL no longer exist, and all previous template content (abstract, method, experiment) SHALL be represented as QA entries in the `qa` field of `config.yml`
