import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { topicFixture } from '../testing/topic_fixture'
import { schema } from '../db/index'
import { topicRoutes } from './topics'
import { mcpRoutes } from './mcp'
import { createTopic, getTopic, listTopics, setTopicImporterForTesting, topicHistory } from '../services/topics'
import { issueTopicCredential, setTopicMember } from '../services/topic_access'
import { createPersonalToken, ensureAgentToken } from '../services/api_tokens'
import { commitTopicFiles, initializeTopicRepo } from '../services/topic_git'
import { topicFiles } from '../services/topic_format'
import { rebuildTopicIndex, topicTagsByPapers } from '../services/topic_index'
import { addToLibrary } from '../services/user_library'
import { parseCallCounts } from '../services/mcp_counts'

let f: ReturnType<typeof topicFixture>, app: FastifyInstance
let viewer = 1
beforeEach(async () => {
  f = topicFixture(); viewer = 1; app = Fastify()
  app.addHook('onRequest', async (request) => { if (request.url.startsWith('/api/') && viewer) request.user = { id: viewer, username: `user-${viewer}`, nickname: null, role: viewer === 4 ? 'admin' : 'user' } })
  await app.register(topicRoutes); await app.register(mcpRoutes)
})
afterEach(async () => { setTopicImporterForTesting(); await app.close(); f.close() })
const call = async (token: string, name: string, args: unknown = {}) => (await app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${token}` }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } })).json().result

describe('Topic web and MCP operations (offline)', () => {
  test('explicit arXiv URL import preserves editions and Git while deduplicating in the acting viewer library', async () => {
    const topic = await createTopic(1, { title: 'Paper URLs' }), snapshot = structuredClone(topic.snapshot)
    snapshot.list.papers = [
      { id: 'preview', reference_number: 1, title: 'Preview', url: 'https://arxiv.org/abs/2501.01234v2', citation: { title: 'Preview' }, directory_ids: [], comment: '' },
      { id: 'project', reference_number: 2, title: 'Project', url: 'https://example.test/project', citation: { title: 'Project' }, directory_ids: [], comment: '' },
      { id: 'universal', reference_number: 3, title: 'Universal', url: 'https://arxiv.org/abs/2501.01234v3', citation: { title: 'Universal' }, directory_ids: [], comment: '' },
    ]
    const commit = await commitTopicFiles(topic.id, topic.commit, topicFiles(snapshot), { user_id: 1, token_id: null, display_name: 'owner' })
    await setTopicMember(topic.id, 1, 'viewer', 'viewer'); viewer = 3
    let imports = 0
    setTopicImporterForTesting(async (user, body) => {
      imports++; expect(user).toBe(3); expect(body.arxiv_id).toBe('2501.01234')
      const paper = f.db.insert(schema.papers).values({ arxiv_id: body.arxiv_id, title: body.title!, authors: '[]', created_at: f.now, updated_at: f.now }).returning().get()
      addToLibrary(user, paper.id); return { paper, created: true }
    })
    const before = await getTopic(topic.id, 3)
    expect(before.paper_importable).toEqual({ preview: true, project: false, universal: true }); expect(imports).toBe(0)
    expect((await app.inject({ method: 'POST', url: `/api/topics/${topic.id}/import`, payload: { entry_id: 'project' } })).statusCode).toBe(422)
    const response = await app.inject({ method: 'POST', url: `/api/topics/${topic.id}/import`, payload: { entry_id: 'preview' } })
    expect(response.statusCode).toBe(200); expect(imports).toBe(1)
    const paper = response.json().data.paper_id, after = await getTopic(topic.id, 3)
    expect(after.published_commit).toBe(commit)
    expect(after.paper_bindings.preview).toBe(paper); expect(after.paper_bindings.universal).toBe(paper)
    expect(after.snapshot.list.papers[0].url).toBe('https://arxiv.org/abs/2501.01234v2')
    expect(after.snapshot.list.papers[2].url).toBe('https://arxiv.org/abs/2501.01234v3')
    expect(after.reference_numbers).toEqual({ preview: 1, project: 2, universal: 3 })
    expect(f.db.select().from(schema.topicPapers).all().filter((p) => p.topic_id === topic.id && p.paper_id === paper)).toHaveLength(2)
    expect(f.db.select().from(schema.userPapers).all().filter((p) => p.paper_id === paper).map((p) => p.user_id)).toEqual([3])
    expect((await app.inject({ method: 'POST', url: `/api/topics/${topic.id}/import`, payload: { entry_id: 'universal' } })).statusCode).toBe(200); expect(imports).toBe(1)
    viewer = 4
    expect((await app.inject({ method: 'POST', url: `/api/topics/${topic.id}/import`, payload: { entry_id: 'preview' } })).statusCode).toBe(404)
  })
  test('per-Topic public access agrees across discovery, content/history, badges, MCP and policy changes', async () => {
    const entry = f.db.insert(schema.qaEntries).values({ paper_id: 10, type: 'template', prompt: 'Question', created_at: f.now }).returning().get()
    const answer = f.db.insert(schema.qaResults).values({ qa_entry_id: entry.id, prompt: 'Question', answer: 'Answer', model_name: 'fixture', completed_at: f.now, created_at: f.now }).returning().get()
    const created = await app.inject({ method: 'POST', url: '/api/topics', payload: { title: 'Public', default_access: 'editor', seed_result_id: answer.id } })
    expect(created.statusCode).toBe(201)
    const topic = created.json().data
    viewer = 4
    expect((await app.inject({ url: '/api/topics' })).json().data[0].permission).toBe('editor')
    expect((await app.inject({ url: '/api/topics?scope=mine' })).json().data).toEqual([])
    expect((await app.inject({ url: `/api/topics/${topic.id}/history` })).statusCode).toBe(200)
    expect(topicTagsByPapers([10], 4).get(10)?.[0].topic_id).toBe(topic.id)
    expect((await app.inject({ method: 'PUT', url: `/api/topics/${topic.id}/sharing`, payload: { default_access: 'none' } })).statusCode).toBe(403)
    const token = (await issueTopicCredential(topic.id, 4)).token
    expect((await call(token, 'get_topic')).isError).toBe(false)
    viewer = 1
    expect((await app.inject({ method: 'PUT', url: `/api/topics/${topic.id}/sharing`, payload: { default_access: 'none' } })).statusCode).toBe(200)
    viewer = 4
    expect(listTopics(4)).toEqual([])
    expect(topicTagsByPapers([10], 4).size).toBe(0)
    expect((await app.inject({ url: `/api/topics/${topic.id}` })).statusCode).toBe(404)
    expect((await app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${token}` }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })).statusCode).toBe(401)
    viewer = 0
    expect((await app.inject({ url: '/api/topics' })).statusCode).toBe(401)
  })
  test('the web name editor permits owners/editors, rejects viewers and stale saves, and preserves history', async () => {
    const topic = await createTopic(1, { title: 'Original long name' })
    await setTopicMember(topic.id, 1, 'editor', 'editor'); await setTopicMember(topic.id, 1, 'viewer', 'viewer')
    viewer = 2
    const renamed = await app.inject({ method: 'PATCH', url: `/api/topics/${topic.id}`, payload: { title: 'Short name', base_commit: topic.commit } })
    expect(renamed.statusCode).toBe(200)
    expect(renamed.json().data.title).toBe('Short name')
    expect(renamed.json().data.snapshot.report).toBe(topic.snapshot.report)
    expect((await getTopic(topic.id, 1, topic.commit)).snapshot.topic.title).toBe('Original long name')
    expect((await app.inject({ method: 'PATCH', url: `/api/topics/${topic.id}`, payload: { title: 'Stale', base_commit: topic.commit } })).statusCode).toBe(409)
    viewer = 3
    expect((await app.inject({ method: 'PATCH', url: `/api/topics/${topic.id}`, payload: { title: 'Viewer rename', base_commit: renamed.json().data.commit } })).statusCode).toBe(403)
    expect(topicHistory(topic.id, 1).versions).toHaveLength(2)
  })
  test('creates an initialized Topic at the website and keeps other users and legacy records isolated', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/topics', payload: { title: 'My Topic' } })
    expect(res.statusCode).toBe(201)
    expect(res.headers['cache-control']).toBe('private, no-store')
    const topic = res.json().data
    expect(topic.snapshot.report).toBe(''); expect(topic.permission).toBe('owner')
    expect(topicHistory(topic.id, 1).versions).toHaveLength(1)
    viewer = 4
    expect((await app.inject({ url: `/api/topics/${topic.id}` })).statusCode).toBe(404)
    expect((await app.inject({ url: '/api/topics' })).json().data).toEqual([])
    viewer = 0
    expect((await app.inject({ method: 'POST', url: '/api/topics', payload: { title: 'No' } })).statusCode).toBe(401)
    expect(f.db.select().from(schema.researchSessions).all()).toEqual([])
  })
  test('copies a visible QA answer into the initial committed report and refuses private seeds', async () => {
    const entry = f.db.insert(schema.qaEntries).values({ paper_id: 10, type: 'free', user_id: 1, prompt: 'Question?', created_at: f.now }).returning().get()
    const result = f.db.insert(schema.qaResults).values({ qa_entry_id: entry.id, prompt: 'Question?', answer: 'Snapshot answer', model_name: 'fixture', completed_at: f.now }).returning().get()
    f.db.insert(schema.userSharingSettings).values({ user_id: 1, data_type: 'qa', shared: 0, updated_at: f.now }).run()
    const topic = await createTopic(1, { title: 'Seeded', seed_result_id: result.id })
    expect(topic.snapshot.report).toContain('Snapshot answer')
    expect(topic.snapshot.list.papers[0].paper_id).toBe(10)
    f.db.update(schema.qaResults).set({ answer: 'Changed later' }).where(eq(schema.qaResults.id, result.id)).run()
    expect((await getTopic(topic.id, 1)).snapshot.report).toContain('Snapshot answer')
    await expect(createTopic(2, { title: 'Forbidden seed', seed_result_id: result.id })).rejects.toThrow('not found')
  })
  test('Topic credentials are bound, count separately and cannot manage memberships or unrelated paper data', async () => {
    const a = await createTopic(1, { title: 'A' }), b = await createTopic(1, { title: 'B' })
    await setTopicMember(a.id, 1, 'editor', 'editor')
    const token = (await issueTopicCredential(a.id, 2)).token
    expect(JSON.parse((await call(token, 'list_topics')).content[0].text).topics.map((t: any) => t.id)).toEqual([a.id])
    expect((await call(token, 'get_topic', { topic_id: b.id })).isError).toBe(true)
    expect((await call(token, 'set_topic_member', { topic_id: a.id, username: 'outsider', role: 'editor' })).isError).toBe(true)
    expect((await call(token, 'update_paper', { paper_id: 10, title: 'Forbidden' })).isError).toBe(true)
    const tag = f.db.insert(schema.tags).values({ user_id: 2, name: 'Private' }).returning().get()
    f.db.insert(schema.paperTags).values({ paper_id: 10, tag_id: tag.id }).run()
    expect(JSON.parse((await call(token, 'get_paper', { paper_id: 10 })).content[0].text).my_tags).toEqual([])
    const privateEntry = f.db.insert(schema.qaEntries).values({ paper_id: 10, type: 'free', user_id: 2, prompt: 'Private question', created_at: f.now }).returning().get()
    f.db.insert(schema.userSharingSettings).values({ user_id: 2, data_type: 'qa', shared: 0, updated_at: f.now }).run()
    f.db.insert(schema.qaResults).values({ qa_entry_id: privateEntry.id, prompt: 'Private question', answer: 'Private answer', model_name: 'fixture', completed_at: f.now }).run()
    const scopedQA = await call(token, 'get_paper_qa', { paper_id: 10 })
    expect(scopedQA.isError).toBe(false)
    expect(scopedQA.content[0].text).not.toContain('Private answer')
    const member = f.db.select().from(schema.topicMembers).all().find((m) => m.topic_id === a.id && m.user_id === 2)!
    expect(parseCallCounts(member.mcp_call_counts).get_paper).toBe(1)
    const personal = createPersonalToken(2).token
    expect(JSON.parse((await call(personal, 'get_paper', { paper_id: 10 })).content[0].text).my_tags).toEqual(['Private'])
    expect(listTopics(2)).toHaveLength(1)
    expect((await call(ensureAgentToken(2).token, 'create_topic', { title: 'No automatic Topic' })).isError).toBe(true)
  })
  test('MCP reads a selected document or metadata without repeating every page body', async () => {
    const topic = await createTopic(1, { title: 'Pages' })
    const token = (await issueTopicCredential(topic.id, 1)).token
    const full = JSON.parse((await call(token, 'get_topic')).content[0].text)
    expect(full.snapshot).toBeDefined()
    const metadata = JSON.parse((await call(token, 'get_topic', { metadata_only: true })).content[0].text)
    expect(metadata.snapshot).toBeUndefined()
    expect(metadata.documents.every((p: any) => p.body === undefined)).toBe(true)
    expect(metadata.next_reference_number).toBe(1)
    const page = JSON.parse((await call(token, 'get_topic', { document: 'pages/questions.md' })).content[0].text)
    expect(page.document.body).toContain('# Research questions')
    expect(page.references).toEqual([])
    expect(page.snapshot).toBeUndefined()
    expect((await call(token, 'get_topic', { document: '../config.yml' })).isError).toBe(true)
    expect((await call(token, 'get_topic', { metadata_only: 'yes' })).isError).toBe(true)
  })
  test('external entries do not ingest on read; one click explicitly imports into the acting reader library', async () => {
    const snapshot = { topic: { format_version: 1 as const, title: 'External', description: '' }, report: '', list: { format_version: 1 as const, directories: [] as any[], papers: [] as any[] } }
    snapshot.list.directories.push({ id: 'methods', name: 'Methods', parent_id: null })
    snapshot.list.papers.push({ id: 'external', title: 'S2 fixture', s2_id: 'CorpusId:123', directory_ids: ['methods'], comment: '' })
    const row = f.db.insert(schema.topics).values({ owner_id: 1, title: 'External', created_at: f.now, updated_at: f.now, snapshot: JSON.stringify(snapshot) }).returning().get()
    f.db.insert(schema.topicMembers).values({ topic_id: row.id, user_id: 1, role: 'owner' }).run()
    await initializeTopicRepo(row.id, snapshot, { user_id: 1, token_id: null, display_name: 'owner' })
    const topic = await getTopic(row.id, 1)
    await setTopicMember(topic.id, 1, 'viewer', 'viewer')
    let imports = 0
    setTopicImporterForTesting(async (userId, body) => {
      imports++
      expect(body.corpus_id).toBe('123')
      const paper = f.db.insert(schema.papers).values({ title: body.title!, corpus_id: body.corpus_id, authors: '[]', created_at: f.now, updated_at: f.now }).returning().get()
      addToLibrary(userId, paper.id)
      return { paper, created: true }
    })
    await getTopic(topic.id, 3); expect(imports).toBe(0)
    viewer = 3
    const imported = await app.inject({ method: 'POST', url: `/api/topics/${topic.id}/import`, payload: { entry_id: 'external' } })
    expect(imported.statusCode).toBe(200); expect(imports).toBe(1)
    const paperId = imported.json().data.paper_id
    expect(topicTagsByPapers([paperId], 3).get(paperId)?.[0].name).toBe('External')
    expect(f.db.select().from(schema.userPapers).all().filter((p) => p.paper_id === paperId).map((p) => p.user_id)).toEqual([3])
    expect((await getTopic(topic.id, 3)).published_commit).toBe(topic.published_commit)
    await app.inject({ method: 'POST', url: `/api/topics/${topic.id}/import`, payload: { entry_id: 'external' } })
    expect(imports).toBe(1)
  })
})
