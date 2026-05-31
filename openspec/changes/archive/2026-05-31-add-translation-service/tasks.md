## 1. Database Schema & Migration

- [x] 1.1 Add `translations` table to `packages/backend/src/db/schema.ts`: `id` (PK autoincrement), `source_hash` (text not null), `source_text` (text not null), `source_lang` (text not null default 'en'), `target_lang` (text not null default 'zh'), `translated_text` (text not null), `model_name` (text nullable), `created_at` (text not null), `updated_at` (text not null), with a unique index on `(source_hash, target_lang)` and an index on `source_hash`
- [x] 1.2 Generate Drizzle migration with `bunx drizzle-kit generate` from `packages/backend/` and verify it is CREATE TABLE + indexes only (no changes to existing tables, no backfill)

## 2. Config — translation prompt + service config

- [x] 2.1 Add `translationSchema` to `packages/backend/src/config.ts` (`model: z.string().optional()`, `prompt: z.string()` with a safe `.default(...)` format-preserving prompt) and attach it to `configSchema` as an optional `translation` block (so existing config.yml without it still loads)
- [x] 2.2 Add `translation` (with `{TEXT}` placeholder prompt + optional `model`) and `services.translation_service` (`max_concurrency`, `rate_limit_interval`) to `config.example.yml`; mirror into the real `config.yml`
- [x] 2.3 Add `getTranslationPrompt()` and `getTranslationModel()` helpers to `packages/backend/src/services/template_loader.ts` (read `config.translation`, fall back model to `models.default`)

## 3. Shared Types

- [x] 3.1 Add a `Translation` interface to `packages/shared/src/types.ts` (id, source_hash, source_text, source_lang, target_lang, translated_text, model_name, created_at, updated_at)
- [x] 3.2 Add translation request/response helper types (e.g. `TranslateRequest { text, force? }`, `TranslateResponse { source_hash, source_text, translated_text, source_lang, target_lang, model_name, cached }`)
- [x] 3.3 Extend the `AppConfig` type to include the optional `translation` block

## 4. Backend — Shared model invocation helper

- [x] 4.1 Create `packages/backend/src/services/model_invoke.ts` exporting `callModel(prompt: string, modelName: string): Promise<string>` by moving `callOpenAI` / `callCodex` / `callCLI` and the `modelConfig.type` dispatch out of `qa_service.ts` (behavior unchanged)
- [x] 4.2 Refactor `qa_service.ts` `askQuestion` to call `callModel`; confirm template + free QA flows behave identically

## 5. Backend — Translation service

- [x] 5.1 Create `packages/backend/src/services/translation_service.ts` with a `normalizeSource(text)` (trim outer whitespace) and `hashSource(text)` (`createHash('sha256').update(text).digest('hex')`, mirroring `image_store.ts`/`idea-forge/utils.ts`)
- [x] 5.2 Implement `translateText(text, opts?: { force?: boolean }): Promise<Translation & { cached: boolean }>`: normalize + hash → if `!force`, look up cache by `(source_hash, target_lang='zh')` and return on hit (`cached: true`); otherwise assemble prompt via `getTranslationPrompt().replace('{TEXT}', source)`, call `callModel(prompt, getTranslationModel())`, then upsert and return (`cached: false`)
- [x] 5.3 Implement upsert semantics: on miss insert a new row (`created_at`=`updated_at`); on `force` (re-translate) update the existing `(source_hash, target_lang)` row's `translated_text`/`model_name`/`updated_at` in place (no duplicate row) — verified against an in-memory DB
- [x] 5.4 Gate the AI call with the service runner's concurrency + rate-limit primitives (Semaphore + RateLimiter) configured from `services.translation_service` (`max_concurrency`, `rate_limit_interval`); reuse the `semaphore.ts`/`rate_limiter.ts` primitives directly (lazy-init from config)

## 6. Backend — Translation API

