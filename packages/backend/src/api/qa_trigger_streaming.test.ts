import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { serviceRunner } from '../services/service_runner.js'
import { qaRoutes } from './qa.js'

let fixtureDir = ''
let sqlite: Database
let app: FastifyInstance

async function waitFor(predicate: () => boolean, timeoutMs = 1500) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for QA trigger results')
    await Bun.sleep(5)
  }
}

beforeAll(() => { fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-qa-trigger-')) })
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }))

beforeEach(async () => {
  const configPath = join(fixtureDir, `config-${Math.random().toString(16).slice(2)}.yml`)
  writeFileSync(configPath, `
database:
  type: sqlite
  path: ':memory:'
auth:
  enabled: false
services:
  qa:
    max_concurrency: 2
    rate_limit_interval: 0
models:
  default: local-qa
  available:
    - name: local-qa
      type: codex
      shell: "printf 'local answer'"
      timeout: 5
content_priority: [user_input, pdf_parsed]
system_prompt: |
  Question: {PROMPT}
  Paper: {PAPER}
qa:
  - name: summary
    prompt: Latest preset wording
translation:
  prompt: |
    Translate: {TEXT}
`, 'utf8')
  loadConfig(configPath)
  serviceRunner.initialize()

  sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL);
    CREATE TABLE papers (
      id INTEGER PRIMARY KEY, arxiv_id TEXT, corpus_id TEXT, title TEXT NOT NULL, authors TEXT NOT NULL,
      abstract TEXT, contents TEXT, pdf_path TEXT, metadata TEXT, link TEXT, tags_json TEXT,
      listed INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE qa_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, paper_id INTEGER NOT NULL, user_id INTEGER, type TEXT NOT NULL,
      template_name TEXT, prompt TEXT, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE qa_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT, qa_entry_id INTEGER NOT NULL, prompt TEXT NOT NULL,
      answer TEXT NOT NULL, model_name TEXT NOT NULL, completed_at TEXT NOT NULL,
      execution_id INTEGER, content_hash TEXT, status TEXT NOT NULL DEFAULT 'done', error TEXT,
      requested_by_user_id INTEGER, streaming_capable INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT '', started_at TEXT, first_chunk_at TEXT,
      finished_at TEXT, updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE service_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
      status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
      finished_at TEXT, result TEXT, error TEXT
    );
    INSERT INTO users VALUES (1,'alice','user');
    INSERT INTO papers VALUES (42,NULL,NULL,'Paper','[]',NULL,'{"user_input":"Paper body"}',NULL,NULL,NULL,NULL,1,'now','now');
    INSERT INTO qa_entries (paper_id,user_id,type,template_name,prompt,status,error,created_at)
      VALUES (42,NULL,'template','summary','Old preset wording','done',NULL,'2026-08-26T00:00:00Z');
  `)
  setDatabaseForTesting(drizzle(sqlite, { schema }))
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = { id: 1, username: 'alice', role: 'user' }
  })
  await app.register(qaRoutes)
})

afterEach(async () => {
  await app.close()
  sqlite.close()
})

describe('QA trigger scheduling identities', () => {
  test('free question returns distinct runs for repeated same-model selections', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/papers/42/qa/free',
      payload: { question: 'Immutable free question', models: ['local-qa', 'local-qa'] },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().runs).toHaveLength(2)
    expect(new Set(response.json().runs.map((run: any) => run.result_id)).size).toBe(2)
    expect(new Set(response.json().runs.map((run: any) => run.execution_id)).size).toBe(2)
    await waitFor(() => (sqlite.query("SELECT count(*) c FROM qa_results WHERE status='done' AND prompt='Immutable free question'").get() as any).c === 2)
    expect(sqlite.query("SELECT prompt FROM qa_entries WHERE type='free'").get()).toEqual({ prompt: 'Immutable free question' })
  })

  test('preset regeneration snapshots the latest config wording', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/papers/42/qa/template/summary/regenerate', payload: { model: 'local-qa' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().runs).toHaveLength(1)
    await waitFor(() => (sqlite.query("SELECT count(*) c FROM qa_results WHERE status='done' AND prompt='Latest preset wording'").get() as any).c === 1)
    expect(sqlite.query("SELECT prompt FROM qa_entries WHERE template_name='summary'").get()).toEqual({ prompt: 'Latest preset wording' })
  })
})
