import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { hashSource, peekTranslation, translateText } from './translation_service.js'

let fixtureDir = ''

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-translation-characterization-'))
})

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true })
})

describe('translation cache compatibility baseline', () => {
  test('keeps trim, SHA-256 lookup, shared cache hit, and force overwrite semantics', async () => {
    const configPath = join(fixtureDir, 'config.yml')
    writeFileSync(configPath, `
database:
  type: sqlite
  path: ':memory:'
auth:
  enabled: false
services:
  translation_service:
    max_concurrency: 1
    rate_limit_interval: 0
models:
  default: baseline-codex
  available:
    - name: baseline-codex
      type: codex
      shell: "printf '固定译文'"
      timeout: 5
content_priority: [user_input, pdf_parsed]
system_prompt: '{PROMPT}\n{PAPER}'
qa:
  - name: summary
    prompt: Summarize it.
translation:
  model: baseline-codex
  prompt: 'Translate: {TEXT}'
`, 'utf8')
    loadConfig(configPath)

    const sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_hash TEXT NOT NULL,
        source_text TEXT NOT NULL,
        source_lang TEXT NOT NULL DEFAULT 'en',
        target_lang TEXT NOT NULL DEFAULT 'zh',
        translated_text TEXT NOT NULL,
        model_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source_hash, target_lang)
      );
      CREATE INDEX translations_source_hash_idx ON translations(source_hash);
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))

    try {
      const first = await translateText('  Same input  ')
      expect(first.cached).toBe(false)
      expect(first.source_text).toBe('Same input')
      expect(first.source_hash).toBe(hashSource('Same input'))
      expect(first.translated_text).toBe('固定译文')

      const second = await translateText('\nSame input\t')
      expect(second.cached).toBe(true)
      expect(second.id).toBe(first.id)
      expect(peekTranslation(' Same input ')?.id).toBe(first.id)

      const forced = await translateText('Same input', { force: true })
      expect(forced.cached).toBe(false)
      expect(forced.id).toBe(first.id)
      expect(sqlite.query('SELECT count(*) AS count FROM translations').get()).toEqual({ count: 1 })
    } finally {
      sqlite.close()
    }
  })

  test('streams transient deltas and commits only a successful authoritative final result', async () => {
    const configPath = join(fixtureDir, 'stream-config.yml')
    writeFileSync(configPath, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: false }
services:
  translation_service: { max_concurrency: 1, rate_limit_interval: 0 }
models:
  default: stream-openai
  available:
    - name: stream-openai
      type: openai_api
      endpoint: https://example.test/v1
      api_key_env: PAPERLAND_TRANSLATION_TEST_KEY
      stream: true
content_priority: [user_input]
system_prompt: '{PROMPT} {PAPER}'
qa:
  - { name: summary, prompt: Summary }
translation:
  model: stream-openai
  prompt: 'Translate: {TEXT}'
`, 'utf8')
    loadConfig(configPath)

    const sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_hash TEXT NOT NULL,
        source_text TEXT NOT NULL,
        source_lang TEXT NOT NULL DEFAULT 'en',
        target_lang TEXT NOT NULL DEFAULT 'zh',
        translated_text TEXT NOT NULL,
        model_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source_hash, target_lang)
      );
      CREATE INDEX translations_source_hash_idx ON translations(source_hash);
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))

    const originalFetch = globalThis.fetch
    const previousKey = process.env.PAPERLAND_TRANSLATION_TEST_KEY
    process.env.PAPERLAND_TRANSLATION_TEST_KEY = 'test-key'
    const response = (frames: string[]) => new Response(new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        for (const frame of frames) controller.enqueue(encoder.encode(frame))
        controller.close()
      },
    }), { status: 200 })

    try {
      globalThis.fetch = (async () => response([
        'data: {"choices":[{"delta":{"content":"流式"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"译文"}}]}\n\n',
        'data: [DONE]\n\n',
      ])) as typeof fetch
      const deltas: string[] = []
      const starts: any[] = []
      const completed = await translateText('stream source', {
        onStart: (start) => { starts.push(start) },
        onChunk: (delta) => {
          deltas.push(delta)
          expect(sqlite.query('SELECT count(*) AS count FROM translations').get()).toEqual({ count: 0 })
        },
      })
      expect(starts).toEqual([{
        source_hash: hashSource('stream source'),
        cached: false,
        model_name: 'stream-openai',
        streaming: true,
      }])
      expect(deltas).toEqual(['流式', '译文'])
      expect(completed.translated_text).toBe('流式译文')
      expect(sqlite.query('SELECT count(*) AS count FROM translations').get()).toEqual({ count: 1 })

      const oldUpdatedAt = completed.updated_at
      globalThis.fetch = (async () => response([
        'data: {"choices":[{"delta":{"content":"坏的部分"}}]}\n\n',
        'data: not-json\n\n',
      ])) as typeof fetch
      await expect(translateText('stream source', { force: true })).rejects.toThrow('invalid JSON')
      const preserved = peekTranslation('stream source')!
      expect(preserved.translated_text).toBe('流式译文')
      expect(preserved.updated_at).toBe(oldUpdatedAt)

      await expect(translateText('first failure')).rejects.toThrow('invalid JSON')
      expect(peekTranslation('first failure')).toBeNull()

      const cancelled = new AbortController()
      cancelled.abort()
      await expect(translateText('cancelled source', { signal: cancelled.signal })).rejects.toMatchObject({ name: 'AbortError' })

      globalThis.fetch = (async () => response([
        'data: {"choices":[{"delta":{"content":"释放成功"}}]}\n\n',
        'data: [DONE]\n\n',
      ])) as typeof fetch
      await expect(translateText('after cancellation')).resolves.toMatchObject({ translated_text: '释放成功' })
    } finally {
      globalThis.fetch = originalFetch
      if (previousKey === undefined) delete process.env.PAPERLAND_TRANSLATION_TEST_KEY
      else process.env.PAPERLAND_TRANSLATION_TEST_KEY = previousKey
      sqlite.close()
    }
  })
})
