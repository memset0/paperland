/** Opt-in browser harness: synthetic SQLite/Git/PDF data, loopback only, no live providers.
 * Run from the project root after a queued scratch build:
 * bun run packages/backend/src/testing/topic_preview.ts /tmp/paperland-topics-frontend-check
 */
import Fastify from 'fastify'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { topicFixture } from './topic_fixture.js'
import { schema } from '../db/index.js'
import { topicRoutes } from '../api/topics.js'
import { topicGitRoutes } from '../api/topic_git.js'
import { mcpRoutes } from '../api/mcp.js'
import { paperRoutes } from '../api/papers.js'
import { researchRoutes } from '../api/research.js'
import { qaRoutes } from '../api/qa.js'
import { notesRoutes } from '../api/notes.js'
import { highlightsRoutes } from '../api/highlights.js'
import { referenceLinksRoutes } from '../api/reference_links.js'
import { tagRoutes } from '../api/tags.js'
import { usageRoutes } from '../api/usage.js'
import { registerFrontendHosting } from '../frontend_hosting.js'
import { TOPIC_AGENT_GUIDE } from '../services/topic_layout.js'
import { initializeTopicRepo } from '../services/topic_git.js'
import { issueTopicCredential, setTopicMember } from '../services/topic_access.js'
import { localProcess } from '../services/local_process.js'
import { setTopicImporterForTesting } from '../services/topics.js'
import { setPdfPageDataRootForTesting } from '../services/pdf_pages.js'
import { addToLibrary } from '../services/user_library.js'
import { createPersonalToken } from '../services/api_tokens.js'
import type { TopicSnapshot } from '@paperland/shared'
import { migrateResearchToTopics } from '../services/research_topic_migration.js'

