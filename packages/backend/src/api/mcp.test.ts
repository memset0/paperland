import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { getDatabase, setDatabaseForTesting } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { ensureAgentToken, resetAgentToken } from '../services/api_tokens.js'
import { createMcpService, revokeMcpService, convertLegacyTokens } from '../services/mcp_services.js'
import { mcpRoutes } from './mcp.js'
import { serviceRunner } from '../services/service_runner.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { mcpCountsForUser } from '../services/mcp_counts.js'
import { AGENT_NON_WRITE_TOOL_NAMES } from '../services/agent_tools.js'

// No S2 calls or downloads here: site tools, the paper write tools (runner stubbed), and protocol handling.

let app: FastifyInstance
let token = ''
let serviceId = 0
let agentToken = ''
const now = new Date().toISOString()

function post(body: unknown, auth: string | null = `Bearer ${token}`) {
  return app.inject({ method: 'POST', url: '/mcp', headers: auth ? { authorization: auth } : {}, payload: body as any })
}

beforeAll(async () => {
  loadConfig()
  app = Fastify()
  await app.register(mcpRoutes)
  await app.ready()
})

afterAll(async () => { await app.close() })

beforeEach(() => {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  db.insert(schema.users).values({ id: 1, username: 'owner', password_hash: 'x', role: 'user', created_at: now }).run()
  db.insert(schema.papers).values({ id: 5, title: 'Paper Five', authors: '[]', listed: 1, created_at: now, updated_at: now }).run()
  // Bearer service key with every permission (write and both deletes).
  const service = createMcpService(1, { name: 'Test client', permissions: { delete_papers: true, delete_answers: true } })
  token = service.secret; serviceId = service.id
  agentToken = ensureAgentToken(1).token
})

