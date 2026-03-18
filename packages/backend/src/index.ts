import Fastify from 'fastify'
import cors from '@fastify/cors'
import { loadConfig } from './config.js'
import { initDatabase } from './db/index.js'
import { basicAuth } from './auth/basic_auth.js'
import { tokenAuth } from './auth/token_auth.js'
import { settingsRoutes } from './api/settings.js'
import { paperRoutes } from './api/papers.js'
import { startBackupScheduler } from './db/backup.js'

async function main() {
  // Load config
  loadConfig()

  // Initialize database
  initDatabase()

  // Start backup scheduler
  startBackupScheduler()

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

  // Register routes
  await app.register(settingsRoutes)
  await app.register(paperRoutes)

  // Start server
  const port = 3000
  await app.listen({ port, host: '127.0.0.1' })
  console.log(`Paperland server running on http://localhost:${port}`)
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
