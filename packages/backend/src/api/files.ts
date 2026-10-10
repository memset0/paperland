import type { FastifyInstance } from 'fastify'
import { existsSync, readFileSync } from 'fs'
import { resolve, sep } from 'path'

// PDF file serving for the viewer (paper PDFs and doc2x translated PDFs).
export async function fileRoutes(app: FastifyInstance): Promise<void> {
  // Login-only (login wall). Confined to PDFs inside data/ — stored paths are `data/pdfs/…` and
  // `data/doc2x/…/*.pdf`; anything else (traversal, the database, config) is a 404.
  app.get<{ Params: { '*': string } }>('/api/files/*', async (request, reply) => {
    const dataDir = resolve(process.cwd(), 'data')
    const filePath = resolve(process.cwd(), decodeURIComponent(request.params['*']))
    if (!filePath.startsWith(dataDir + sep) || !filePath.toLowerCase().endsWith('.pdf') || !existsSync(filePath)) {
      reply.code(404).send({ error: 'File not found' })
      return
    }
    const buffer = readFileSync(filePath)
    reply.header('Content-Type', 'application/pdf')
    reply.header('Cache-Control', 'private, max-age=86400')
    return reply.send(buffer)
  })
}
