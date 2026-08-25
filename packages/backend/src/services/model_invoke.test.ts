import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { askQuestion } from './qa_service.js'
import { callModel } from './model_invoke.js'

let fixtureDir = ''

function writeConfig(models: string, defaultModel: string): string {
  const file = join(fixtureDir, `config-${Math.random().toString(16).slice(2)}.yml`)
  writeFileSync(file, `
database:
  type: sqlite
  path: ':memory:'
auth:
  enabled: false
services: {}
models:
  default: ${defaultModel}
  available:
${models}
content_priority: [user_input, pdf_parsed]
system_prompt: |
  Question: {PROMPT}
  Paper: {PAPER}
qa:
  - name: summary
    prompt: Summarize it.
translation:
  prompt: |
    Translate only this text:
    {TEXT}
`, 'utf8')
  return file
}

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-model-characterization-'))
})

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true })
})

describe('model invocation compatibility baseline', () => {
  test('OpenAI JSON path preserves request and final-string behavior', async () => {
    const configPath = writeConfig(`    - name: baseline-openai
      type: openai_api
      endpoint: https://models.example.test/v1
      api_key_env: PAPERLAND_TEST_OPENAI_KEY`, 'baseline-openai')
    loadConfig(configPath)

    const originalFetch = globalThis.fetch
    const previousKey = process.env.PAPERLAND_TEST_OPENAI_KEY
    process.env.PAPERLAND_TEST_OPENAI_KEY = 'test-key'
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedInit = init
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'openai-final' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    try {
      await expect(callModel('baseline prompt', 'baseline-openai')).resolves.toBe('openai-final')
      expect(capturedUrl).toBe('https://models.example.test/v1/chat/completions')
      expect(capturedInit?.method).toBe('POST')
      expect(capturedInit?.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-key',
      })
      expect(JSON.parse(String(capturedInit?.body))).toEqual({
        model: 'baseline-openai',
        messages: [{ role: 'user', content: 'baseline prompt' }],
        max_tokens: 8192,
      })
    } finally {
      globalThis.fetch = originalFetch
      if (previousKey === undefined) delete process.env.PAPERLAND_TEST_OPENAI_KEY
      else process.env.PAPERLAND_TEST_OPENAI_KEY = previousKey
    }
  })

  test('Codex shell path returns one final string and QA uses the same facade', async () => {
    const configPath = writeConfig(`    - name: baseline-codex
      type: codex
      shell: "printf 'codex-final'"
      timeout: 5`, 'baseline-codex')
    loadConfig(configPath)

    await expect(callModel('a prompt passed through stdin', 'baseline-codex')).resolves.toBe('codex-final')

    const sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE papers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        arxiv_id TEXT, corpus_id TEXT, title TEXT NOT NULL, authors TEXT NOT NULL,
        abstract TEXT, contents TEXT, pdf_path TEXT, metadata TEXT, link TEXT,
        tags_json TEXT, listed INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO papers (id, title, authors, contents, created_at, updated_at)
      VALUES (1, 'Baseline', '[]', '{"user_input":"Paper body"}', 'now', 'now');
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))
    try {
      await expect(askQuestion(1, 'What?', 'baseline-codex')).resolves.toEqual({
        answer: 'codex-final',
        model_name: 'baseline-codex',
      })
    } finally {
      sqlite.close()
    }
  })
})
