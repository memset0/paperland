import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { dirname, resolve } from 'path'
import { getConfig, loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { attachAgentTools, figuresPrompt } from './agent_attach.js'
import { checkBearerToken } from './api_tokens.js'
import { modelSupportsAgentTools } from './model_invoke.js'
import type { ModelInput } from './model_invoke.js'

beforeAll(() => loadConfig())

beforeEach(() => {
  const db = drizzle(new Database(':memory:'), { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  db.insert(schema.users).values({ id: 1, username: 'u', password_hash: 'x', role: 'user', created_at: new Date().toISOString() }).run()
})

afterEach(() => { getConfig().agent_tools.enabled = true })

describe('attachAgentTools', () => {
  it('limits a Q&A run to upload_image, pre-approves it, and appends the figure instruction', () => {
    const input: ModelInput = { system: 'QA rules', user: [{ type: 'text', text: 'q' }] }
    expect(attachAgentTools(input, 1, { tools: ['upload_image'] })).toBe(true)
    expect(input.mcp_servers).toEqual([{
      name: 'paperland', url: `${getConfig().agent_tools.base_url.replace(/\/+$/, '')}/mcp`, bearer_token: expect.any(String),
      enabled_tools: ['upload_image'], approved_tools: ['upload_image'],
    }])
    expect(checkBearerToken(input.mcp_servers![0].bearer_token, ['agent']).ok).toBe(true)
    expect(input.skill_roots).toBeUndefined()
    expect(input.system!.startsWith('QA rules\n\n## Figures')).toBe(true)
    expect(figuresPrompt()).toContain('upload_image')
  })

  it('adds no figure instruction when upload_image is not exposed, and nothing when disabled', () => {
    const readOnly: ModelInput = { user: [] }
    attachAgentTools(readOnly, 1, { tools: ['search_papers'] })
    expect(readOnly.system).toBeUndefined()
    expect(readOnly.mcp_servers![0].approved_tools).toBeUndefined()

    getConfig().agent_tools.enabled = false
    const off: ModelInput = { system: 's', user: [] }
    expect(attachAgentTools(off, 1, { tools: ['upload_image'] })).toBe(false)
    expect(off).toEqual({ system: 's', user: [] })
  })
})

describe('modelSupportsAgentTools', () => {
  it('is true only for Codex app-server models', () => {
    for (const m of getConfig().models.available) {
      expect(modelSupportsAgentTools(m.name)).toBe(m.type === 'codex' && m.stream === true)
    }
  })
})
