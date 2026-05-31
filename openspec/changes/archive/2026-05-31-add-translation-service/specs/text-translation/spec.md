## ADDED Requirements

### Requirement: Format-preserving English-to-Chinese translation service
The system SHALL provide a translation service that takes a single piece of text (Markdown or plain text) and translates it from English to Simplified Chinese by calling a configured AI model. The translation SHALL preserve the original formatting exactly: Markdown syntax, code blocks, inline code, LaTeX math, lists, tables, and line breaks SHALL be kept unchanged; only natural-language text SHALL be translated. The service SHALL output only the translated text, with no added explanation or wrapping. The service SHALL be a pure (manually / programmatically triggered) service, not part of the paper dependency graph, and SHALL expose a reusable function (e.g. `translateText(text)`) returning the translated result.

#### Scenario: Translate plain English text
- **WHEN** the service is asked to translate the English text "This paper proposes a new method."
- **THEN** it SHALL return Simplified Chinese translation of that text
- **AND** SHALL not include the original English or any extra commentary

#### Scenario: Preserve Markdown and code formatting
- **WHEN** the service translates Markdown text containing a heading, a bullet list, and a fenced code block
- **THEN** the returned text SHALL keep the same heading marker, bullet list structure, and fenced code block (with the code untranslated) in the same positions
- **AND** only the natural-language prose SHALL be translated to Simplified Chinese

#### Scenario: Preserve LaTeX, URLs, and identifiers
- **WHEN** the source text contains inline LaTeX math, a URL, and a code identifier
- **THEN** the LaTeX math, URL, and identifier SHALL be reproduced unchanged in the output

### Requirement: Configurable translation prompt
The system SHALL read the translation prompt from a `translation` block in `config.yml`. The block SHALL support a `prompt` template containing a `{TEXT}` placeholder for the source text, and an optional `model` naming which entry of `models.available` to use (falling back to `models.default` when absent). The configured prompt SHALL be loaded and validated at startup, and assembling the final prompt SHALL substitute the source text into `{TEXT}`. Changing the prompt text SHALL NOT require code changes.

#### Scenario: Assemble prompt from template
- **WHEN** the translation prompt template is `"Translate to Chinese:\n{TEXT}"` and the source text is "Hello"
- **THEN** the prompt sent to the model SHALL be `"Translate to Chinese:\nHello"`

#### Scenario: Model selection falls back to default
- **WHEN** the `translation` block has no `model` field
- **THEN** the service SHALL use `models.default` as the model

#### Scenario: Invalid translation config rejected at startup
- **WHEN** the `translation` block is present but its `prompt` is not a string
- **THEN** config loading SHALL fail with a validation error naming the `translation` field

### Requirement: Content-addressed translation cache
The system SHALL cache each completed translation in the database, keyed by the content hash of the (normalized) source text together with the target language. Before calling the AI model, the service SHALL look up the cache by `(source_hash, target_lang)`; on a hit it SHALL return the cached translation without calling the model. On a miss it SHALL call the model, store the result, and return it. Normalization for hashing SHALL trim leading/trailing whitespace only and SHALL NOT alter internal formatting.

#### Scenario: Cache miss then store
- **WHEN** a text is translated for the first time
- **THEN** the service SHALL call the AI model, persist a `translations` row with the source hash, source text, translated text, and model name, and return the translation marked as not cached

#### Scenario: Cache hit returns stored translation
- **WHEN** the same source text is requested again (no force flag)
- **THEN** the service SHALL return the stored translation without calling the AI model, marked as cached

#### Scenario: Whitespace-only differences hit the same cache entry
- **WHEN** a previously translated text is requested again with extra leading/trailing whitespace
- **THEN** it SHALL resolve to the same cache entry and return the stored translation without calling the AI model

### Requirement: Re-translate overwrites the cached record
The system SHALL support a "re-translate" operation that bypasses the cache, calls the AI model again, and overwrites the existing cached record for the same `(source_hash, target_lang)` in place — updating the translated text, model name, and `updated_at` — rather than creating a duplicate row.

