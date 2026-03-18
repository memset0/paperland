import type { FastifyRequest, FastifyReply } from 'fastify'
import { getConfig } from '../config.js'

export async function basicAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    reply.header('WWW-Authenticate', 'Basic realm="Paperland"')
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
    return
  }

  const encoded = authHeader.slice(6)
  let decoded: string
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf-8')
  } catch {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
    return
  }

  const colonIndex = decoded.indexOf(':')
  if (colonIndex === -1) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
    return
  }

  const username = decoded.slice(0, colonIndex)
  const password = decoded.slice(colonIndex + 1)

  const config = getConfig()
  const user = config.auth.users.find(
    (u) => u.username === username && u.password === password
  )

  if (!user) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
    return
  }
}
