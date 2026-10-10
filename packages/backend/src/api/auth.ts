import type { FastifyInstance } from 'fastify'
import { eq, and, ne } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { createSession, destroySession, resetDevAdminCache, SESSION_COOKIE, SESSION_TTL_MS, toSessionUser } from '../auth/session_auth.js'
import { normalizeNickname } from '../auth/nickname.js'
import { requireUser } from '../auth/guards.js'
import { getOrCreateOpenToken, regenerateOpenToken } from '../auth/open_token.js'
import type { SessionUser } from '@paperland/shared'
import { getConfig } from '../config.js'

const USERNAME_MAX_LENGTH = 64

function registrationEnabled(): boolean {
  try { return getConfig().auth.registration_enabled } catch { return true }
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/login — public
  app.post<{ Body: { username?: string; password?: string } }>('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body || {}
    if (!username || !password) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'username and password are required' } })
    }
    const db = getDatabase()
    const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get()
    const ok = user ? await Bun.password.verify(password, user.password_hash) : false
    if (!user || !ok) {
      // Do not reveal whether the username or the password was wrong.
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' } })
    }
    // Only after the password checks out, so pending usernames aren't revealed to strangers.
    if (user.status !== 'active') {
      return reply.code(403).send({ error: { code: 'ACCOUNT_PENDING', message: 'Your account is awaiting admin approval' } })
    }
    const token = createSession(user.id)
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    })
    const sessionUser: SessionUser = toSessionUser(user)
    return { user: sessionUser }
  })

  // POST /api/auth/logout — requires login
  app.post('/api/auth/logout', { preHandler: requireUser }, async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE]
    if (token) destroySession(token)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { success: true }
  })

  // POST /api/auth/register — public self-registration. Creates a `pending` account (no session);
  // an admin approves it in Settings before it can log in. 403 when auth.registration_enabled is off.
  app.post<{ Body: { username?: string; password?: string; nickname?: string | null } }>('/api/auth/register', async (request, reply) => {
    if (!registrationEnabled()) {
      return reply.code(403).send({ error: { code: 'REGISTRATION_DISABLED', message: 'Registration is disabled' } })
    }
    const { password, nickname } = request.body || {}
    const username = typeof request.body?.username === 'string' ? request.body.username.trim() : ''
    if (!username || typeof password !== 'string' || !password) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'username and password are required' } })
    }
    if (username.length > USERNAME_MAX_LENGTH) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: `Username must be at most ${USERNAME_MAX_LENGTH} characters` } })
    }
    const normalized = normalizeNickname(nickname ?? null)
    if ('error' in normalized) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: normalized.error } })
    }
    const db = getDatabase()
    if (db.select().from(schema.users).where(eq(schema.users.username, username)).get()) {
      return reply.code(409).send({ error: { code: 'USERNAME_CONFLICT', message: 'Username already taken' } })
    }
    const created = db.insert(schema.users).values({
      username,
      nickname: normalized.value,
      password_hash: Bun.password.hashSync(password),
      role: 'user',
      status: 'pending',
      created_at: new Date().toISOString(),
    }).returning().get()
    return reply.code(201).send({ user: { id: created.id, username: created.username, nickname: created.nickname, status: created.status } })
  })

  // GET /api/auth/me — public, returns null user when anonymous (never 401)
  app.get('/api/auth/me', async (request) => {
    return { user: request.user ?? null, registration_enabled: registrationEnabled() }
  })

  // GET /api/auth/open-token — the current user's quick-open (CSRF) token for the
  // browser extension's `/open/arxiv/:id?token=…` link; generated on first request.
  app.get('/api/auth/open-token', { preHandler: requireUser }, async (request) => {
    return { token: getOrCreateOpenToken(request.user!.id) }
  })

  // POST /api/auth/open-token/regenerate — replace the token (old one stops working)
  app.post('/api/auth/open-token/regenerate', { preHandler: requireUser }, async (request) => {
    return { token: regenerateOpenToken(request.user!.id) }
  })

  // PATCH /api/auth/me — change own username, nickname, and/or password
  app.patch<{ Body: { username?: string; nickname?: string | null; current_password?: string; password?: string } }>(
    '/api/auth/me', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const me = request.user! // guaranteed by requireUser
      const { username, nickname, current_password, password } = request.body || {}
      const updates: Record<string, unknown> = {}

      if (nickname !== undefined) {
        const normalized = normalizeNickname(nickname)
        if ('error' in normalized) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: normalized.error } })
        }
        updates.nickname = normalized.value
      }

      if (username !== undefined && username !== me.username) {
        if (!username.trim()) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Username cannot be empty' } })
        }
        const conflict = db.select().from(schema.users)
          .where(and(eq(schema.users.username, username), ne(schema.users.id, me.id)))
          .get()
        if (conflict) {
          return reply.code(409).send({ error: { code: 'USERNAME_CONFLICT', message: 'Username already taken' } })
        }
        updates.username = username
      }

      if (password !== undefined) {
        const row = db.select().from(schema.users).where(eq(schema.users.id, me.id)).get()
        const ok = row ? await Bun.password.verify(current_password || '', row.password_hash) : false
        if (!ok) {
          return reply.code(403).send({ error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' } })
        }
        if (!password) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'New password cannot be empty' } })
        }
        updates.password_hash = Bun.password.hashSync(password)
      }

      if (Object.keys(updates).length === 0) {
        return { user: me }
      }
      db.update(schema.users).set(updates).where(eq(schema.users.id, me.id)).run()
      resetDevAdminCache()
      const updated = db.select().from(schema.users).where(eq(schema.users.id, me.id)).get()!
      return { user: toSessionUser(updated) }
    }
  )
}
