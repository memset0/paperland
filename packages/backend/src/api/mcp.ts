import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getConfig } from '../config.js'
import { bearerFromHeader, checkBearerToken, type TokenKind } from '../services/api_tokens.js'
import { AGENT_TOOLS, callAgentTool, type AgentToolContext } from '../services/agent_tools.js'

// MCP server for agents (Streamable HTTP, stateless): every POST carries one JSON-RPC message or a
// batch and is answered with application/json — no SSE stream, no session id. Lives outside /api so
// the cookie login wall does not apply; every request needs `Authorization: Bearer <api token>`
// (a user's personal token, or the agent token Paperland injects into its own Codex runs), and the
// tools run with that user's visibility (`upload_image` by path additionally needs an agent token;
// the paper write tools need a personal token). Reachable from anywhere, like the External API.

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'paperland', version: '1.0.0' }
const INSTRUCTIONS = 'Tools over the Paperland paper library and Semantic Scholar, plus upload_image for figures. ' +
  'Maintain Topics with list_topics / get_topic and the returned Git repository contract; Topic tokens identify you and one Topic. ' +
  'Use read_pdf_page for a physical PDF page and its native Markdown citation; request image=true only when a page image is needed. ' +
  'Use s2_match / s2_search to get S2 paperIds instead of guessing them; read library papers with read_paper. ' +
  'With a personal token, add_paper / update_paper / upload_paper_pdf / refresh_paper add and maintain papers ' +
  '(including work that is not on arXiv: a project page with a PDF, or a blog post). ' +
  'Before importing a blog post or other web article, read the guide with get_skill("blog-import"). ' +
  'upload_image also takes a "url" (images and videos). Topic tokens can use upload_image with data or url; ' +
  'native local-file uploads through POST /external-api/v1/images require a personal token.'

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
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return rpcResult(message.id, {})
    case 'tools/list':
      return rpcResult(message.id, {
        tools: AGENT_TOOLS.map((t) => ({
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
  app.post('/mcp', { bodyLimit }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const check = checkBearerToken(bearerFromHeader(request.headers.authorization), ['personal', 'agent', 'topic'])
    if (!check.ok) {
      return reply.code(401).header('www-authenticate', 'Bearer').send(rpcError(null, -32001, check.message))
    }
    const ctx: AgentToolContext = {
      viewer: { id: check.user.id, role: check.user.role }, token_kind: check.token.kind as TokenKind,
      ...(check.token.kind === 'topic' ? { topic_id: check.token.topic_id! } : {}),
      site_origin: `${request.headers['x-forwarded-proto'] === 'https' ? 'https' : request.protocol}://${request.headers.host}`,
    }

    const body = request.body as RpcMessage | RpcMessage[] | undefined
    if (Array.isArray(body)) {
      const responses = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter((r) => r !== null)
      return responses.length ? reply.send(responses) : reply.code(202).send()
    }
    if (!body || typeof body !== 'object') return reply.code(400).send(rpcError(null, -32700, 'Parse error'))
    const response = await handleMessage(body, ctx)
    return response ? reply.send(response) : reply.code(202).send()
  })
  app.get('/mcp', methodNotAllowed)
  app.delete('/mcp', methodNotAllowed)
}