describe('POST /mcp', () => {
  it('counts known tool attempts for Q&A-style agent and ordinary credentials, including failures and batches', async () => {
    const call = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_paper', arguments: { paper_id: 5 } } }
    await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    expect(mcpCountsForUser(1, ['get_paper']).get_paper).toBe(0)
    await post(call, `Bearer ${agentToken}`)
    await post([call, { ...call, id: 2, params: { name: 'get_paper', arguments: { paper_id: 404 } } }])
    expect(mcpCountsForUser(1, ['get_paper']).get_paper).toBe(3)
  })
  it('rejects missing, unknown, and revoked tokens with 401', async () => {
    const msg = { jsonrpc: '2.0', id: 1, method: 'ping' }
    expect((await post(msg, null)).statusCode).toBe(401)
    expect((await post(msg, 'Bearer nope')).statusCode).toBe(401)
    revokeMcpService(1, serviceId)
    expect((await post(msg)).statusCode).toBe(401)
  })

  it('accepts both service keys and agent tokens, from any origin', async () => {
    const msg = { jsonrpc: '2.0', id: 1, method: 'ping' }
    expect((await post(msg)).json()).toEqual({ jsonrpc: '2.0', id: 1, result: {} })
    expect((await post(msg, `Bearer ${agentToken}`)).statusCode).toBe(200)
    const proxied = await app.inject({ method: 'POST', url: '/mcp', remoteAddress: '203.0.113.9', headers: { authorization: `Bearer ${agentToken}`, 'x-forwarded-for': '203.0.113.9' }, payload: msg })
    expect(proxied.statusCode).toBe(200)
  })

  it('stops accepting the old agent token value after a reset', async () => {
    const msg = { jsonrpc: '2.0', id: 1, method: 'ping' }
    const fresh = resetAgentToken(1).token
    expect((await post(msg, `Bearer ${agentToken}`)).statusCode).toBe(401)
    expect((await post(msg, `Bearer ${fresh}`)).statusCode).toBe(200)
  })

  it('rejects tokens of accounts that are not active', async () => {
    getDatabase().update(schema.users).set({ status: 'pending' }).where(eq(schema.users.id, 1)).run()
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' })).statusCode).toBe(401)
  })

  it('initializes with a supported protocol version and lists tools with their write annotations', async () => {
    const init = (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })).json()
    expect(init.result.protocolVersion).toBe('2025-03-26')
    expect(init.result.capabilities.tools).toBeDefined()
    const unknown = (await post({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).json()
    expect(unknown.result.protocolVersion).toBe('2025-06-18')
    const list = (await post({ jsonrpc: '2.0', id: 3, method: 'tools/list' })).json()
    const names = list.result.tools.map((t: any) => t.name)
    expect(names).toContain('read_pdf_page')
    expect(AGENT_NON_WRITE_TOOL_NAMES).not.toContain('get_topic')
    expect(AGENT_NON_WRITE_TOOL_NAMES).not.toContain('read_pdf_page')
    expect(names).toEqual(expect.arrayContaining(['search_papers', 'read_paper', 's2_search', 's2_match', 's2_get']))
    expect(list.result.tools.filter((t: any) => t.annotations.readOnlyHint !== true).map((t: any) => t.name))
      .toEqual(['create_topic', 'set_topic_sharing', 'set_topic_archived', 'set_topic_member', 'import_topic_paper', 'upload_image', 'add_paper', 'update_paper', 'upload_paper_pdf', 'refresh_paper', 'add_paper_qa', 'delete_paper', 'delete_qa_answer'])
    const ann = (name: string) => list.result.tools.find((t: any) => t.name === name).annotations
    expect(ann('add_paper')).toMatchObject({ readOnlyHint: false, destructiveHint: false, openWorldHint: true })
    expect(ann('update_paper')).toMatchObject({ readOnlyHint: false, destructiveHint: true })
    expect(ann('upload_paper_pdf')).toMatchObject({ readOnlyHint: false, destructiveHint: true })
    expect(list.result.tools.find((t: any) => t.name === 'upload_image').annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true })
  })

  it('answers notifications with 202, unknown methods with -32601, and supports batches', async () => {
    const note = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(note.statusCode).toBe(202)
    expect(note.body).toBe('')
    expect((await post({ jsonrpc: '2.0', id: 9, method: 'resources/list' })).json().error.code).toBe(-32601)
    const batch = (await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }])).json()
    expect(batch).toEqual([{ jsonrpc: '2.0', id: 1, result: {} }])
  })

  it('calls tools as the token user and reports tool failures as isError results', async () => {
    const res = (await post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_paper', arguments: { paper_id: 5 } } })).json()
    expect(res.result.isError).toBe(false)
    expect(JSON.parse(res.result.content[0].text)).toMatchObject({ paper_id: 5, title: 'Paper Five', in_my_library: false })
    const missing = (await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_paper', arguments: { paper_id: 404 } } })).json()
    expect(missing.result).toEqual({ content: [{ type: 'text', text: 'Paper 404 not found' }], isError: true })
  })

  it('accepts multi-megabyte upload_image payloads (base64 data) instead of 413', async () => {
    const big = 'A'.repeat(3 * 1024 * 1024)
    const res = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'upload_image', arguments: { data: big } } })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.isError).toBe(true) // not an image, but it reached the tool
  })

  it('GET and DELETE are not allowed', async () => {
    expect((await app.inject({ method: 'GET', url: '/mcp' })).statusCode).toBe(405)
    expect((await app.inject({ method: 'DELETE', url: '/mcp' })).statusCode).toBe(405)
  })
})

