import type { FastifyInstance } from 'fastify'
import { readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { requireUser } from '../auth/guards.js'
import { getOrCreateOpenToken } from '../auth/open_token.js'

// The browser extension ships as plain files (no build step), read straight from the repo
// (packages/browser-extension, resolved from this file so it is independent of the CWD).
const EXTENSION_DIR = resolve(dirname(new URL(import.meta.url).pathname), '../../../browser-extension')
// Runtime files only — tests and package.json stay out of the archive.
const RUNTIME_ENTRIES = ['manifest.json', 'icons', 'src']

function collectFiles(baseDir: string, entries: string[]): Array<{ name: string; data: Buffer }> {
  const out: Array<{ name: string; data: Buffer }> = []
  const walk = (rel: string) => {
    const abs = join(baseDir, rel)
    if (statSync(abs).isDirectory()) {
      for (const child of readdirSync(abs).sort()) walk(`${rel}/${child}`)
    } else {
      out.push({ name: rel, data: readFileSync(abs) })
    }
  }
  for (const entry of entries) walk(entry)
  return out
}

/** Minimal ZIP writer (STORE method, no compression) — enough for a few small files. */
export function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf-8')
    const crc = Bun.hash.crc32(data) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // local file header signature
    local.writeUInt16LE(20, 4)         // version needed
    local.writeUInt16LE(0x0800, 6)     // flags: UTF-8 names
    local.writeUInt16LE(0, 8)          // method: STORE
    local.writeUInt16LE(0, 10)         // mod time
    local.writeUInt16LE(0x21, 12)      // mod date (1980-01-01)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBuf, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0) // central directory header signature
    central.writeUInt16LE(20, 4)         // version made by
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)    // local header offset (other fields stay 0)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

export async function extensionRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/extension/download?base_url=<origin> — the browser extension as a zip, with
  // `src/preset.json` carrying this user's site URL + quick-open token so it works on install.
  app.get<{ Querystring: { base_url?: string } }>(
    '/api/extension/download',
    { preHandler: requireUser },
    async (request, reply) => {
      let baseUrl: string
      try {
        const u = new URL(request.query.base_url ?? '')
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
        baseUrl = u.toString().replace(/\/+$/, '')
      } catch {
        return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'base_url must be an absolute http(s) URL' } })
      }

      const manifest = JSON.parse(readFileSync(join(EXTENSION_DIR, 'manifest.json'), 'utf-8'))
      const preset = { base_url: baseUrl, token: getOrCreateOpenToken(request.user!.id) }
      const files = collectFiles(EXTENSION_DIR, RUNTIME_ENTRIES).filter((f) => f.name !== 'src/preset.json')
      files.push({ name: 'src/preset.json', data: Buffer.from(JSON.stringify(preset, null, 2) + '\n') })

      reply.header('Content-Type', 'application/zip')
      reply.header('Content-Disposition', `attachment; filename="paperland-extension-${manifest.version}.zip"`)
      reply.header('Cache-Control', 'no-store')
      return reply.send(buildZip(files))
    }
  )
}
