import type { FastifyInstance } from 'fastify'
import { createReadStream, existsSync, statSync } from 'fs'
import { resolve, sep } from 'path'
import { getConfig } from '../config.js'
import { mimeForExt } from '../services/image_store.js'

/** Parse a single `bytes=` range against a file size; null = no/unsupported range, 'invalid' = 416. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null
  const m = header.match(/^bytes=(\d*)-(\d*)$/)
  if (!m) return null // multi-range or other units: serve the whole file
  const [, a, b] = m
  let start: number
  let end: number
  if (a === '' && b === '') return 'invalid'
  if (a === '') {
    const suffix = Number(b)
    if (suffix === 0) return 'invalid'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(a)
    end = b === '' ? size - 1 : Math.min(Number(b), size - 1)
  }
  if (start >= size || start > end) return 'invalid'
  return { start, end }
}

/**
 * Public image host serving — NO auth by design (any holder of the link can view). Lives outside
 * /api/* so the identity hook leaves it open. Content-addressed files are immutable, so they are
 * cached aggressively. Files are streamed with Range support so videos can seek.
 */
export async function imageServingRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { '*': string } }>('/image/*', async (request, reply) => {
    const baseDir = resolve(process.cwd(), getConfig().image_host.dir)
    const rel = decodeURIComponent(request.params['*'] || '')
    const filePath = resolve(baseDir, rel)
    // Path-traversal guard: the resolved path must stay inside the storage dir.
    if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
      reply.code(400).send({ error: 'Invalid path' })
      return
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      reply.code(404).send({ error: 'Image not found' })
      return
    }
    const size = statSync(filePath).size
    reply.header('Content-Type', mimeForExt(filePath.split('.').pop() || ''))
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')
    reply.header('Accept-Ranges', 'bytes')
    const range = parseRange(request.headers.range, size)
    if (range === 'invalid') {
      reply.code(416).header('Content-Range', `bytes */${size}`).send()
      return
    }
    if (range) {
      reply.code(206)
        .header('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
        .header('Content-Length', String(range.end - range.start + 1))
      return reply.send(createReadStream(filePath, { start: range.start, end: range.end }))
    }
    reply.header('Content-Length', String(size))
    return reply.send(createReadStream(filePath))
  })
}
