import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { loadConfig, getConfig } from './config.js'
import { initDatabase } from './db/index.js'
import { tokenAuth } from './auth/token_auth.js'
import { resolveSessionUser, getDevAdmin } from './auth/session_auth.js'
import { authRoutes } from './api/auth.js'
import { userRoutes } from './api/users.js'
import { settingsRoutes } from './api/settings.js'
import { paperRoutes } from './api/papers.js'
import { serviceRoutes } from './api/services.js'
import { qaRoutes } from './api/qa.js'
import { highlightsRoutes } from './api/highlights.js'
import { notesRoutes } from './api/notes.js'
import { tagRoutes } from './api/tags.js'
import { externalPaperRoutes } from './external-api/papers.js'
import { externalTagRoutes } from './external-api/tags.js'
import { startBackupScheduler } from './db/backup.js'
import { getDatabase, schema } from './db/index.js'
import { inArray } from 'drizzle-orm'
import { serviceRunner } from './services/service_runner.js'
import { arxivMetadataService, arxivPdfService } from './services/arxiv_service.js'
import { semanticScholarService } from './services/semantic_scholar_service.js'
import { pdfParseService } from './services/pdf_parse_service.js'
import { papersCoolService } from './services/papers_cool_service.js'
import { ideaForgeRoutes } from './api/idea-forge.js'
import { conferenceRoutes } from './api/conferences.js'
import { ensureIdeaForgeRoot } from './idea-forge/utils.js'

async function main() {
  // Load config
  const config = loadConfig()

  if (!config.auth.enabled) {
    console.warn('WARNING: Auth is disabled (dev bypass) — all /api routes are accessible as admin')
  }

  // Initialize database
  initDatabase()

  // Clean up stale executions from previous runs
  {
    const db = getDatabase()
    const now = new Date().toISOString()
    const staleStatuses = ['pending', 'running']
    db.update(schema.serviceExecutions)
      .set({ status: 'failed', error: 'interrupted by server restart', finished_at: now })
      .where(inArray(schema.serviceExecutions.status, staleStatuses))
      .run()
    db.update(schema.qaEntries)
      .set({ status: 'failed', error: 'interrupted by server restart' })
      .where(inArray(schema.qaEntries.status, staleStatuses))
      .run()
    console.log('Cleaned up stale service executions and QA entries')
  }

  // Ensure idea-forge directory exists
  ensureIdeaForgeRoot()

  // Start backup scheduler
  startBackupScheduler()

  // Initialize service runner
  serviceRunner.initialize()
  serviceRunner.register(arxivMetadataService)
  serviceRunner.register(arxivPdfService)
  serviceRunner.register(semanticScholarService)
  serviceRunner.register(pdfParseService)
  serviceRunner.register(papersCoolService)
  serviceRunner.register({ name: 'qa', type: 'pure', execute: async () => {} })

  // Create Fastify instance
  const app = Fastify({ logger: true })

  // CORS
  await app.register(cors, { origin: true, credentials: true })
  // Cookie support (session login)
  await app.register(cookie)

  // Health check (no auth)
  app.get('/api/health', async () => ({ status: 'ok' }))

  // External API health check (requires token auth — validates both connectivity and token)
  app.get('/external-api/v1/health', async () => ({ status: 'ok' }))

  // Identity resolution hook. Authorization is enforced per-route via
  // requireUser / requireAdmin preHandlers; this hook only attaches request.user.
  app.addHook('onRequest', async (request, reply) => {
    // Health check is always public
    if (request.url === '/api/health') return

    // External API uses Bearer token auth (resolves the token's owning user)
    if (request.url.startsWith('/external-api/')) {
      await tokenAuth(request, reply)
      return
    }

    // Website API: when auth is enabled, resolve the session user (may be null);
    // when disabled (dev bypass), act as the admin user.
    if (request.url.startsWith('/api/')) {
      request.user = getConfig().auth.enabled ? resolveSessionUser(request) : getDevAdmin()
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
  await app.register(authRoutes)
  await app.register(userRoutes)
  await app.register(settingsRoutes)
  await app.register(paperRoutes)
  await app.register(serviceRoutes)
  await app.register(qaRoutes)
  await app.register(highlightsRoutes)
  await app.register(notesRoutes)
  await app.register(tagRoutes)

  // Register idea-forge routes
  await app.register(ideaForgeRoutes)

  // Register conferences routes
  await app.register(conferenceRoutes)

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