describe('MCP paper write tools', () => {
  const call = (name: string, args: Record<string, unknown>, auth = `Bearer ${token}`) =>
    post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, auth).then((r) => r.json().result)
  const parsed = (result: any) => JSON.parse(result.content[0].text)
  const origCwd = process.cwd()
  let workDir = ''
  const triggered: number[] = []
  const executed: Array<[string, number]> = []
  const realTrigger = serviceRunner.triggerForPaper
  const realExecute = serviceRunner.executeServiceForPaper

  beforeAll(() => {
    // PDFs land in a temp cwd; the runner is stubbed so nothing is downloaded.
    workDir = mkdtempSync(join(tmpdir(), 'mcp-write-'))
    process.chdir(workDir)
    serviceRunner.triggerForPaper = (async (id: number) => { triggered.push(id) }) as any
    serviceRunner.executeServiceForPaper = (async (name: string, id: number) => { executed.push([name, id]) }) as any
  })
  afterAll(() => {
    serviceRunner.triggerForPaper = realTrigger
    serviceRunner.executeServiceForPaper = realExecute
    process.chdir(origCwd)
    rmSync(workDir, { recursive: true, force: true })
  })
  beforeEach(() => { triggered.length = 0; executed.length = 0 })

  it('adds a project-page paper with a PDF URL to the caller\'s library', async () => {
    const res = await call('add_paper', {
      title: 'Code Video Model', link: 'https://code-video-model.github.io', year: 2026, venue: 'Tech report',
      pdf_url: 'https://code-video-model.github.io/tech_report.pdf', tags: ['video'],
    })
    expect(res.isError).toBe(false)
    const out = parsed(res)
    expect(out).toMatchObject({ created: true, title: 'Code Video Model', kind: 'paper', year: 2026, pdf_url: 'https://code-video-model.github.io/tech_report.pdf' })
    expect(triggered).toEqual([out.paper_id])
    const lib = getDatabase().select().from(schema.userPapers).where(eq(schema.userPapers.paper_id, out.paper_id)).all()
    expect(lib.map((r) => r.user_id)).toEqual([1])
    // Same link again → existing paper
    expect(parsed(await call('add_paper', { title: 'Dup', link: 'http://code-video-model.github.io/' }))).toMatchObject({ paper_id: out.paper_id, created: false })
  })

  it('stores base64 PDF data, then edits metadata', async () => {
    const data = Buffer.from('%PDF-1.7 blog snapshot').toString('base64')
    const added = parsed(await call('add_paper', { title: 'A blog post', kind: 'article', link: 'https://blog.example.com/p', pdf_data: data }))
    expect(added).toMatchObject({ kind: 'article', pdf_status: 'available' })
    const updated = parsed(await call('update_paper', { paper_id: added.paper_id, abstract: 'Summary', authors: ['X'] }))
    expect(updated).toMatchObject({ abstract: 'Summary', authors: ['X'] })
    const again = await call('upload_paper_pdf', { paper_id: added.paper_id, data })
    expect(again.isError).toBe(true)
    expect(again.content[0].text).toContain('PDF_EXISTS')
    const replaced = parsed(await call('upload_paper_pdf', { paper_id: added.paper_id, data: Buffer.from('%PDF-1.7 v2').toString('base64'), replace: true }))
    expect(replaced.outcome).toBe('updated')
  })

  it('rejects non-PDF data and invalid fields as tool errors', async () => {
    const bad = await call('upload_paper_pdf', { paper_id: 5, data: Buffer.from('<html>').toString('base64') })
    expect(bad.isError).toBe(true)
    expect(bad.content[0].text).toContain('INVALID_PDF')
    expect((await call('update_paper', { paper_id: 5, kind: 'video' })).isError).toBe(true)
    expect((await call('add_paper', { link: 'https://x.org' })).isError).toBe(true)
  })

  it('sets a PDF URL and queues refreshes', async () => {
    const res = parsed(await call('upload_paper_pdf', { paper_id: 5, url: 'https://x.org/r.pdf' }))
    expect(res).toMatchObject({ pdf_url: 'https://x.org/r.pdf', queued: 'url_pdf_service' })
    expect(triggered).toEqual([5])
    const refreshed = parsed(await call('refresh_paper', { paper_id: 5, pdf: true, s2: true }))
    expect(refreshed.queued).toEqual(['url_pdf_service'])
    expect(refreshed.errors.s2).toContain('NO_S2_ID')
    expect(executed).toEqual([['url_pdf_service', 5]])
  })

  it('refuses agent tokens and changes nothing', async () => {
    const res = await call('add_paper', { title: 'Nope' }, `Bearer ${agentToken}`)
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('Plugins service key')
    expect(getDatabase().select().from(schema.papers).all().map((p) => p.title)).toEqual(['Paper Five'])
  })
})

