## ADDED Requirements

### Requirement: Translations table
The database SHALL have a `translations` table with columns: `id` (integer, primary key, autoincrement), `source_hash` (text, not null, SHA-256 hex of the normalized source text), `source_text` (text, not null, the normalized source), `source_lang` (text, not null, default "en"), `target_lang` (text, not null, default "zh"), `translated_text` (text, not null), `model_name` (text, nullable), `created_at` (text, not null, ISO 8601), `updated_at` (text, not null, ISO 8601). The table SHALL enforce a unique constraint on `(source_hash, target_lang)`, and SHALL have an index on `source_hash` for lookup by hash. This is an additive migration (CREATE TABLE only); no existing tables are changed and no backfill is required.

#### Scenario: Create translation cache row
- **WHEN** a translation is inserted with a `source_hash`, `source_text`, `translated_text`, `source_lang` "en", and `target_lang` "zh"
- **THEN** the row SHALL be stored and retrievable by `(source_hash, target_lang)`, with `updated_at` set equal to `created_at`

#### Scenario: Unique constraint on source_hash + target_lang
- **WHEN** a translation for a given `(source_hash, target_lang)` already exists and another insert attempts the same pair
- **THEN** the database SHALL reject the insert with a unique constraint violation

#### Scenario: Re-translate updates the same row
- **WHEN** a re-translation is persisted for an existing `(source_hash, target_lang)`
- **THEN** the existing row's `translated_text`, `model_name`, and `updated_at` SHALL be updated in place and no duplicate row SHALL be created

#### Scenario: Lookup by hash
- **WHEN** a translation is queried by its `source_hash`
- **THEN** the matching cached row(s) SHALL be returned using the `source_hash` index
