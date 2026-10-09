## MODIFIED Requirements

### Requirement: config.yml template fields
The system SHALL support a required top-level `qa` field in `config.yml`: an ordered array of preset QA entries, each with `name` (string identifier), `prompt` (the question text), and an optional `system_prompt` naming the system prompt file to use for that preset (see the `contextual-qa` capability). The `qa` list SHALL only define preset questions; system prompts SHALL NOT be written in `config.yml`.

The former top-level `system_prompt` template field (with `{PAPER}` and `{PROMPT}` placeholders) is removed. `qa` SHALL be validated by Zod at startup and SHALL be a required array with at least one entry. If `config.yml` still contains a top-level `system_prompt` key, startup SHALL fail with an error stating that it is deprecated and pointing to the system prompt files and `qa_prompt.default_system_prompt`.

#### Scenario: Valid config with template fields
- **WHEN** the application starts and `config.yml` contains a valid `qa` field and no top-level `system_prompt`
- **THEN** the system SHALL parse the field and make all preset questions available for QA operations

#### Scenario: Missing or invalid template fields
- **WHEN** `config.yml` is missing `qa`, or it has invalid format
- **THEN** the system SHALL fail startup with a clear Zod validation error (consistent with existing config validation behavior)

#### Scenario: QA entry format
- **WHEN** a QA entry in `config.yml` has `name` and `prompt` fields
- **THEN** the system SHALL use `name` as the template identifier (matching `template_name` in qa_entries table) and `prompt` as the question text

#### Scenario: Preset names its own system prompt
- **WHEN** a QA entry sets `system_prompt: kid-friendly` and `prompts/system/kid-friendly.md` exists
- **THEN** runs of that preset SHALL use `kid-friendly` as their system prompt, while presets without the field use the default

#### Scenario: Legacy system_prompt key rejected
- **WHEN** `config.yml` contains a top-level `system_prompt`
- **THEN** startup SHALL fail with a deprecation error naming the replacement configuration

## REMOVED Requirements

### Requirement: System prompt template for prompt assembly
**Reason**: The single-string `{PAPER}`/`{PROMPT}` template mixed rules and paper content into one user message. Model input is now assembled by the backend as a system prompt plus structured user content (paper, references, inputs, history, question), defined in the `contextual-qa` capability.
**Migration**: Delete the top-level `system_prompt` from `config.yml`; move its answering rules into `prompts/system/paper-qa.md` and set `qa_prompt.default_system_prompt: paper-qa`.

### Requirement: Template loader reads from config
**Reason**: Its `getSystemPrompt()` returned the removed `{PAPER}`/`{PROMPT}` template; replaced by "Template and system prompt loaders", whose `getSystemPrompt(name)` returns a system prompt file's text.
**Migration**: Call `getSystemPrompt(name)` with a system prompt name instead of reading a template string; `loadTemplates()` and `loadTemplate(name)` are unchanged.

## ADDED Requirements

### Requirement: Template and system prompt loaders
The `template_loader` module SHALL read preset data from the loaded `AppConfig` (via `getConfig()`) instead of the filesystem, and SHALL read system prompt text from the configured system prompts directory. It SHALL export:
- `loadTemplates()`: returns the ordered `qa` array from config
- `loadTemplate(name)`: returns a single QA entry by name, or null if not found
- `getSystemPrompt(name)`: given a system prompt name, returns the current content of the corresponding file, read at call time so edits take effect without restart

#### Scenario: loadTemplates returns ordered list
- **WHEN** `loadTemplates()` is called
- **THEN** it SHALL return all QA entries from config in their defined order, each containing `name` and `prompt` fields (and `system_prompt` when set)

#### Scenario: loadTemplate finds by name
- **WHEN** `loadTemplate("abstract")` is called and a QA entry with `name: abstract` exists
- **THEN** it SHALL return `{name: "abstract", prompt: "..."}` with the corresponding prompt

#### Scenario: loadTemplate returns null for missing
- **WHEN** `loadTemplate("nonexistent")` is called and no QA entry matches
- **THEN** it SHALL return null

#### Scenario: getSystemPrompt returns current file text
- **WHEN** `getSystemPrompt(name)` is called with `paper-qa` after `prompts/system/paper-qa.md` was edited
- **THEN** it SHALL return the edited file content as a plain system prompt string without placeholders, without a restart