describe('POST /mcp/s/:secret (MCP service URLs)', () => {
  const svcPost = (secret: string, body: unknown) => app.inject({ method: 'POST', url: `/mcp/s/${secret}`, payload: body as any })
  it('serves the owner without a header, filters tools by permission and refuses others', async () => {
    const { createMcpService } = await import('../services/mcp_services.js')
    const full = createMcpService(1, { name: 'ChatGPT' })
    expect(full.permissions).toEqual({ write: true, delete_papers: false, delete_answers: false })
    const init = await svcPost(full.secret, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
    expect(init.statusCode).toBe(200)
    const names = (await svcPost(full.secret, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).json().result.tools.map((t: any) => t.name)
    expect(names).toContain('add_paper')
    const readonly = createMcpService(1, { name: 'Reader', permissions: { write: false } })
    const roNames = (await svcPost(readonly.secret, { jsonrpc: '2.0', id: 3, method: 'tools/list' })).json().result.tools.map((t: any) => t.name)
    expect(roNames).toContain('get_paper')
    expect(roNames).not.toContain('add_paper')
    expect(roNames).not.toContain('upload_image')
    const refused = (await svcPost(readonly.secret, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'update_paper', arguments: { paper_id: 5, title: 'x' } } })).json()
    expect(refused.result.isError).toBe(true)
    expect(getDatabase().select().from(schema.papers).where(eq(schema.papers.id, 5)).get()!.title).toBe('Paper Five')
  })
  it('rejects unknown, rotated and revoked secrets with 404 and other methods with 405', async () => {
    const { createMcpService, rotateMcpService, revokeMcpService, listMcpServices } = await import('../services/mcp_services.js')
    const svc = createMcpService(1, { name: 'App' })
    expect((await svcPost('pls_' + '0'.repeat(64), { jsonrpc: '2.0', id: 1, method: 'ping' })).statusCode).toBe(404)
    const rotated = rotateMcpService(1, svc.id)
    expect((await svcPost(svc.secret, { jsonrpc: '2.0', id: 1, method: 'ping' })).statusCode).toBe(404)
    expect((await svcPost(rotated.secret, { jsonrpc: '2.0', id: 1, method: 'ping' })).statusCode).toBe(200)
    expect(() => revokeMcpService(2, svc.id)).toThrow()
    revokeMcpService(1, svc.id)
    expect((await svcPost(rotated.secret, { jsonrpc: '2.0', id: 1, method: 'ping' })).statusCode).toBe(404)
    expect(listMcpServices(1).some((s) => s.id === svc.id)).toBe(false)
    expect((await app.inject({ method: 'GET', url: `/mcp/s/${rotated.secret}` })).statusCode).toBe(405)
    // The stored value is a verifier, never the secret; the revoked key is refused in the header form too.
    expect(JSON.stringify(getDatabase().select().from(schema.apiTokens).all())).not.toContain(rotated.secret)
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, `Bearer ${rotated.secret}`)).statusCode).toBe(401)
  })
  it('serves the same service through the Bearer header with the same tool list', async () => {
    const readonly = createMcpService(1, { name: 'Reader', permissions: { write: false } })
    const list = (res: any) => res.json().result.tools.map((t: any) => t.name)
    const viaUrl = list(await svcPost(readonly.secret, { jsonrpc: '2.0', id: 1, method: 'tools/list' }))
    const viaHeader = list(await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, `Bearer ${readonly.secret}`))
    expect(viaHeader).toEqual(viaUrl)
    expect(viaHeader).not.toContain('add_paper')
    const refused = (await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'add_paper', arguments: { title: 'x' } } }, `Bearer ${readonly.secret}`)).json()
    expect(refused.result.isError).toBe(true)
  })
  it('converts legacy personal and Topic tokens into services that keep their key', async () => {
    const db = getDatabase()
    const { topicTokenVerifier } = await import('../services/topic_access.js')
    const personal = 'sk-' + 'a'.repeat(64), topicKey = 'plt_' + 'b'.repeat(64), revoked = 'sk-' + 'c'.repeat(64)
    db.insert(schema.apiTokens).values([
      { token: personal, kind: 'personal', user_id: 1, created_at: now },
      { token: topicTokenVerifier(topicKey), kind: 'topic', user_id: 1, created_at: now },
      { token: revoked, kind: 'personal', user_id: 1, created_at: now, revoked_at: now },
    ]).run()
    expect(convertLegacyTokens()).toEqual({ personal: 1, topic: 1 })
    expect(convertLegacyTokens()).toEqual({ personal: 0, topic: 0 })
    const ping = { jsonrpc: '2.0', id: 1, method: 'ping' }
    expect((await post(ping, `Bearer ${personal}`)).statusCode).toBe(200)
    expect((await post(ping, `Bearer ${topicKey}`)).statusCode).toBe(200)
    expect((await svcPost(personal, ping)).statusCode).toBe(200)
    expect((await post(ping, `Bearer ${revoked}`)).statusCode).toBe(401)
    expect(JSON.stringify(db.select().from(schema.apiTokens).all())).not.toContain(personal)
    const names = db.select().from(schema.apiTokens).all().filter((t) => t.kind === 'service').map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining([expect.stringMatching(/^API token \d+$/), expect.stringMatching(/^Topic token \d+$/)]))
  })
  it('redacts the secret for logs', async () => {
    const { redactServiceUrl } = await import('../services/mcp_services.js')
    expect(redactServiceUrl('/mcp/s/pls_abc?x=1')).toBe('/mcp/s/[redacted]?x=1')
  })
})

