import type { TopicDetail } from '@paperland/shared'
import { topicSchemaContract } from './topic_schema.js'
import type { AgentToolContext, AgentToolDef } from './agent_tools.js'
import { createTopic, getTopic, importTopicEntry, listTopics, setTopicArchived, topicHistory, topicId } from './topics.js'
import { setTopicDefaultAccess, setTopicMember, topicMembers } from './topic_access.js'
import { TopicError } from './topic_format.js'

const idProperty = { type: 'integer', minimum: 1 }
const topicProps = { topic_id: idProperty }
const schema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false })
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
const read = { readOnlyHint: true, openWorldHint: false }
function personal(ctx: AgentToolContext) {
  if (ctx.token_kind !== 'service') throw new TopicError(403, 'This operation requires a Plugins service key')
}
function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TopicError(422, `${name} must be a non-empty string`)
  return value.trim()
}
const id = (args: Record<string, unknown>, _ctx: AgentToolContext) => topicId(args.topic_id)

function topicReadResult<T extends TopicDetail>(value: T, args: Record<string, unknown>) {
  if (args.metadata_only !== undefined && typeof args.metadata_only !== 'boolean') throw new TopicError(422, 'metadata_only must be a boolean')
  if (args.document === undefined && !args.metadata_only) return value
  const { snapshot, documents, ...metadata } = value
  if (args.document !== undefined) {
    let path = text(args.document, 'document')
    if (path === 'report.md') path = value.home_page
    if (path === 'pages/questions.md' && !documents.some((d) => d.path === path)) path = 'pages/research-questions/index.md'
    const document = documents.find((d) => d.path === path && d.exists)
    if (!document) throw new TopicError(404, 'Topic document not found in this version')
    const allowed = new Set(document.references)
    return { ...metadata, document: args.metadata_only ? { ...document, body: undefined } : document, references: snapshot.list.papers.filter((p) => allowed.has(value.reference_numbers[p.id])).map(({ directory_ids, ...p }) => ({ ...p, reference_number: value.reference_numbers[p.id] })) }
  }
  return { ...metadata, topic: snapshot.topic, navigation: snapshot.navigation, documents: documents.map(({ body, ...info }) => info), references: snapshot.list.papers.map(({ directory_ids, ...p }) => ({ ...p, reference_number: value.reference_numbers[p.id] })) }
}

