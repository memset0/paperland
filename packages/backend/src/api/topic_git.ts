import type { FastifyInstance, FastifyRequest } from 'fastify'
import { bearerFromHeader, checkBearerToken } from '../services/api_tokens.js'
import { requireTopicAccess } from '../services/topic_access.js'
import { withTopicLock } from '../services/topic_lock.js'
import { reconcileTopic, topicGitAdvertisement, topicGitRpc } from '../services/topic_git.js'
import { TopicError } from '../services/topic_format.js'
import { getConfig } from '../config.js'

function gitSecret(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  const bearer = bearerFromHeader(header)
  if (bearer) return bearer
  if (!header?.startsWith('Basic ')) return null
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const colon = decoded.indexOf(':')
  return colon >= 0 ? decoded.slice(colon + 1) : null
}
function authenticate(request: FastifyRequest, topicId: number, writing: boolean) {
  const check = checkBearerToken(gitSecret(request), ['topic'])
  if (!check.ok) throw new TopicError(401, check.message)
  if (check.token.topic_id !== topicId) throw new TopicError(404, 'Topic not found')
  requireTopicAccess(topicId, check.user.id, writing ? 'editor' : 'viewer')
  return check
}

export async function topicGitRoutes(app: FastifyInstance): Promise<void> {
  for (const service of ['upload', 'receive']) app.addContentTypeParser(`application/x-git-${service}-pack-request`, { parseAs: 'buffer' }, (_req, body, done) => done(null, body))
  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof TopicError ? error.status : error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500
    if (status === 401) reply.header('WWW-Authenticate', 'Basic realm="Paperland Topic"')
    reply.code(status).type('text/plain').send(`Topic Git request failed: ${status === 500 ? 'Publication could not finish; retry after recovery' : error instanceof Error ? error.message : 'Invalid request'}\n`)
  })
  app.get<{ Params: { id: string }; Querystring: { service?: string } }>('/topic-git/:id.git/info/refs', async (request, reply) => {
    const id = Number(request.params.id), service = request.query.service ?? ''
    if (!/^[1-9]\d*$/.test(request.params.id)) throw new TopicError(404, 'Topic not found')
    authenticate(request, id, service === 'git-receive-pack')
    return withTopicLock(id, async () => {
      authenticate(request, id, service === 'git-receive-pack')
      await reconcileTopic(id)
      return reply.header('Cache-Control', 'no-store').type(`application/x-${service}-advertisement`).send(await topicGitAdvertisement(id, service, request.headers['git-protocol'] as string | undefined))
    })
  })
  app.post<{ Params: { id: string; service: string } }>('/topic-git/:id.git/:service', { bodyLimit: getConfig().topics.max_push_bytes }, async (request, reply) => {
    const id = Number(request.params.id), service = request.params.service
    if (!/^[1-9]\d*$/.test(request.params.id) || !['git-upload-pack', 'git-receive-pack'].includes(service)) throw new TopicError(404, 'Topic not found')
    authenticate(request, id, service === 'git-receive-pack')
    if (!Buffer.isBuffer(request.body)) throw new TopicError(400, 'Git binary request required')
    return withTopicLock(id, async () => {
      const check = authenticate(request, id, service === 'git-receive-pack')
      await reconcileTopic(id)
      const output = await topicGitRpc(id, service, request.body as Buffer, { user_id: check.user.id, token_id: check.token.id, display_name: check.user.nickname || check.user.username }, () => { authenticate(request, id, true) }, request.headers['git-protocol'] as string | undefined)
      return reply.header('Cache-Control', 'no-store').type(`application/x-${service}-result`).send(output)
    })
  })
}
