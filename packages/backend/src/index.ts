import Fastify from 'fastify'
import cors from '@fastify/cors'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { loadConfig } from './config.js'
import { initDatabase } from './db/index.js'
import { basicAuth } from './auth/basic_auth.js'
import { tokenAuth } from './auth/token_auth.js'
import { settingsRoutes } from './api/settings.js'
import { paperRoutes } from './api/papers.js'
import { serviceRoutes } from './api/services.js'
import { qaRoutes } from './api/qa.js'
import { externalPaperRoutes } from './external-api/papers.js'
import { externalTagRoutes } from './external-api/tags.js'
import { startBackupScheduler } from './db/backup.js'
import { serviceRunner } from './services/service_runner.js'
import { arxivService } from './services/arxiv_service.js'
import { semanticScholarService } from './services/semantic_scholar_service.js'
import { pdfParseService } from './services/pdf_parse_service.js'

async function main() {
  // Load config
  loadConfig()

  // Initialize database
  initDatabase()

  // Start backup scheduler
  startBackupScheduler()

  // Initialize service runner
  serviceRunner.initialize()
  serviceRunner.register(arxivService)
  serviceRunner.register(semanticScholarService)
  serviceRunner.register(pdfParseService)

  // Create Fastify instance
  const app = Fastify({ logger: true })

  // CORS
  await app.register(cors, { origin: true, credentials: true })

  // Health check (no auth)
  app.get('/api/health', async () => ({ status: 'ok' }))

  // Apply auth hooks
  app.addHook('onRequest', async (request, reply) => {
    // Skip health check
    if (request.url === '/api/health') return

    // External API uses token auth
    if (request.url.startsWith('/external-api/')) {
      await tokenAuth(request, reply)
      return
    }

    // Internal API uses basic auth
    if (request.url.startsWith('/api/')) {
      await basicAuth(request, reply)
      return
    }
  })

  // File serving for PDF viewer
  app.get<{ Params: { '*': string } }>('/api/files/*', async (request, reply) => {
    const filePath = resolve(process.cwd(), decodeURIComponent(request.params['*']))
    if (!existsSync(filePath)) {
      reply.code(404).send({ error: 'File not found' })
      return
    }
    const buffer = readFileSync(filePath)
    reply.header('Content-Type', 'application/pdf')
    reply.header('Cache-Control', 'public, max-age=86400')
    return reply.send(buffer)
  })

  // Register routes
  await app.register(settingsRoutes)
  await app.register(paperRoutes)
  await app.register(serviceRoutes)
  await app.register(qaRoutes)

  // Register external API routes
  await app.register(externalPaperRoutes)
  await app.register(externalTagRoutes)

  // Start server
  const port = 3000
  await app.listen({ port, host: '127.0.0.1' })
  console.log(`Paperland server running on http://localhost:${port}`)
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
