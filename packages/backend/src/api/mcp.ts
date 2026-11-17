import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getConfig } from '../config.js'
import { bearerFromHeader, checkBearerToken } from '../services/api_tokens.js'
import { workspaceOverview } from '../services/mcp_overview.js'
import { AGENT_TOOLS, callAgentTool, toolAllowed, type AgentToolContext } from '../services/agent_tools.js'
import { checkServiceSecret } from '../services/mcp_services.js'

// MCP server for agents (Streamable HTTP, stateless): every POST carries one JSON-RPC message or a
// batch and is answered with application/json — no SSE stream, no session id. Lives outside /api so
// the cookie login wall does not apply. Two credentials exist: a Plugins service key (external apps;
// `Authorization: Bearer <key>` on /mcp or the key in the path /mcp/s/<key>, limited by the service's
// permissions) and the agent token Paperland injects into its own Codex runs (Bearer on /mcp; also
// needed for `upload_image` by path; refused by the paper write tools). Tools run with the owner's
// visibility. Reachable from anywhere, like the External API.

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'paperland', version: '1.0.0' }
const INSTRUCTIONS = 'Tools over the Paperland paper library and Semantic Scholar, plus upload_image for figures. ' +
  'Maintain Topics with list_topics (active only) / get_topic; archived Topics are read-only and listed by list_archived_topics. Before editing read get_topic_schema for schema v1, reports.yml, reference rules and legacy migration; inspect get_topic.repository_schema for required upgrades. ' +
  'Use read_pdf_page for a physical PDF page and its native Markdown citation; request image=true only when a page image is needed. ' +
  'Use s2_match / s2_search to get S2 paperIds instead of guessing them. To read a paper, use read_paper (Paperland\'s parsed full text) instead of fetching arXiv HTML or the PDF yourself; go to arXiv (or read_pdf_page with image=true) only for tables, figures or layout the text does not capture. ' +
  'Save answers the user wants kept with add_paper_qa (give your model name). ' +
  'add_paper / update_paper / upload_paper_pdf / refresh_paper add and maintain papers ' +
  '(including work that is not on arXiv: a project page with a PDF, or a blog post). ' +
  'Before importing a blog post or other web article, read the guide with get_skill("blog-import"). ' +
  'upload_image also takes a "url" (images and videos); ' +
  'native local-file uploads go through POST /external-api/v1/images with the same key.'

interface RpcMessage {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: any
}

function rpcResult(id: RpcMessage['id'], result: unknown) {
  return { jsonrpc: '2.0', id, result }
}

function rpcError(id: RpcMessage['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

/** Handle one JSON-RPC message; `null` for notifications (no response body). */
async function handleMessage(message: RpcMessage, ctx: AgentToolContext): Promise<object | null> {
  if (!message || typeof message !== 'object' || typeof message.method !== 'string') {
    return rpcError(message?.id, -32600, 'Invalid request')
  }
  const isNotification = message.id === undefined
  if (isNotification) return null

  switch (message.method) {
    case 'initialize': {
      const requested = message.params?.protocolVersion
      return rpcResult(message.id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: [INSTRUCTIONS, workspaceOverview(ctx.viewer.id)].filter(Boolean).join('\n\n'),
      })
    }
    case 'ping':
      return rpcResult(message.id, {})
    case 'tools/list':
      return rpcResult(message.id, {
        tools: AGENT_TOOLS.filter((t) => toolAllowed(t, ctx)).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations ?? { readOnlyHint: true, openWorldHint: t.name.startsWith('s2_') },
        })),
      })
    case 'tools/call': {
      const name = message.params?.name
      if (typeof name !== 'string') return rpcError(message.id, -32602, 'params.name is required')
      const { text, isError, content } = await callAgentTool(name, message.params?.arguments, ctx)
      return rpcResult(message.id, { content: content ?? [{ type: 'text', text }], isError })
    }
    default:
      return rpcError(message.id, -32601, `Method not found: ${message.method}`)
  }
}

function methodNotAllowed(_request: FastifyRequest, reply: FastifyReply) {
  return reply.code(405).header('allow', 'POST').send({ error: 'Method not allowed' })
}

export async function mcpRoutes(app: FastifyInstance): Promise<void> {
  // `upload_image` / `upload_paper_pdf` / `add_paper` may carry a base64 file: allow the larger of the
  // image host's and the PDF upload's size limits (+ base64 and JSON overhead).
  const maxFileMb = Math.max(getConfig().image_host.max_size_mb, getConfig().image_host.max_video_size_mb, getConfig().pdf_upload.max_file_size_mb)
  const bodyLimit = Math.ceil(maxFileMb * 1024 * 1024 * 4 / 3) + 1024 * 1024
  async function serve(request: FastifyRequest, reply: FastifyReply, ctx: AgentToolContext) {
    const body = request.body as RpcMessage | RpcMessage[] | undefined
    if (Array.isArray(body)) {
      const responses = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter((r) => r !== null)
      return responses.length ? reply.send(responses) : reply.code(202).send()
    }
    if (!body || typeof body !== 'object') return reply.code(400).send(rpcError(null, -32700, 'Parse error'))
    const response = await handleMessage(body, ctx)
    return response ? reply.send(response) : reply.code(202).send()
  }
  const origin = (request: FastifyRequest) => `${request.headers['x-forwarded-proto'] === 'https' ? 'https' : request.protocol}://${request.headers.host}`

  app.post('/mcp', { bodyLimit }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    // Plugins service key (same service as its /mcp/s/<key> URL) or the owner's internal agent token.
    const check = checkBearerToken(bearerFromHeader(request.headers.authorization), ['service', 'agent'])
    if (!check.ok) {
      return reply.code(401).header('www-authenticate', 'Bearer').send(rpcError(null, -32001, check.message))
    }
    const ctx: AgentToolContext = check.token.kind === 'service'
      ? { viewer: { id: check.user.id, role: check.user.role }, token_kind: 'service', service_permissions: check.permissions, service_name: check.token.name ?? undefined, site_origin: origin(request) }
      : { viewer: { id: check.user.id, role: check.user.role }, token_kind: 'agent', site_origin: origin(request) }
    return serve(request, reply, ctx)
  })

  // Service URL (e.g. ChatGPT custom MCP with no authentication): the key in the path authenticates;
  // 404 (not 401) so clients do not start an OAuth discovery.
  app.post<{ Params: { secret: string } }>('/mcp/s/:secret', { bodyLimit }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const service = checkServiceSecret(request.params.secret)
    if (!service) return reply.code(404).send({ error: 'Not found' })
    const ctx: AgentToolContext = {
      viewer: { id: service.user.id, role: service.user.role }, token_kind: 'service',
      service_permissions: service.permissions, service_name: service.token.name ?? undefined, site_origin: origin(request),
    }
    return serve(request, reply, ctx)
  })
  app.get('/mcp', methodNotAllowed)
  app.delete('/mcp', methodNotAllowed)
  app.get('/mcp/s/:secret', methodNotAllowed)
  app.delete('/mcp/s/:secret', methodNotAllowed)
}
