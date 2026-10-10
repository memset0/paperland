import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { existsSync, readFileSync } from 'fs'
import { resolve, sep } from 'path'
import { loadConfig, getConfig } from './config.js'
import { initDatabase } from './db/index.js'
import { authRoutes } from './api/auth.js'
import { sharingRoutes } from './api/sharing.js'
import { userRoutes } from './api/users.js'
import { settingsRoutes } from './api/settings.js'
import { paperRoutes } from './api/papers.js'
import { serviceRoutes } from './api/services.js'
import { qaRoutes } from './api/qa.js'
import { translationRoutes } from './api/translation.js'
import { doc2xRoutes } from './api/doc2x.js'
import { highlightsRoutes } from './api/highlights.js'
import { notesRoutes } from './api/notes.js'
import { referenceLinksRoutes } from './api/reference_links.js'
import { imagesRoutes } from './api/images.js'
import { extensionRoutes } from './api/extension.js'
import { mimeForExt } from './services/image_store.js'
import { tagRoutes } from './api/tags.js'
import { externalPaperRoutes } from './external-api/papers.js'
import { externalTagRoutes } from './external-api/tags.js'
import { startBackupScheduler } from './db/backup.js'
import { identityHook } from './auth/identity_hook.js'
import { fileRoutes } from './api/files.js'
import { getDatabase, schema } from './db/index.js'
import { inArray } from 'drizzle-orm'
import { serviceRunner } from './services/service_runner.js'
import { seedStarterPaper } from './services/user_library.js'
import { recoverInterruptedQAResults } from './services/qa_runtime.js'
import { arxivMetadataService, arxivPdfService } from './services/arxiv_service.js'
import { s2PdfService } from './services/s2_pdf_service.js'
import { semanticScholarService } from './services/semantic_scholar_service.js'
import { pdfParseService } from './services/pdf_parse_service.js'
import { doc2xParseService } from './services/doc2x_parse_service.js'
import { doc2xTranslateService } from './services/doc2x_translate_service.js'
import { papersCoolService } from './services/papers_cool_service.js'
import { s2Routes } from './api/s2.js'
import { researchRoutes } from './api/research.js'
import { mcpRoutes } from './api/mcp.js'
import { tokenRoutes } from './api/tokens.js'
import { recoverInterruptedResearchSteps } from './services/research_runtime.js'
import { registerFrontendHosting } from './frontend_hosting.js'

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
    const recoveredQA = recoverInterruptedQAResults(db, now)
    const recoveredResearch = recoverInterruptedResearchSteps(db, now)
    console.log(`Cleaned up stale service executions, ${recoveredQA.resultCount} QA results and ${recoveredResearch} research steps`)
  }

  // Start backup scheduler
  startBackupScheduler()

  // Initialize service runner
  serviceRunner.initialize()
  serviceRunner.register(arxivMetadataService)
  serviceRunner.register(arxivPdfService)
  serviceRunner.register(semanticScholarService)
  serviceRunner.register(s2PdfService)
  serviceRunner.register(pdfParseService)
  serviceRunner.register(papersCoolService)
  serviceRunner.register(doc2xParseService)
  serviceRunner.register(doc2xTranslateService)
  serviceRunner.register({ name: 'qa', type: 'pure', execute: async () => {} })

  // Empty database → ingest the starter paper into every user's library (personal paper library).
  seedStarterPaper()
    .then((id) => { if (id != null) console.log(`Seeded starter paper ${id}`) })
    .catch((err) => console.error('Failed to seed starter paper:', err))

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

  // Identity resolution + login wall (see auth/identity_hook.ts); admin checks stay per route.
  app.addHook('onRequest', identityHook)

  await app.register(fileRoutes)

  // Public image host serving — NO auth by design (any holder of the link can view).
  // Lives outside /api/* so the identity hook leaves it open. Content-addressed files are
  // immutable, so they can be cached aggressively.
  app.get<{ Params: { '*': string } }>('/image/*', async (request, reply) => {
    const baseDir = resolve(process.cwd(), getConfig().image_host.dir)
    const rel = decodeURIComponent(request.params['*'] || '')
    const filePath = resolve(baseDir, rel)
    // Path-traversal guard: the resolved path must stay inside the storage dir.
    if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
      reply.code(400).send({ error: 'Invalid path' })
      return
    }
    if (!existsSync(filePath)) {
      reply.code(404).send({ error: 'Image not found' })
      return
    }
    const buffer = readFileSync(filePath)
    reply.header('Content-Type', mimeForExt(filePath.split('.').pop() || ''))
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')
    return reply.send(buffer)
  })

  // Register routes
  await app.register(authRoutes)
  await app.register(sharingRoutes)
  await app.register(userRoutes)
  await app.register(settingsRoutes)
  await app.register(tokenRoutes)
  await app.register(paperRoutes)
  await app.register(serviceRoutes)
  await app.register(qaRoutes)
  await app.register(translationRoutes)
  await app.register(doc2xRoutes)
  await app.register(highlightsRoutes)
  await app.register(notesRoutes)
  await app.register(referenceLinksRoutes)
  await app.register(imagesRoutes)
  await app.register(extensionRoutes)
  await app.register(tagRoutes)

  await app.register(s2Routes)
  await app.register(researchRoutes)
  // Agent tools MCP server (bearer-token auth, outside /api and the login wall)
  await app.register(mcpRoutes)

  // Register external API routes
  await app.register(externalPaperRoutes)
  await app.register(externalTagRoutes)

  // Production frontend shares the API entry point; Vite remains the dev server.
  const frontendMounted = await registerFrontendHosting(app)
  app.log.info({ frontend_mounted: frontendMounted }, 'Frontend build hosting')

  // Start server
  const port = 3000
  await app.listen({ port, host: '127.0.0.1' })
  console.log(`Paperland server running on http://localhost:${port}`)
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