if (process.cwd() !== resolve(import.meta.dir, '../../../..')) throw new Error('Run this harness from the project root')
const build = resolve(process.argv[2] || '/tmp/paperland-topics-frontend-check')
const f = topicFixture(), app = Fastify()
let actor = 1, update = 0, importCalls = 0, failImports = 0
const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
for (let i = 1; i <= 3; i++) {
  const page = pdf.addPage([540, 720]); page.drawText(`Physical PDF page ${i}`, { x: 50, y: 650, size: 22, font })
  page.drawRectangle({ x: 80, y: 330, width: 340, height: 150, color: rgb(0.87, 0.92, 1) })
  page.drawText(`Figure ${i}: local fixture`, { x: 100, y: 400, size: 16, font })
}
const dataRoot = join(f.root, 'data'); mkdirSync(dataRoot)
const pdfPath = join(dataRoot, 'fixture.pdf'); writeFileSync(pdfPath, await pdf.save())
f.db.update(schema.papers).set({ title: 'Attention Is All You Need', pdf_path: pdfPath, contents: JSON.stringify({ user_input: '# Local paper\n\nA local fixture for native references.' }), metadata: JSON.stringify({ year: 2017, venue: 'NeurIPS' }) }).where(eq(schema.papers.id, 10)).run()
setPdfPageDataRootForTesting(dataRoot)
addToLibrary(1, 10)
const snapshot: TopicSnapshot = {
  topic: { format_version: 2, title: 'Efficient long-context attention', description: 'A maintained guide to sparse attention, retrieval, and efficient long-context models.' },
  report: '# Research overview\n\nLong-context models balance memory, computation, and access to evidence. This topic collects the important methods and questions.\n\n## What we know\n\nSparse attention reduces the number of token interactions. Retrieval selects the evidence a model needs for a particular question.\n\nThe strongest evaluation combines long inputs with questions that require reasoning across several distant passages.\n\n## Reading the evidence\n\n[Open the foundation paper](paperland://paper/10). Inspect [PDF page 2](paperland://paper/10?pdf=2) or the [figure region](paperland://paper/10?pdf=2&rx=0.1&ry=0.2&rw=0.3&rh=0.15).\n\n## Open questions\n\nHow should we compare quality and compute across different context lengths?\n',
  agent_instructions: TOPIC_AGENT_GUIDE,
  pages: {
    'pages/research-questions/index.md': '---\ntitle: Research questions\nfonticon: CircleHelp\nreferences: [1]\n---\n# Research questions\n\n[Read RQ6](rq6.md)\n\n[1](#ref:1)\n',
    'pages/qa-citation.md': '---\ntitle: Legacy citation\nreferences: [1]\n---\n# Legacy citation\n\n[Foundation](#cite:' + 'a'.repeat(40) + ')\n',
    'pages/research-questions/rq6.md': '---\ntitle: "RQ6: Recursive self-improvement"\nfonticon: RefreshCw\nreferences: [2, 3, 4]\n---\n# RQ6: Recursive self-improvement\n\nKeep a familiar paragraph.\n\n[2](#ref:2), [3](#ref:3), [4](#ref:4).\n'
  },
  list: { format_version: 1, directories: [{ id: 'foundations', name: 'Foundations', parent_id: null }, { id: 'efficient', name: 'Efficient attention', parent_id: null }, { id: 'sparse', name: 'Sparse methods', parent_id: 'efficient' }], papers: [
    { id: 'foundation', reference_number: 1, title: 'Attention Is All You Need', paper_id: 10, directory_ids: ['foundations'], comment: 'The foundation for understanding attention. [See page 2](paperland://paper/10?pdf=2).', authors: ['Ashish Vaswani', 'Noam Shazeer'], year: 2017 },
    { id: 'external', reference_number: 2, title: 'A Semantic Scholar paper awaiting import', s2_id: 'CorpusId:13756489', directory_ids: ['sparse'], comment: 'Keep this reference external until you are ready to read it.', authors: ['Example Researcher'], year: 2024 },
    { id: 'arxiv', reference_number: 3, title: 'A version-pinned arXiv paper', url: 'https://arxiv.org/abs/2501.01234v2', citation: { title: 'A version-pinned arXiv paper', author: ['URL Author'], year: 2025 }, directory_ids: [], comment: '' },
    { id: 'project', reference_number: 4, title: 'A project source link', url: 'https://example.test/project', citation: { title: 'A project source link' }, directory_ids: [], comment: '' },
  ] },
}
const topic = f.db.insert(schema.topics).values({ owner_id: 1, title: snapshot.topic.title, created_at: f.now, updated_at: f.now, snapshot: JSON.stringify(snapshot) }).returning().get()
f.db.insert(schema.topicMembers).values({ topic_id: topic.id, user_id: 1, role: 'owner' }).run()
await initializeTopicRepo(topic.id, snapshot, { user_id: 1, token_id: null, display_name: 'owner' })
await setTopicMember(topic.id, 1, 'editor', 'editor'); await setTopicMember(topic.id, 1, 'viewer', 'viewer')
const editorToken = (await issueTopicCredential(topic.id, 2)).token
const checkToken = createPersonalToken(1).token
const session = f.db.insert(schema.researchSessions).values({ user_id: 1, topic: 'Legacy research fixture', created_at: f.now, updated_at: f.now }).returning().get()
f.db.insert(schema.researchSteps).values({ session_id: session.id, step_index: 1, kind: 'agent', status: 'done', answer: '# Legacy research\n\nHistorical research remains readable.', report: '# Legacy research\n\nHistorical research remains readable.', paper_list: JSON.stringify({ title: 'Legacy attention survey with an unnecessarily long original title', sections: [{ title: 'Background', description: 'Preserved **directory description**.', items: [{ kind: 'paper', s2_id: 'a'.repeat(40), verification: 'verified', comment: 'Preserved paper comment.' }, { kind: 'link', url: 'https://example.test/archived-project', citation: { title: 'Archived project page', author: ['Fixture Author'], year: 2025, howpublished: 'Example site', note: 'Preserved citation note' }, comment: 'Preserved link comment.' }] }] }), model_name: 'fixture', created_at: f.now, updated_at: f.now, started_at: f.now, finished_at: f.now }).run()
const legacyImport = process.argv.includes('--migrate-legacy') ? await migrateResearchToTopics() : []
const qa = f.db.insert(schema.qaEntries).values({ paper_id: 10, user_id: 1, type: 'free', prompt: 'What should we study next?', created_at: f.now }).returning().get()
const answer = f.db.insert(schema.qaResults).values({ qa_entry_id: qa.id, prompt: qa.prompt!, answer: 'Study the trade-off between sparse attention and retrieval.', model_name: 'fixture', completed_at: f.now, created_at: f.now }).returning().get()
setTopicImporterForTesting(async (userId, body) => {
  importCalls++; if (failImports > 0) { failImports--; throw new Error('Offline fixture import failure') }
  const paper = f.db.insert(schema.papers).values({ title: body.title || 'Imported fixture', arxiv_id: body.arxiv_id, corpus_id: body.corpus_id, s2_paper_id: body.s2_paper_id, authors: '[]', created_at: f.now, updated_at: f.now }).returning().get()
  addToLibrary(userId, paper.id)
  return { paper, created: true }
})
app.addHook('onRequest', async (request) => {
  if (request.url.startsWith('/api/')) request.user = { id: actor, username: actor === 1 ? 'owner' : actor === 2 ? 'editor' : actor === 4 ? 'outsider' : 'viewer', nickname: null, role: 'user' }
})
app.addHook('preHandler', async (request, reply) => {
  if (request.method !== 'GET' && (request.url.startsWith('/api/qa/') || request.url.includes('/qa/'))) return reply.code(400).send({ error: { message: 'Provider calls are disabled in the offline harness' } })
})
app.get('/api/auth/me', async () => ({ user: { id: actor, username: actor === 1 ? 'owner' : actor === 2 ? 'editor' : actor === 4 ? 'outsider' : 'viewer', nickname: null, role: 'user' }, registration_enabled: false }))
app.get('/api/notifications/completions', async () => ({ now: new Date().toISOString(), items: [] }))
app.get('/api/features', async () => ({ data: { features: [] } }))
app.get('/api/health', async () => ({ status: 'ok', fixture: true }))
app.get('/api/files/*', async (_request, reply) => reply.type('application/pdf').send(readFileSync(pdfPath)))
app.post<{ Body: { ids?: string[] } }>('/api/s2/papers/resolve', async (request) => ({ results: (request.body.ids || []).map((id) => id === 'a'.repeat(40) ? { id, status: 'resolved', source: 'library', paper: { title: 'Attention Is All You Need', authors: ['Fixture Author'], year: 2017, venue: 'NeurIPS' }, library_paper_id: 10 } : { id, status: 'unavailable', source: null, paper: null, library_paper_id: null }) }))
await app.register(topicRoutes); await app.register(topicGitRoutes); await app.register(mcpRoutes); await app.register(paperRoutes); await app.register(researchRoutes); await app.register(qaRoutes); await app.register(notesRoutes); await app.register(highlightsRoutes); await app.register(referenceLinksRoutes); await app.register(tagRoutes); await app.register(usageRoutes)
let address = ''
const clientDir = join(f.root, 'client')
async function git(args: string[], inClient = true) {
  return localProcess('git', ['-c', 'core.hooksPath=/dev/null', '-c', `http.extraHeader=Authorization: Bearer ${editorToken}`, ...(inClient ? ['-C', clientDir] : []), ...args], { timeout_ms: 20000, max_bytes: 33554432, env: { GIT_AUTHOR_NAME: 'Declared fixture author', GIT_AUTHOR_EMAIL: 'fixture@example.test', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test', GIT_TERMINAL_PROMPT: '0' } })
}
app.post<{ Body: { user_id: number } }>('/__fixture/actor', async (request) => { if ([1, 2, 3, 4].includes(request.body.user_id)) actor = request.body.user_id; return { user_id: actor } })
app.get('/__fixture/imports', async () => ({ calls: importCalls, library: f.db.select().from(schema.userPapers).all() }))
app.post('/__fixture/fail-import', async () => ({ failures: ++failImports }))
app.post('/__fixture/update', async () => {
  if (!update) await git(['clone', `${address}/topic-git/${topic.id}.git`, clientDir], false)
  update++
  const list = JSON.parse(readFileSync(join(clientDir, 'references.json'), 'utf8'))
  list.references.push({ id: `new-${update}`, reference_number: 4 + update, title: `New paper ${update}`, s2_id: `CorpusId:${123000 + update}`, comment: 'Added by an authenticated editor.' })
  writeFileSync(join(clientDir, 'references.json'), JSON.stringify(list, null, 2))
  writeFileSync(join(clientDir, 'pages/report.md'), readFileSync(join(clientDir, 'pages/report.md'), 'utf8') + `\nNew finding ${update}: compare methods using consistent evaluation data.\n`)
  writeFileSync(join(clientDir, 'pages/research-questions/rq6.md'), readFileSync(join(clientDir, 'pages/research-questions/rq6.md'), 'utf8').replace(/references: \[[^\]]*\]/, `references: [2, 3, 4, ${Array.from({ length: update }, (_, i) => i + 5).join(', ')}]`) + `\nNew RQ6 finding ${update}.\n`)
  await git(['add', '--', 'references.json', 'pages/report.md', 'pages/research-questions/rq6.md']); await git(['commit', '-m', `Add finding ${update}`]); await git(['push', 'origin', 'main'])
  return { update }
})
app.post('/__fixture/pdf-check', async () => {
  const response = await app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${checkToken}` }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_pdf_page', arguments: { paper_id: 10, page: 2, image: true, region: { x: 0.1, y: 0.2, width: 0.3, height: 0.15 } } } } })
  const result = response.json().result
  return { is_error: result.isError, image_blocks: result.content.filter((c: any) => c.type === 'image').length, metadata: JSON.parse(result.content[0].text) }
})
await registerFrontendHosting(app, build)
address = await app.listen({ port: 0, host: '127.0.0.1' })
const info = { url: address, topic_id: topic.id, legacy_id: session.id, seed_result_id: answer.id, migrated_topic_id: legacyImport[0]?.topic_id }
writeFileSync('/tmp/paperland-topics-preview.json', JSON.stringify(info), { mode: 0o600 })
console.log(JSON.stringify(info))
process.on('SIGTERM', async () => { await app.close(); f.close(); process.exit(0) })
