import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { eq } from 'drizzle-orm'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { BUNDLED_SYSTEM_PROMPTS_DIR } from '../config.js'
import { buildQAInput, QANoContentError } from './qa_formatter.js'
import { assignLabels, inputPages } from './qa_inputs.js'

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
let fixtureDir = ''
let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-qa-formatter-'))
  const configPath = join(fixtureDir, 'config.yml')
  writeFileSync(configPath, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: false }
models:
  default: m
  available:
    - { name: m, type: openai_api, endpoint: https://example.test/v1 }
content_priority: [user_input, pdf_parsed]
qa:
  - { name: summary, prompt: Summary }
translation: { prompt: 'Translate {TEXT}' }
image_host: { dir: ${fixtureDir} }
qa_prompt: { max_history_turns: 2 }
`, 'utf8')
  loadConfig(configPath)
})

afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }))

beforeEach(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  setDatabaseForTesting(db)
  sqlite.exec(`
    INSERT INTO users (id, username, password_hash, role, created_at) VALUES (1, 'alice', 'x', 'user', 'now');
    INSERT INTO papers (id, title, authors, contents, created_at, updated_at) VALUES
      (1, 'Main', '[]', '{"pdf_parsed":"PAPER BODY"}', 'now', 'now'),
      (2, 'Empty', '[]', '{}', 'now', 'now');
    INSERT INTO papers (id, title, authors, s2_paper_id, created_at, updated_at) VALUES
      (12, 'Attention', '[]', 'aaaa000000000000000000000000000000000000', 'now', 'now');
    INSERT INTO paper_citations (paper_id, direction, s2_paper_id, title, authors, year, venue, created_at) VALUES
      (1, 'reference', 'aaaa000000000000000000000000000000000000', 'Attention Is All You Need', '["Vaswani","Shazeer"]', 2017, 'NeurIPS', 'now'),
      (1, 'reference', NULL, 'Unresolved Ref', '["Solo"]', NULL, NULL, 'now'),
      (1, 'citation', 'bbbb000000000000000000000000000000000000', 'Citing Paper', '[]', 2024, NULL, 'now');
    INSERT INTO images (hash, ext, mime, size, path, created_at) VALUES ('abc123', 'png', 'image/png', 3, 'x.png', 'now');
  `)
  writeFileSync(join(fixtureDir, 'x.png'), Buffer.from([1, 2, 3]))
})

function insertEntry(values: Partial<typeof schema.qaEntries.$inferInsert>) {
  return db.insert(schema.qaEntries).values({
    paper_id: 1, user_id: 1, type: 'free', status: 'done', created_at: 'now', ...values,
  }).returning().get()
}

function insertResult(entryId: number, answer: string, extra: Partial<typeof schema.qaResults.$inferInsert> = {}) {
  return db.insert(schema.qaResults).values({
    qa_entry_id: entryId, prompt: '', answer, model_name: 'm', completed_at: 'now', status: 'done',
    created_at: 'now', updated_at: 'now', ...extra,
  }).returning().get()
}

function userText(built: ReturnType<typeof buildQAInput>): string {
  return built.input.user.map((part) => part.type === 'text' ? part.text : `[IMAGE ${part.path}]`).join('')
}

describe('buildQAInput', () => {
  test('sends the system prompt file as system and orders paper, references, inputs, question', () => {
    const entry = insertEntry({
      prompt: '@Quote1 what is this?',
      inputs: JSON.stringify([{ kind: 'text_selection', label: 'Quote1', text: 'Selected passage', pdf: [{ page: 3, ts: 0, te: 5 }, { page: 4, ts: 0, te: 2 }] }]),
    })
    const built = buildQAInput(db, entry, entry.prompt!)
    expect(built.input.system).toBe(readFileSync(join(BUNDLED_SYSTEM_PROMPTS_DIR, 'paper-qa.md'), 'utf8').trim())
    const text = userText(built)
    const order = ['<paper>\nPAPER BODY\n</paper>', '<references>', '<inputs>', '@Quote1 pages 3–4\n"""\nSelected passage\n"""', '<question>\n@Quote1 what is this?\n</question>']
    let cursor = -1
    for (const marker of order) {
      const index = text.indexOf(marker)
      expect(index).toBeGreaterThan(cursor)
      cursor = index
    }
    expect(text).not.toContain('<history>')
    expect(built.view.paper).toEqual({ source: 'pdf_parsed', length: 'PAPER BODY'.length })
  })

  test('lists only cited references with S2 ids, first author, and in-library links', () => {
    const entry = insertEntry({ prompt: 'q' })
    const references = buildQAInput(db, entry, 'q').view.references!
    expect(references.split('\n')).toEqual([
      '[r1] cite:aaaa000000000000000000000000000000000000 | Attention Is All You Need | Vaswani et al. | 2017 | NeurIPS | in library: paperland://paper/12',
      '[r2] no id | Unresolved Ref | Solo',
    ])
    expect(references).not.toContain('Citing Paper')
  })

  test('follow-up includes the whole chain inputs once, images first, and history by label even when the parent is deleted', () => {
    const root = insertEntry({
      prompt: 'Explain @Image1 and @Quote1',
      inputs: JSON.stringify([
        { kind: 'text_selection', label: 'Quote1', text: 'Root passage', pdf: [{ page: 2, ts: 0, te: 4 }] },
        { kind: 'image', label: 'Image1', image_hash: 'abc123', url: '/image/x.png', pdf: { page: 5, rx: 0, ry: 0, rw: 1, rh: 1 } },
      ]),
    })
    const parentResult = insertResult(root.id, 'Root answer', { deleted_at: 'now' })
    const child = insertEntry({
      prompt: 'Compare @Image2 with @Image1',
      parent_entry_id: root.id,
      inputs: JSON.stringify([
        { kind: 'history', result_id: parentResult.id },
        { kind: 'image', label: 'Image2', image_hash: 'abc123', url: '/image/x.png', pdf: null },
      ]),
    })
    const built = buildQAInput(db, child, child.prompt!)
    const text = userText(built)
    expect(built.input.user.filter((part) => part.type === 'image')).toHaveLength(2)
    expect(text.indexOf('@Image1 page 5, region screenshot')).toBeLessThan(text.indexOf('@Image2 region screenshot'))
    expect(text.indexOf('@Image2')).toBeLessThan(text.indexOf('@Quote1 page 2'))
    expect(text.match(/Root passage/g)).toHaveLength(1)
    expect(text).toContain('<history>\n[User] Explain @Image1 and @Quote1\n[Assistant] Root answer\n</history>')
    expect(text.indexOf('</history>')).toBeLessThan(text.indexOf('<question>'))
  })

  test('history keeps only the most recent configured turns', () => {
    let previous: number | null = null
    let last = insertEntry({ prompt: 'q0' })
    for (let turn = 0; turn < 3; turn += 1) {
      const result = insertResult(last.id, `a${turn}`)
      previous = result.id
      last = insertEntry({ prompt: `q${turn + 1}`, inputs: JSON.stringify([{ kind: 'history', result_id: previous }]) })
    }
    const history = buildQAInput(db, last, 'q3').view.history!
    expect(history).toContain('(1 earlier turn(s) omitted)')
    expect(history).not.toContain('[User] q0')
    expect(history).toContain('[User] q2\n[Assistant] a2')
  })

  test('a paper without usable full text cannot be asked', () => {
    const entry = insertEntry({ paper_id: 2, prompt: 'q' })
    expect(() => buildQAInput(db, entry, 'q')).toThrow(QANoContentError)
  })

  test('preset entries use their configured system prompt name', () => {
    const entry = insertEntry({ type: 'template', template_name: 'summary', user_id: null, prompt: 'Summary' })
    expect(buildQAInput(db, entry, 'Summary').view.system_prompt_name).toBe('paper-qa')
    expect(db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, entry.id)).get()?.instruction).toBeNull()
  })
})

describe('input labels', () => {
  test('continue numbering after ancestors and keep a valid unused suggestion', () => {
    const ancestors = [
      { kind: 'image' as const, label: 'Image1', image_hash: 'abc123', url: '', pdf: null },
      { kind: 'text_selection' as const, label: 'Quote1', text: 't', pdf: [{ page: 1, ts: 0, te: 1 }] },
    ]
    const labelled = assignLabels(ancestors, [
      { kind: 'image' as const },
      { kind: 'text_selection' as const, label: '@Quote5' },
      { kind: 'text_selection' as const, label: 'Quote1' },
    ])
    expect(labelled.map((input) => input.label)).toEqual(['Image2', 'Quote5', 'Quote6'])
  })

  test('page ranges', () => {
    expect(inputPages({ kind: 'text_selection', label: 'Quote1', text: 't', pdf: [{ page: 4, ts: 0, te: 1 }, { page: 3, ts: 0, te: 1 }] })).toBe('pages 3–4')
    expect(inputPages({ kind: 'image', label: 'Image1', image_hash: 'abc123', url: '', pdf: null })).toBeNull()
  })
})