export const TOPIC_TOOLS: AgentToolDef[] = [
  { name: 'get_topic_schema', description: 'Read the current or a supported Topic repository schema: reports.yml navigation, references.json, frontmatter, limits and step-by-step legacy migration. Read before editing a Topic.', inputSchema: schema({ schema_version: { type: 'integer', minimum: 1 } }), annotations: read,
    handler: async (a) => topicSchemaContract(a.schema_version) },
  { name: 'list_topics', description: 'List the active Topics you own or can access. Archived Topics are not included; use list_archived_topics for those.', inputSchema: schema({ scope: { type: 'string', enum: ['mine', 'all'] } }), annotations: read,
    handler: async (a, c) => ({ topics: listTopics(c.viewer.id, a.scope === 'mine' ? 'mine' : 'all', { archived: false }) }) },
  { name: 'list_archived_topics', description: 'List archived Topics you own or can access. They are read-only until their owner unarchives them.', inputSchema: schema({ scope: { type: 'string', enum: ['mine', 'all'] } }), annotations: read,
    handler: async (a, c) => ({ topics: listTopics(c.viewer.id, a.scope === 'mine' ? 'mine' : 'all', { archived: true }) }) },
  { name: 'get_topic', description: 'Read Topic documents, the shared numbered reference catalog, current or historical commit, permissions, Git URL, schema status and repository contract. Read get_topic_schema before editing.', inputSchema: schema({ ...topicProps, commit: { type: 'string' }, document: { type: 'string', description: 'Read this pages/**/*.md document or root AGENTS.md and its reference subset.' }, metadata_only: { type: 'boolean', description: 'Omit report/page bodies; return document metadata and numbered references.' } }, ['topic_id']), annotations: read,
    handler: async (a, c) => topicReadResult({ ...await getTopic(id(a, c), c.viewer.id, a.commit === undefined ? undefined : text(a.commit, 'commit'), c.site_origin), repository_contract: topicSchemaContract() }, a) },
  { name: 'get_topic_history', description: 'Read Topic versions with declared Git authors and authenticated Paperland pushers. Use next_offset for older versions.', inputSchema: schema({ ...topicProps, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, ['topic_id']), annotations: read,
    handler: async (a, c) => topicHistory(id(a, c), c.viewer.id, a.offset === undefined ? 0 : Number(a.offset), a.limit === undefined ? 50 : Number(a.limit)) },
  { name: 'create_topic', description: 'Create a Topic and initialized Git repository without running a model. Optionally seed its report from a visible Q&A result.', inputSchema: schema({ title: { type: 'string' }, description: { type: 'string' }, seed_result_id: idProperty, default_access: { type: 'string', enum: ['none', 'viewer', 'editor'], default: 'none' } }, ['title']), annotations: write, write: true,
    handler: async (a, c) => { personal(c); return createTopic(c.viewer.id, { title: text(a.title, 'title'), description: a.description === undefined ? undefined : String(a.description), seed_result_id: a.seed_result_id === undefined ? undefined : topicId(a.seed_result_id), default_access: a.default_access as 'none' | 'viewer' | 'editor' | undefined }, c.site_origin) } },
  { name: 'set_topic_sharing', description: 'Owner-only: set default access for other active signed-in users to none (Private), viewer or editor (Public). Effective permission is the higher of individual and general access.', inputSchema: schema({ ...topicProps, default_access: { type: 'string', enum: ['none', 'viewer', 'editor'] } }, ['topic_id', 'default_access']), annotations: { ...write, destructiveHint: true }, write: true,
    handler: async (a, c) => { personal(c); return setTopicDefaultAccess(id(a, c), c.viewer.id, a.default_access as 'none' | 'viewer' | 'editor') } },
  { name: 'set_topic_archived', description: 'Owner-only: archive a Topic (it stays listed and readable but its content can no longer change; Git pushes are refused) or unarchive it.', inputSchema: schema({ ...topicProps, archived: { type: 'boolean' } }, ['topic_id', 'archived']), annotations: { ...write, idempotentHint: true }, write: true,
    handler: async (a, c) => { personal(c); if (typeof a.archived !== 'boolean') throw new TopicError(422, 'archived must be a boolean'); return setTopicArchived(id(a, c), c.viewer.id, a.archived) } },
  { name: 'get_topic_members', description: 'Read the members and permissions of an accessible Topic.', inputSchema: schema(topicProps, ['topic_id']), annotations: read,
    handler: async (a, c) => ({ members: topicMembers(id(a, c), c.viewer.id) }) },
  { name: 'set_topic_member', description: 'Owner-only sharing: set an active username to viewer/editor, or role=null to remove access.', inputSchema: schema({ ...topicProps, username: { type: 'string' }, role: { type: ['string', 'null'], enum: ['viewer', 'editor', null] } }, ['topic_id', 'username', 'role']), annotations: { ...write, destructiveHint: true }, write: true,
    handler: async (a, c) => { personal(c); if (![null, 'viewer', 'editor'].includes(a.role as any)) throw new TopicError(422, 'role must be viewer, editor or null'); return { members: await setTopicMember(id(a, c), c.viewer.id, text(a.username, 'username'), a.role as 'viewer' | 'editor' | null) } } },
  { name: 'import_topic_paper', description: 'Explicitly import a site/S2 or recognized arXiv-paper URL entry from your accessible Topic into your own Paperland library. Does not rewrite Git content.', inputSchema: schema({ ...topicProps, entry_id: { type: 'string' }, commit: { type: 'string' } }, ['topic_id', 'entry_id']), annotations: { ...write, openWorldHint: true }, write: true, topic_scoped: true,
    handler: async (a, c) => { personal(c); return importTopicEntry(id(a, c), c.viewer.id, text(a.entry_id, 'entry_id'), a.commit === undefined ? undefined : text(a.commit, 'commit')) } },
]
