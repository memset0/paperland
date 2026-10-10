import type { FastifyReply, FastifyRequest } from 'fastify'
import { getConfig } from '../config.js'
import { tokenAuth } from './token_auth.js'
import { resolveSessionUser, getDevAdmin } from './session_auth.js'

// `/api/*` routes an anonymous caller may reach (method + route pattern); everything else is 401.
export const ANONYMOUS_API = new Set([
  'GET /api/health',
  'POST /api/auth/login',
  'POST /api/auth/register',
  'GET /api/auth/me',
  'GET /api/notes/:noteId', // published notes stay readable by link; the handler 404s the rest
])

/**
 * Global onRequest hook: attaches `request.user` and enforces the website login wall.
 * - `/external-api/*`: Bearer token auth only.
 * - `/api/*`: session user (or the dev admin when auth is disabled); anonymous callers only reach
 *   ANONYMOUS_API. Rejecting here (not in a route preHandler) reliably stops every handler.
 *   Unknown routes (no pattern) fall through to the 404 handler. Admin checks stay per route.
 * - Everything else (`/image/*`, the SPA) is untouched and public.
 */
export async function identityHook(request: FastifyRequest, reply: FastifyReply): Promise<void | FastifyReply> {
  if (request.url === '/api/health') return

  if (request.url.startsWith('/external-api/')) {
    await tokenAuth(request, reply)
    return
  }

  if (request.url.startsWith('/api/')) {
    request.user = getConfig().auth.enabled ? resolveSessionUser(request) : getDevAdmin()
    const route = request.routeOptions?.url
    if (!request.user && route && !ANONYMOUS_API.has(`${request.method} ${route}`)) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
    }
  }
}
