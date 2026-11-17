import type { FastifyRequest, FastifyReply } from 'fastify'
import { toSessionUser } from './session_auth.js'
import { bearerFromHeader, checkBearerToken } from '../services/api_tokens.js'

/**
 * External API auth: `Authorization: Bearer <key>` of a Plugins service. Acts as the service owner;
 * methods other than GET/HEAD need the service's `write` permission. Agent tokens are /mcp-only.
 */
export async function tokenAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const check = checkBearerToken(bearerFromHeader(request.headers.authorization), ['service'])
  if (!check.ok) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: check.message } })
    return
  }
  if (!['GET', 'HEAD'].includes(request.method) && !check.permissions?.write) {
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'This Plugins service is read-only; enable write on the Plugins page' } })
    return
  }
  request.user = toSessionUser(check.user)
}
