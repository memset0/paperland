## ADDED Requirements

### Requirement: template.yml file format
The system SHALL use a single `template.yml` file in the project root directory to define all QA template configuration. The file SHALL contain two top-level keys:
- `system_prompt`: a multiline string template defining how paper content and question are combined, using `{PAPER}` as the paper content placeholder and `{PROMPT}` as the question placeholder
- `qa`: an ordered array of QA template entries, each with `name` (string identifier) and `prompt` (the question text)

#### Scenario: Valid template.yml is loaded at startup
- **WHEN** the application starts and `template.yml` exists with valid YAML containing `system_prompt` and `qa` keys
- **THEN** the system SHALL parse the file and make all templates available for QA operations

#### Scenario: template.yml is missing or invalid
- **WHEN** the application starts and `template.yml` is missing or contains invalid YAML
- **THEN** the system SHALL log a clear error message and return an empty template list (graceful degradation)

#### Scenario: QA entry format
- **WHEN** a QA entry in `template.yml` has `name` and `prompt` fields
- **THEN** the system SHALL use `name` as the template identifier (matching `template_name` in qa_entries table) and `prompt` as the question text

### Requirement: System prompt template for prompt assembly
The system SHALL use the `system_prompt` template from `template.yml` to assemble the final prompt sent to the model. The assembly process SHALL replace `{PAPER}` with the resolved paper content and `{PROMPT}` with the specific question.

#### Scenario: Template QA prompt assembly
- **WHEN** a template QA is triggered for a paper
- **THEN** the system SHALL take the `system_prompt` string, replace `{PAPER}` with the paper's resolved content, and replace `{PROMPT}` with the template's `prompt` value

#### Scenario: Free QA prompt assembly
- **WHEN** a free-form question is submitted for a paper
- **THEN** the system SHALL take the `system_prompt` string, replace `{PAPER}` with the paper's resolved content, and replace `{PROMPT}` with the user's question

### Requirement: QA template ordering
The system SHALL preserve the order of QA entries as defined in the `qa` array of `template.yml`. This order SHALL be used consistently in API responses and frontend display.

#### Scenario: API returns templates in config order
- **WHEN** `GET /api/templates` is called
- **THEN** the response SHALL return templates in the exact order they appear in `template.yml`'s `qa` array

#### Scenario: Frontend displays templates in config order
- **WHEN** the TemplateQA component renders the template list
- **THEN** templates SHALL be displayed in the order received from the API (which matches `template.yml` order)

### Requirement: Template loader interface
The `template_loader` module SHALL export the following functions:
- `loadTemplates()`: returns an ordered array of `{name, prompt}` objects from the `qa` list
- `loadTemplate(name)`: returns a single template by name, or null if not found
- `getSystemPrompt()`: returns the `system_prompt` string from `template.yml`

#### Scenario: loadTemplates returns ordered list
- **WHEN** `loadTemplates()` is called
- **THEN** it SHALL return all QA entries from `template.yml` in their defined order, each containing `name` and `prompt` fields

#### Scenario: loadTemplate finds by name
- **WHEN** `loadTemplate("abstract")` is called and a QA entry with `name: abstract` exists
- **THEN** it SHALL return `{name: "abstract", prompt: "..."}` with the corresponding prompt

#### Scenario: loadTemplate returns null for missing
- **WHEN** `loadTemplate("nonexistent")` is called and no QA entry matches
- **THEN** it SHALL return null

#### Scenario: getSystemPrompt returns template string
- **WHEN** `getSystemPrompt()` is called
- **THEN** it SHALL return the `system_prompt` string from `template.yml` containing `{PAPER}` and `{PROMPT}` placeholders

### Requirement: Remove templates directory
The `templates/` directory with individual `.md` files SHALL be removed. All template content SHALL be migrated to `template.yml`.

#### Scenario: Migration from .md files to template.yml
- **WHEN** the refactor is complete
- **THEN** the `templates/` directory SHALL no longer exist, and all previous template content (abstract, method, experiment) SHALL be represented as QA entries in `template.yml`
