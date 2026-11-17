// Offline inventory of the MCP tool surface for design reviews (`/mcp-review`).
// Drives the real `/mcp` route on a throwaway in-memory database with a seeded agent token and
// Plugins services (default permissions, read-only, and every permission), so the output is exactly
// what clients receive. Never opens data/paperland.db and
// never contacts external services (only initialize and tools/list are sent).
//
//   bun run packages/backend/src/testing/mcp_inventory.ts          # markdown
//   bun run packages/backend/src/testing/mcp_inventory.ts --json   # machine-readable
import { resolve } from 'node:path'
import Fastify from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { ensureAgentToken } from '../services/api_tokens.js'
import { createMcpService } from '../services/mcp_services.js'
import { mcpRoutes } from '../api/mcp.js'

const args = process.argv.slice(2)
for (const a of args) if (a !== '--json') throw new Error(`Unknown argument: ${a}`)
const asJson = args.includes('--json')
const root = resolve(import.meta.dir, '../../../..')

loadConfig(resolve(root, 'config.yml'))
const db = drizzle(new Database(':memory:'), { schema })
migrate(db, { migrationsFolder: resolve(root, 'packages/backend/src/db/migrations') })
setDatabaseForTesting(db)
const now = new Date().toISOString()
db.insert(schema.users).values({ id: 1, username: 'inventory', password_hash: 'x', role: 'user', created_at: now }).run()
db.insert(schema.topics).values({ id: 1, owner_id: 1, title: 'Inventory', created_at: now, updated_at: now }).run()
db.insert(schema.topicMembers).values({ topic_id: 1, user_id: 1, role: 'owner' }).run()
const tokens = {
  service_default: createMcpService(1, { name: 'Default' }).secret,
  service_read_only: createMcpService(1, { name: 'Read only', permissions: { write: false } }).secret,
  service_all: createMcpService(1, { name: 'All', permissions: { delete_papers: true, delete_answers: true } }).secret,
  agent: ensureAgentToken(1).token,
}

const app = Fastify({ logger: false })
await app.register(mcpRoutes)
await app.ready()
async function rpc(token: string, method: string, params: unknown = {}) {
  const res = await app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${token}` }, payload: { jsonrpc: '2.0', id: 1, method, params } })
  const body = res.json()
  if (res.statusCode !== 200 || body.error) throw new Error(`${method} failed: ${res.statusCode} ${JSON.stringify(body.error ?? body)}`)
  return body.result
}

type Tool = { name: string; description: string; inputSchema: any; annotations: Record<string, unknown> }
const perKind: Record<string, { instructions: string; tools: Tool[] }> = {}
for (const [kind, token] of Object.entries(tokens)) {
  const init = await rpc(token, 'initialize', { protocolVersion: '2025-06-18' })
  const list = await rpc(token, 'tools/list')
  perKind[kind] = { instructions: init.instructions ?? '', tools: list.tools }
}
await app.close()

const base = perKind.service_all
const sameForAll = Object.values(perKind).every((k) => JSON.stringify(k) === JSON.stringify(base))
const tools = base.tools.map((t) => {
  const props = Object.keys(t.inputSchema?.properties ?? {})
  return {
    name: t.name,
    description_chars: t.description.length,
    schema_chars: JSON.stringify(t.inputSchema).length,
    total_chars: JSON.stringify(t).length,
    params: props,
    required: t.inputSchema?.required ?? [],
    annotations: t.annotations,
    description: t.description,
    input_schema: t.inputSchema,
  }
})
const totals = {
  tool_count: tools.length,
  instructions_chars: base.instructions.length,
  description_chars: tools.reduce((s, t) => s + t.description_chars, 0),
  tools_list_chars: JSON.stringify(base.tools).length,
}
const differing = sameForAll ? [] : Object.entries(perKind).filter(([, k]) => JSON.stringify(k) !== JSON.stringify(base)).map(([kind]) => kind)

if (asJson) {
  console.log(JSON.stringify({ generated_at: now, token_kinds: Object.keys(tokens), same_for_all_token_kinds: sameForAll, differing_kinds: differing, totals, instructions: base.instructions, tools, per_kind: sameForAll ? undefined : perKind }, null, 2))
} else {
  const ann = (a: Record<string, unknown>) => Object.entries(a).filter(([, v]) => v === true).map(([k]) => k.replace('Hint', '')).join(', ') || '-'
  const out: string[] = []
  out.push(`# MCP inventory (${now})`, '')
  out.push(`- Token kinds checked: ${Object.keys(tokens).join(', ')}; initialize + tools/list identical for all: ${sameForAll ? 'yes' : `no (differs: ${differing.join(', ')})`}`)
  out.push(`- Tools: ${totals.tool_count}; tools/list JSON: ${totals.tools_list_chars} chars; descriptions: ${totals.description_chars} chars; initialize instructions: ${totals.instructions_chars} chars`, '')
  out.push('| Tool | Desc chars | Total chars | Params (required*) | Annotations (true) |', '| --- | ---: | ---: | --- | --- |')
  for (const t of tools) out.push(`| ${t.name} | ${t.description_chars} | ${t.total_chars} | ${t.params.map((p) => t.required.includes(p) ? `${p}*` : p).join(', ') || '-'} | ${ann(t.annotations)} |`)
  out.push('', '## Initialize instructions', '', base.instructions, '', '## Tool descriptions', '')
  for (const t of tools) out.push(`### ${t.name}`, '', t.description, '', '```json', JSON.stringify(t.input_schema), '```', '')
  console.log(out.join('\n'))
}
