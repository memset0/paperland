import type { FastifyInstance, FastifyReply } from 'fastify'
import { requireUser } from '../auth/guards.js'
import { createMcpService, listMcpServices, McpServiceError, revokeMcpService, rotateMcpService, updateMcpService } from '../services/mcp_services.js'

// The signed-in user's own MCP services (Plugins page). Every route acts on `request.user` only.
// The secret URL path is returned only by create and rotate.

function fail(reply: FastifyReply, error: unknown) {
  if (error instanceof McpServiceError) return reply.code(error.status).send({ error: { code: error.status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message: error.message } })
  throw error
}
const withUrl = <T extends { secret: string }>({ secret, ...service }: T) => ({ ...service, url_path: `/mcp/s/${secret}` })
const serviceId = (raw: string) => { const id = Number(raw); if (!Number.isInteger(id) || id < 1) throw new McpServiceError(404, 'Service not found'); return id }

export async function mcpServiceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/me/mcp-services', { preHandler: requireUser }, async (request) => ({ data: listMcpServices(request.user!.id) }))

  app.post<{ Body: { name?: unknown; permissions?: unknown } }>('/api/auth/me/mcp-services', { preHandler: requireUser }, async (request, reply) => {
    try { return reply.code(201).send({ data: withUrl(createMcpService(request.user!.id, request.body ?? {})) }) } catch (e) { return fail(reply, e) }
  })

  app.patch<{ Params: { id: string }; Body: { name?: unknown; permissions?: unknown } }>('/api/auth/me/mcp-services/:id', { preHandler: requireUser }, async (request, reply) => {
    try { return { data: updateMcpService(request.user!.id, serviceId(request.params.id), request.body ?? {}) } } catch (e) { return fail(reply, e) }
  })

  app.post<{ Params: { id: string } }>('/api/auth/me/mcp-services/:id/rotate', { preHandler: requireUser }, async (request, reply) => {
    try { return { data: withUrl(rotateMcpService(request.user!.id, serviceId(request.params.id))) } } catch (e) { return fail(reply, e) }
  })

  app.delete<{ Params: { id: string } }>('/api/auth/me/mcp-services/:id', { preHandler: requireUser }, async (request, reply) => {
    try { revokeMcpService(request.user!.id, serviceId(request.params.id)); return { success: true } } catch (e) { return fail(reply, e) }
  })
}