- [x] 6.1 Create `packages/backend/src/api/translation.ts`: `POST /api/translate` (`{ text, force?, cache_only? }`, `preHandler: requireUser`) → `cache_only:true` peeks via `peekTranslation` (cached row or `cached:false`+`translated_text:null`, no AI, no 404); otherwise calls `translateText(text, { force })`. Returns `{ source_hash, source_text, translated_text, source_lang, target_lang, model_name, cached }`; 400 on empty/missing `text`
- [x] 6.2 Add `GET /api/translations/:hash` (optional `?target_lang=`, default `zh`, `requireUser`) → return cached row without any AI call, 404 when absent
- [x] 6.3 Register `translationRoutes` in `packages/backend/src/index.ts` (under Internal API / basic auth)

## 7. Frontend — BilingualText component

- [x] 7.1 Add `translationApi` to `packages/frontend/src/api/client.ts`: `translate(text, force?)` → `api.post('/api/translate', { text, force })` returning the `{ source_hash, source_text, translated_text, source_lang, target_lang, model_name, cached }` shape; `getCachedTranslation(hash, target_lang?)` → `api.get('/api/translations/:hash')`
- [x] 7.2 Create `packages/frontend/src/components/BilingualText.vue` (`<script setup lang="ts">`, prop `text: string`): render the text as plain text via `<p class="... whitespace-pre-wrap">{{ text }}</p>` (no Markdown), with a small `<Button variant="ghost" size="sm">` + lucide `Languages` icon labelled "Translate" below it (English label per UI-labels-english guidance)
- [x] 7.3 Wire the translate action: on click, if `useAuthStore().isAuthenticated` is false call `useLoginPrompt().openLogin()` and return; otherwise call `translationApi.translate(props.text)`, show a `Loader2` spinner + disable the button while in flight, then append the returned `translated_text` below the English (with a muted "Translation" label)
- [x] 7.4 Add post-translation controls: a "Hide / Show" toggle and a "Re-translate" action that calls `translationApi.translate(props.text, true)` (force) and replaces the displayed translation; errors surface via the api client's toast and the button resets
- [x] 7.5 Replace the abstract `<p>{{ abstract }}</p>` with `<BilingualText :text="store.currentPaper.abstract || ''" />` in both the wide and narrow layouts of `packages/frontend/src/views/PaperDetail.vue`
- [x] 7.6 Refine `BilingualText`: after translation, render a compact header row — "Translation" label with the Hide/Show + Re-translate controls inline to its right as smaller (`size="xs"`) buttons. Add `translationApi.peek(text)` (`cache_only`) and, on mount / text / auth change for logged-in users, peek the backend; if already translated, show expanded by default (no AI, no frontend hashing); verified end-to-end via temp-DB peek (hit/whitespace-hit/miss) + route `cache_only` inject, plus frontend typecheck

## 8. Verification & Docs

- [x] 8.1 Backend verified end-to-end. Cost-free checks: config parses with `translationSchema` (both config files); all new modules import; `normalizeSource`/`hashSource`; cache upsert/overwrite vs in-memory DB; migration DDL applies; route `requireUser` 401 + empty-text 400 via Fastify `inject`. **Live (one-off, real codex-gpt-5.5 call against an isolated temp DB via `setDatabaseForTesting`, NOT a recurring unit test):** `translateText` → `cached:false` (22.7s) → identical second call `cached:true` (no AI call) → `force:true` overwrites the same row (`updated_at` advances, row count stays 1) → `getCachedTranslation` hit + missing-hash null; format-preservation sample kept `#` heading, `**bold**`, `$...$` LaTeX, bullet list, and URL while translating only prose.
- [ ] 8.2 Frontend manual UI (needs the app running + a logged-in session + a real translate): abstract shows English + Translate button; logged-out click opens login prompt (no API call); logged-in click shows spinner then appends Chinese; Hide/Show toggle; Re-translate refreshes; a second session sees the cached translation instantly (shared cache). Code typechecks (no errors in changed files).
- [x] 8.3 Update internal API / docs: `docs/tech-stack.md` (translation service + endpoints + `translations` cache table + `config.yml` `translation` block) and `docs/frontend-architecture.md` (`BilingualText` component). (`docs/external-api.md` is external-only Bearer API — N/A for these internal `/api/*` endpoints.)
- [x] 8.4 Confirmed `packages/backend/data/` was NOT created (absent on disk + absent from git status)