describe('Q&A write and delete tools through MCP services', () => {
  const callVia = (secret: string, name: string, args: unknown) => app.inject({ method: 'POST', url: `/mcp/s/${secret}`, payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } }).then((r) => r.json().result)
  it('saves a signed answer with server time, lists source, and deletes only with the matching permission', async () => {
    const { createMcpService, updateMcpService } = await import('../services/mcp_services.js')
    const svc = createMcpService(1, { name: 'ChatGPT' })
    const before = Date.now()
    const saved = await callVia(svc.secret, 'add_paper_qa', { paper_id: 5, question: 'What is it?', answer: 'An answer.', model: 'gpt-5' })
    expect(saved.isError).toBe(false)
    const out = JSON.parse(saved.content[0].text)
    expect(out.model_name).toBe('gpt-5 [MCP]')
    expect(Date.parse(out.completed_at)).toBeGreaterThanOrEqual(before - 1000)
    const row = getDatabase().select().from(schema.qaResults).where(eq(schema.qaResults.id, out.result_id)).get()!
    expect(row).toMatchObject({ source: 'mcp', status: 'done', model_name: 'gpt-5 [MCP]', requested_by_user_id: 1 })
    const qa = JSON.parse((await callVia(svc.secret, 'get_paper_qa', { paper_id: 5 })).content[0].text)
    expect(qa.entries[0]).toMatchObject({ result_id: out.result_id, source: 'mcp', model_name: 'gpt-5 [MCP]' })
    expect((await callVia(svc.secret, 'add_paper_qa', { paper_id: 5, question: 'Q', answer: 'A', model: ' ' })).isError).toBe(true)

    expect((await callVia(svc.secret, 'delete_qa_answer', { result_id: out.result_id })).isError).toBe(true)
    expect((await callVia(svc.secret, 'delete_paper', { paper_id: 5 })).isError).toBe(true)
    updateMcpService(1, svc.id, { permissions: { delete_answers: true } })
    expect((await callVia(svc.secret, 'delete_qa_answer', { result_id: out.result_id })).isError).toBe(false)
    expect(getDatabase().select().from(schema.qaResults).where(eq(schema.qaResults.id, out.result_id)).get()!.deleted_at).not.toBeNull()
    expect(getDatabase().select().from(schema.papers).where(eq(schema.papers.id, 5)).get()).toBeDefined()
    updateMcpService(1, svc.id, { permissions: { delete_papers: true } })
    expect((await callVia(svc.secret, 'delete_paper', { paper_id: 5 })).isError).toBe(false)
    expect(getDatabase().select().from(schema.papers).where(eq(schema.papers.id, 5)).get()).toBeUndefined()
  })
  it("refuses deleting another user's free answer", async () => {
    const { createMcpService } = await import('../services/mcp_services.js')
    getDatabase().insert(schema.users).values({ id: 2, username: 'other', password_hash: 'x', role: 'user', created_at: now }).run()
    const entry = getDatabase().insert(schema.qaEntries).values({ paper_id: 5, user_id: 2, type: 'free', prompt: 'Q', status: 'done', created_at: now }).returning().get()
    const res = getDatabase().insert(schema.qaResults).values({ qa_entry_id: entry.id, prompt: 'Q', answer: 'A', model_name: 'm', completed_at: now, status: 'done' }).returning().get()
    const svc = createMcpService(1, { name: 'App', permissions: { delete_answers: true } })
    expect((await callVia(svc.secret, 'delete_qa_answer', { result_id: res.id })).isError).toBe(true)
    expect(getDatabase().select().from(schema.qaResults).where(eq(schema.qaResults.id, res.id)).get()!.deleted_at).toBeNull()
  })
})
