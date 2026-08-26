import { afterEach, describe, expect, test } from 'bun:test'
import Fastify from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { qaRoutes } from './qa.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'

let sqlite: Database | null = null

afterEach(() => {
  sqlite?.close()
  sqlite = null
})

describe('QA prompt persistence reads', () => {
  test('a failed first free attempt is still returned with its stored question', async () => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL);
      CREATE TABLE qa_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paper_id INTEGER NOT NULL,
        user_id INTEGER,
        type TEXT NOT NULL,
        template_name TEXT,
        prompt TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE qa_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qa_entry_id INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        answer TEXT NOT NULL,
        model_name TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        execution_id INTEGER,
        content_hash TEXT,
        status TEXT NOT NULL DEFAULT 'done', error TEXT, requested_by_user_id INTEGER,
        streaming_capable INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '',
        started_at TEXT, first_chunk_at TEXT, finished_at TEXT, updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE qa_user_preferences (
        user_id INTEGER NOT NULL, qa_entry_id INTEGER NOT NULL, background_color TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, qa_entry_id)
      );
      CREATE TABLE highlights (
        id INTEGER PRIMARY KEY, user_id INTEGER, pathname TEXT NOT NULL, content_hash TEXT NOT NULL,
        qa_result_id INTEGER, start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL,
        text TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE notes (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, paper_id INTEGER NOT NULL,
        body TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, is_public INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO users VALUES (1, 'reader', 'user');
      INSERT INTO qa_entries
        (paper_id, user_id, type, prompt, status, error, created_at)
      VALUES
        (42, 1, 'free', 'Why did the first attempt fail?', 'failed', 'model unavailable', '2026-08-24T00:00:00Z');
    `)

    setDatabaseForTesting(drizzle(sqlite, { schema }))

    const app = Fastify()
    app.addHook('onRequest', async (request) => {
      request.user = { id: 1, username: 'reader', role: 'user' }
    })
    await app.register(qaRoutes)

    const response = await app.inject({ method: 'GET', url: '/api/papers/42/qa' })
    expect(response.statusCode).toBe(200)
    expect(response.json().free).toEqual([{
      entry_id: 1,
      status: 'failed',
      error: 'model unavailable',
      prompt: 'Why did the first attempt fail?',
      user_id: 1,
      username: 'reader',
      can_manage: true,
      background_color: null,
      highlight_count: 0,
      note_anchor_count: 0,
      results: [],
    }])

    await app.close()
  })
})
