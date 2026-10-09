## MODIFIED Requirements

### Requirement: Content priority configuration
The config SHALL support a `content_priority` array of strings defining the priority order for Q&A text context sources. When `content_priority` is absent, the default SHALL be `[user_input, doc2x_parsed, pdf_parsed]`.

#### Scenario: Default content priority
- **WHEN** config.yml contains `content_priority: [user_input, doc2x_parsed, pdf_parsed]`
- **THEN** the system SHALL use user_input first, then doc2x_parsed, then pdf_parsed when selecting text context for Q&A

#### Scenario: Priority omitted
- **WHEN** config.yml has no `content_priority`
- **THEN** the system SHALL use `[user_input, doc2x_parsed, pdf_parsed]`

## ADDED Requirements

### Requirement: Doc2X configuration
The config SHALL accept an optional `doc2x` block: `enabled` (boolean, default false), `cli_path` (default `doc2x`), `timeout` (seconds, default 1800), `output_dir` (default `./data/doc2x`), `auto_since` (ISO timestamp; papers created at or after it are automatically doc2x-parsed), `token_file` (default `~/.config/doc2x/cli-oauth-tokens.json`), `gateway_url` (default `https://v2c.doc2x.noedgeai.com`), `parse.formula_mode` (default `dollar`), and `translate.{target_language (default zh), model (default "85"), pdf_font_strategy (default page-optimal), ignore_types (default [reference])}`. When the block is absent, doc2x features SHALL be disabled.

#### Scenario: Doc2X block absent
- **WHEN** config.yml has no `doc2x` block
- **THEN** config loading SHALL succeed, doc2x SHALL be disabled, and the doc2x services SHALL never be scheduled

#### Scenario: Translation model configured
- **WHEN** `doc2x.translate.model` is `"85"`
- **THEN** translations SHALL use doc2x model 85
