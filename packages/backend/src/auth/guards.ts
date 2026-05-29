import type { FastifyRequest, FastifyReply } from 'fastify'

/** preHandler: require any authenticated user. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
  }
}

/** preHandler: require an authenticated admin. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
    return
  }
  if (request.user.role !== 'admin') {
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } })
  }
}
