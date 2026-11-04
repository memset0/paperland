import { describe, it, expect, beforeAll, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve } from 'path'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { parseArxivDates } from './arxiv_service.js'
import { __test__ } from './semantic_scholar_service.js'
import { checkSourceDate, PaperActionError, updatePaperFields } from './paper_actions.js'

// Offline: pure parsing/mapping plus an in-memory DB.

beforeAll(() => { loadConfig() })

describe('arXiv dates', () => {
  it('reads <published> and <updated> from an Atom entry', () => {
    const entry = `<id>http://arxiv.org/abs/2401.00001v3</id>
      <updated>2024-03-05T12:00:00Z</updated>
      <published>2024-01-01T10:00:00Z</published><title>T</title>`
    expect(parseArxivDates(entry)).toEqual({ published: '2024-01-01T10:00:00Z', updated: '2024-03-05T12:00:00Z' })
    expect(parseArxivDates('<title>x</title>')).toEqual({ published: null, updated: null })
  })
})

describe('S2 publication date', () => {
  const map = __test__.mapS2ToPaperFields
  it('fills published_at only for non-arXiv papers without one', () => {
    expect(map({ publicationDate: '2023-05-01' } as any, { arxiv_id: null, metadata: null }).published_at).toBe('2023-05-01')
    expect(map({ publicationDate: '2023-05-01' } as any, { arxiv_id: '2401.00001', metadata: null }).published_at).toBeUndefined()
    expect(map({ publicationDate: '2023-05-01', externalIds: { ArXiv: '2401.00001' } } as any, { arxiv_id: null, metadata: null }).published_at).toBeUndefined()
    expect(map({ publicationDate: '2023-05-01' } as any, { arxiv_id: null, metadata: JSON.stringify({ published_at: '2022-01-01' }) }).published_at).toBeUndefined()
  })
})

describe('date fields', () => {
  let db: ReturnType<typeof drizzle>
  beforeEach(() => {
    db = drizzle(new Database(':memory:'), { schema })
    migrate(db, { migrationsFolder: resolve(import.meta.dir, '../db/migrations') })
    setDatabaseForTesting(db)
  })

  it('validates ISO dates and date-times', () => {
    expect(checkSourceDate('2026-10-12', 'published_at')).toBe('2026-10-12')
    expect(checkSourceDate('2026-10-12T00:00:00Z', 'published_at')).toBe('2026-10-12T00:00:00Z')
    expect(checkSourceDate(null, 'published_at')).toBeNull()
    expect(checkSourceDate('', 'published_at')).toBeNull()
    expect(checkSourceDate(undefined, 'published_at')).toBeUndefined()
    for (const bad of ['last week', '2026-13-01', '2026-02-30', '12/10/2026', 20261012]) {
      expect(() => checkSourceDate(bad, 'published_at')).toThrow(PaperActionError)
    }
  })

  it('sets and clears published_at / modified_at, rejecting invalid values without changes', () => {
    const now = new Date().toISOString()
    const p = db.insert(schema.papers).values({ title: 'Blog', authors: '[]', kind: 'article', created_at: now, updated_at: now }).returning().get()
    const meta = (id: number) => JSON.parse(db.select().from(schema.papers).all().find((r) => r.id === id)!.metadata || '{}')

    updatePaperFields(p.id, { published_at: '2026-10-12', modified_at: '2026-10-13' })
    expect(meta(p.id)).toMatchObject({ published_at: '2026-10-12', modified_at: '2026-10-13' })

    let err: any
    try { updatePaperFields(p.id, { published_at: 'last week' }) } catch (e) { err = e }
    expect(err).toMatchObject({ status: 422, code: 'INVALID_DATE' })
    expect(meta(p.id).published_at).toBe('2026-10-12')

    updatePaperFields(p.id, { modified_at: null })
    expect(meta(p.id).modified_at).toBeUndefined()
  })

  it('renumbers article headings from level 1 on write, but not paper content', () => {
    const now = new Date().toISOString()
    const art = db.insert(schema.papers).values({ title: 'Blog', authors: '[]', kind: 'article', created_at: now, updated_at: now }).returning().get()
    const pap = db.insert(schema.papers).values({ title: 'Paper', authors: '[]', created_at: now, updated_at: now }).returning().get()
    const userInput = (id: number) => JSON.parse(db.select().from(schema.papers).all().find((r) => r.id === id)!.contents || '{}').user_input
    updatePaperFields(art.id, { content: '## Intro\n### Detail' })
    expect(userInput(art.id)).toBe('# Intro\n## Detail')
    updatePaperFields(pap.id, { content: '## Notes' })
    expect(userInput(pap.id)).toBe('## Notes')
    updatePaperFields(pap.id, { kind: 'article' })
    expect(userInput(pap.id)).toBe('# Notes')
  })
})
