import type { FastifyRequest, FastifyReply } from 'fastify'

/** preHandler: require any authenticated user. Returns the reply on rejection so Fastify
 * halts the lifecycle (otherwise the route handler runs against a missing `request.user`). */
export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void | FastifyReply> {
  if (!request.user) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
  }
}

/** preHandler: require an authenticated admin. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void | FastifyReply> {
  if (!request.user) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
  }
  if (request.user.role !== 'admin') {
    return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } })
  }
}