#### Scenario: Re-translate overwrites in place
- **WHEN** a cached translation exists for a text and re-translation is requested for the same text
- **THEN** the service SHALL call the AI model again and update the same row's `translated_text`, `model_name`, and `updated_at`
- **AND** SHALL NOT create a second row for that `(source_hash, target_lang)`

### Requirement: Translation API endpoints
The system SHALL expose internal API endpoints (under `/api/*`, HTTP Basic Auth, requiring a logged-in user) to drive translation. `POST /api/translate` SHALL accept `{ text, force?, cache_only? }` and return `{ source_hash, source_text, translated_text, source_lang, target_lang, model_name, cached }`; with `force: true` it SHALL re-translate and overwrite (returning `cached: false`), with `cache_only: true` it SHALL peek (see below), otherwise it SHALL return the cached result when present or translate-and-store on a miss. `GET /api/translations/:hash` (optionally `?target_lang=`) SHALL return the cached translation row without calling the AI model, or 404 when none exists. All response keys SHALL be snake_case.

#### Scenario: Peek mode returns cached without calling the model
- **WHEN** `POST /api/translate` is called with `cache_only: true` for a text that already has a cached translation
- **THEN** the response SHALL have `cached: true` and the stored `translated_text`, and the AI model SHALL NOT be called

#### Scenario: Peek mode on a miss does not translate or error
- **WHEN** `POST /api/translate` is called with `cache_only: true` for a text that has no cached translation
- **THEN** the response SHALL have `cached: false` and `translated_text: null` (HTTP 200), and the AI model SHALL NOT be called

#### Scenario: POST translate returns cached result
- **WHEN** `POST /api/translate` is called with a `text` that already has a cached translation and no `force`
- **THEN** the response SHALL include the stored `translated_text` and `cached: true`

#### Scenario: POST translate with force re-translates
- **WHEN** `POST /api/translate` is called with `force: true` for an already-cached text
- **THEN** the AI model SHALL be called again, the cached row SHALL be overwritten, and the response SHALL have `cached: false`

#### Scenario: GET cached translation by hash
- **WHEN** `GET /api/translations/:hash` is called for a hash that exists in the cache
- **THEN** the stored translation row SHALL be returned without calling the AI model

#### Scenario: GET missing translation returns 404
- **WHEN** `GET /api/translations/:hash` is called for a hash with no cached translation
- **THEN** the response SHALL be 404 and no AI call SHALL be made

### Requirement: Translation cache is shared across all users
The translation cache SHALL be global and SHALL NOT be scoped per user — the `translations` rows carry no user identifier. A translation produced by any logged-in user SHALL be returned from cache to any other logged-in user requesting the same source text. Performing a translation SHALL require a logged-in user (enforced by the API endpoints), but reading from / writing to the cache SHALL NOT depend on which user triggered it.

#### Scenario: One user's translation served to another
- **WHEN** user A translates a piece of text and later user B requests translation of the exact same text
- **THEN** user B SHALL receive the cached translation without a new AI call

#### Scenario: Translation requires authentication
- **WHEN** an unauthenticated request hits `POST /api/translate`
- **THEN** it SHALL be rejected (401) and no AI call SHALL be made

### Requirement: Translation AI calls are concurrency- and rate-limited
The system SHALL gate the translation service's AI calls using the same concurrency and rate-limiting primitives used by the service runner, configured via `services.translation_service` (`max_concurrency`, `rate_limit_interval`) in `config.yml`.

#### Scenario: Respect max_concurrency
- **WHEN** more simultaneous translation requests arrive than `services.translation_service.max_concurrency`
- **THEN** the excess AI calls SHALL queue until a slot frees, rather than all firing at once

#### Scenario: Respect rate_limit_interval
- **WHEN** `services.translation_service.rate_limit_interval` is configured
- **THEN** consecutive AI calls SHALL be spaced by at least that interval
