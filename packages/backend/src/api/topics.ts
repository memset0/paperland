import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireUser } from '../auth/guards.js'
import { TopicError } from '../services/topic_format.js'
import { createTopic, getTopic, importTopicEntry, listTopics, renameTopic, topicHistory, topicId, topicSeedPreview } from '../services/topics.js'
import { issueTopicCredential, listTopicCredentials, revokeTopicCredential, setTopicDefaultAccess, setTopicMember, topicMembers } from '../services/topic_access.js'
import { PaperActionError } from '../services/paper_actions.js'

const create = z.object({ title: z.string().trim().min(1).max(500), description: z.string().max(10000).optional(), seed_result_id: z.number().int().positive().optional(), default_access: z.enum(['none', 'viewer', 'editor']).optional() }).strict()
const sharing = z.object({ default_access: z.enum(['none', 'viewer', 'editor']) }).strict()
const member = z.object({ username: z.string().trim().min(1), role: z.enum(['viewer', 'editor']).nullable() }).strict()
const entry = z.object({ entry_id: z.string().min(1), commit: z.string().regex(/^[a-f0-9]{40}$/).optional() }).strict()
const rename = z.object({ title: z.string().trim().min(1).max(500), base_commit: z.string().regex(/^[a-f0-9]{40}$/) }).strict()

export async function topicRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store') })
  app.addHook('preHandler', requireUser)
  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof TopicError || error instanceof PaperActionError ? error.status : error instanceof z.ZodError ? 422 : 500
    reply.code(status).send({ error: { code: status === 500 ? 'INTERNAL_ERROR' : 'TOPIC_ERROR', message: status === 500 ? 'Topic operation could not finish' : error instanceof Error ? error.message : 'Invalid request' } })
  })
  app.get<{ Querystring: { scope?: string } }>('/api/topics', async (r) => ({ data: listTopics(r.user!.id, r.query.scope) }))
  app.post('/api/topics', async (r, reply) => reply.code(201).send({ data: await createTopic(r.user!.id, create.parse(r.body)) }))
  app.get<{ Querystring: { result_id?: string } }>('/api/topics/seed-preview', async (r) => ({ data: topicSeedPreview(topicId(r.query.result_id), r.user!) }))
  app.get<{ Params: { id: string }; Querystring: { commit?: string } }>('/api/topics/:id', async (r) => ({ data: await getTopic(topicId(r.params.id), r.user!.id, r.query.commit) }))
  app.patch<{ Params: { id: string } }>('/api/topics/:id', async (r) => {
    const input = rename.parse(r.body)
    return { data: await renameTopic(topicId(r.params.id), r.user!.id, input.title, input.base_commit) }
  })
  app.get<{ Params: { id: string }; Querystring: { offset?: string; limit?: string } }>('/api/topics/:id/history', async (r) => ({ data: topicHistory(topicId(r.params.id), r.user!.id, Number(r.query.offset ?? 0), Number(r.query.limit ?? 50)) }))
  app.put<{ Params: { id: string } }>('/api/topics/:id/sharing', async (r) => ({ data: await setTopicDefaultAccess(topicId(r.params.id), r.user!.id, sharing.parse(r.body).default_access) }))
  app.get<{ Params: { id: string } }>('/api/topics/:id/members', async (r) => ({ data: topicMembers(topicId(r.params.id), r.user!.id) }))
  app.put<{ Params: { id: string } }>('/api/topics/:id/members', async (r) => {
    const input = member.parse(r.body)
    return { data: await setTopicMember(topicId(r.params.id), r.user!.id, input.username, input.role) }
  })
  app.get<{ Params: { id: string } }>('/api/topics/:id/tokens', async (r) => ({ data: listTopicCredentials(topicId(r.params.id), r.user!.id) }))
  app.post<{ Params: { id: string } }>('/api/topics/:id/tokens', async (r, reply) => reply.code(201).send({ data: await issueTopicCredential(topicId(r.params.id), r.user!.id) }))
  app.post<{ Params: { id: string; token_id: string } }>('/api/topics/:id/tokens/:token_id/rotate', async (r) => ({ data: await issueTopicCredential(topicId(r.params.id), r.user!.id, topicId(r.params.token_id)) }))
  app.delete<{ Params: { id: string; token_id: string } }>('/api/topics/:id/tokens/:token_id', async (r) => ({ data: await revokeTopicCredential(topicId(r.params.id), r.user!.id, topicId(r.params.token_id)) }))
  app.post<{ Params: { id: string } }>('/api/topics/:id/import', async (r) => {
    const input = entry.parse(r.body)
    return { data: await importTopicEntry(topicId(r.params.id), r.user!.id, input.entry_id, input.commit) }
  })
}
