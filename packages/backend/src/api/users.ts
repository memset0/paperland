import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireAdmin } from '../auth/guards.js'
import type { UserRole } from '@paperland/shared'

function publicUser(u: { id: number; username: string; role: string; created_at: string }) {
  return { id: u.id, username: u.username, role: u.role as UserRole, created_at: u.created_at }
}

function countAdmins(db: ReturnType<typeof getDatabase>): number {
  return db.select().from(schema.users).where(eq(schema.users.role, 'admin')).all().length
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/users — list all users (admin only)
  app.get('/api/users', { preHandler: requireAdmin }, async () => {
    const db = getDatabase()
    const rows = db.select().from(schema.users).all()
    return { data: rows.map(publicUser) }
  })

  // POST /api/users — create a user (admin only)
  app.post<{ Body: { username?: string; password?: string; role?: UserRole } }>(
    '/api/users', { preHandler: requireAdmin }, async (request, reply) => {
      const db = getDatabase()
      const { username, password, role } = request.body || {}
      if (!username || !password) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'username and password are required' } })
      }
      const existing = db.select().from(schema.users).where(eq(schema.users.username, username)).get()
      if (existing) {
        return reply.code(409).send({ error: { code: 'USERNAME_CONFLICT', message: 'Username already taken' } })
      }
      const created = db.insert(schema.users).values({
        username,
        password_hash: Bun.password.hashSync(password),
        role: role === 'admin' ? 'admin' : 'user',
        created_at: new Date().toISOString(),
      }).returning().get()
      return reply.code(201).send({ data: publicUser(created) })
    }
  )

  // PATCH /api/users/:id — change role and/or reset password (admin only)
  app.patch<{ Params: { id: string }; Body: { role?: UserRole; password?: string } }>(
    '/api/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get()
      if (!user) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } })
      }
      const { role, password } = request.body || {}
      const updates: Record<string, unknown> = {}

      if (role !== undefined && role !== user.role) {
        // Protect the last admin from being demoted.
        if (user.role === 'admin' && role !== 'admin' && countAdmins(db) <= 1) {
          return reply.code(400).send({ error: { code: 'LAST_ADMIN', message: 'Cannot demote the last admin' } })
        }
        updates.role = role === 'admin' ? 'admin' : 'user'
      }

      if (password !== undefined) {
        if (!password) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Password cannot be empty' } })
        }
        updates.password_hash = Bun.password.hashSync(password)
      }

      if (Object.keys(updates).length === 0) {
        return { data: publicUser(user) }
      }
      db.update(schema.users).set(updates).where(eq(schema.users.id, id)).run()
      const updated = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!
      return { data: publicUser(updated) }
    }
  )

  // Note: user deletion is intentionally NOT supported.
}
