import { createHash } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { getTranslationPrompt, getTranslationModel } from './template_loader.js'
import { callModel, getModelCapabilities, type ModelInvokeOptions } from './model_invoke.js'
import { Semaphore } from './semaphore.js'
import { RateLimiter } from './rate_limiter.js'
import type { Translation } from '@paperland/shared'

// Currently only English→Chinese is supported. The lang fields are stored for forward-compat.
const SOURCE_LANG = 'en'
const TARGET_LANG = 'zh'

// Concurrency + rate-limit gate for the translation AI calls, reusing the same primitives the
// service runner uses, configured from `services.translation_service` in config.yml. Lazily
// initialized so config is loaded first.
let _sem: Semaphore | null = null
let _rl: RateLimiter | null = null
function getGate(): { sem: Semaphore; rl: RateLimiter } {
  if (!_sem || !_rl) {
    const cfg = getConfig().services['translation_service']
    _sem = new Semaphore(cfg?.max_concurrency ?? 2)
    _rl = new RateLimiter((cfg?.rate_limit_interval ?? 0) * 1000)
  }
  return { sem: _sem, rl: _rl }
}

/** Minimal normalization for hashing/storage: trim outer whitespace only; internal formatting is
 * preserved (we must keep Markdown/LaTeX/line breaks intact). */
export function normalizeSource(text: string): string {
  return text.trim()
}

/** SHA-256 hex of the normalized source text (mirrors image_store.ts / idea-forge/utils.ts). */
export function hashSource(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/** Read a cached translation by source hash (+ target language). Never calls the AI model. */
export function getCachedTranslation(hash: string, targetLang: string = TARGET_LANG): Translation | null {
  const db = getDatabase()
  const row = db.select().from(schema.translations)
    .where(and(eq(schema.translations.source_hash, hash), eq(schema.translations.target_lang, targetLang)))
    .get()
  return (row as Translation) || null
}

/** Peek whether a piece of text already has a cached translation. Normalizes + hashes the text
 * server-side and looks it up; never calls the AI model. Returns the cached row or null. */
export function peekTranslation(text: string): Translation | null {
  const source = normalizeSource(text)
  if (!source) return null
  return getCachedTranslation(hashSource(source), TARGET_LANG)
}

/**
 * Translate `text` from English to Chinese, cache-first.
 * - On a cache hit (and no `force`), returns the stored translation without calling the AI model.
 * - On a miss (or `force`), calls the AI model and upserts the result, overwriting the existing
 *   `(source_hash, target_lang)` row in place for re-translation (no duplicate rows).
 */
export async function translateText(
  text: string,
  opts: {
    force?: boolean
    signal?: AbortSignal
    onStart?: (start: {
      source_hash: string
      cached: boolean
      model_name: string | null
      streaming: boolean
    }) => void | Promise<void>
    onChunk?: ModelInvokeOptions['onChunk']
  } = {}
): Promise<Translation & { cached: boolean }> {
  const db = getDatabase()
  const source = normalizeSource(text)
  if (!source) throw new Error('Cannot translate empty text')
  const sourceHash = hashSource(source)

  if (!opts.force) {
    const existing = getCachedTranslation(sourceHash, TARGET_LANG)
    if (existing) {
      await opts.onStart?.({
        source_hash: sourceHash,
        cached: true,
        model_name: existing.model_name,
        streaming: false,
      })
      return { ...existing, cached: true }
    }
  }

  // Cache miss or forced re-translate: call the AI model, gated by concurrency + rate limit.
  const modelName = getTranslationModel()
  const prompt = getTranslationPrompt().replace('{TEXT}', source)
  const capabilities = getModelCapabilities(modelName)
  await opts.onStart?.({
    source_hash: sourceHash,
    cached: false,
    model_name: modelName,
    streaming: capabilities.streaming,
  })

  const { sem, rl } = getGate()
  await sem.acquire()
  let translated: string
  try {
    if (opts.signal?.aborted) {
      const error = new Error('Translation cancelled')
      error.name = 'AbortError'
      throw error
    }
    await rl.waitIfNeeded()
    if (opts.signal?.aborted) {
      const error = new Error('Translation cancelled')
      error.name = 'AbortError'
      throw error
    }
    translated = (await callModel(prompt, modelName, {
      onChunk: opts.onChunk,
      signal: opts.signal,
    })).trim()
  } finally {
    sem.release()
  }
  if (!translated) throw new Error('Translation model returned empty output')

  const now = new Date().toISOString()
  // Upsert: insert on miss (created_at = updated_at); on conflict (re-translate or a concurrent
  // insert of the same text) overwrite translated_text/model_name/updated_at in place, preserving
  // the original created_at.
  db.insert(schema.translations).values({
    source_hash: sourceHash,
    source_text: source,
    source_lang: SOURCE_LANG,
    target_lang: TARGET_LANG,
    translated_text: translated,
    model_name: modelName,
    created_at: now,
    updated_at: now,
  }).onConflictDoUpdate({
    target: [schema.translations.source_hash, schema.translations.target_lang],
    set: { translated_text: translated, model_name: modelName, updated_at: now },
  }).run()

  const row = getCachedTranslation(sourceHash, TARGET_LANG)!
  return { ...row, cached: false }
}
