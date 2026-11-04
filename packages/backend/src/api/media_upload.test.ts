import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import Fastify, { type FastifyInstance } from 'fastify'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, join } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { setDatabaseForTesting, schema } from '../db/index.js'
import { loadConfig, getConfig } from '../config.js'
import { sniffMime, storeImageBytes, ImageValidationError } from '../services/image_store.js'
import { fetchRemoteMedia, isPrivateAddress, RemoteFetchError, RemoteUrlNotAllowedError } from '../services/remote_media.js'
import { imageServingRoutes, parseRange } from './image_serving.js'
import { externalImageRoutes } from '../external-api/images.js'
import { callAgentTool } from '../services/agent_tools.js'

// Offline: no network — remote downloads use injected fetch/resolver, or are refused before fetching.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
/** Minimal ISO BMFF header: size, 'ftyp', brand. */
function mp4(brand = 'isom', size = 64): Buffer {
  const b = Buffer.alloc(size)
  b.writeUInt32BE(24, 0); b.write('ftyp', 4, 'ascii'); b.write(brand, 8, 'ascii')
  return b
}
function ebml(docType: string): Buffer {
  return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84]), Buffer.from(docType), Buffer.alloc(32)])
}

const TMP_DIR = resolve(import.meta.dir, '../../../../', '.media-test-store')
let db: ReturnType<typeof drizzle>

beforeEach(() => {
  loadConfig()
  const cfg = getConfig().image_host
  cfg.dir = TMP_DIR
  cfg.max_size_mb = 1
  cfg.max_video_size_mb = 2
  cfg.allowed_types = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true })
  db = drizzle(new Database(':memory:'), { schema })
  migrate(db, { migrationsFolder: resolve(import.meta.dir, '../db/migrations') })
  setDatabaseForTesting(db)
})

afterAll(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('video sniffing and limits', () => {
  it('recognizes mp4 and webm, not QuickTime or plain Matroska', () => {
    expect(sniffMime(mp4('isom'))).toBe('video/mp4')
    expect(sniffMime(mp4('mp42'))).toBe('video/mp4')
    expect(sniffMime(mp4('qt  '))).toBeNull()
    expect(sniffMime(ebml('webm'))).toBe('video/webm')
    expect(sniffMime(ebml('matroska'))).toBeNull()
    expect(sniffMime(PNG)).toBe('image/png')
  })

  it('stores videos under the video limit and images under the image limit', () => {
    const { row } = storeImageBytes(mp4('isom', 1.5 * 1024 * 1024), { userId: 1 })
    expect(row).toMatchObject({ mime: 'video/mp4', ext: 'mp4', width: null, height: null })
    expect(row.path).toMatch(/\.mp4$/)
    expect(() => storeImageBytes(mp4('isom', 3 * 1024 * 1024))).toThrow(/Video exceeds the maximum size of 2 MB/)
    const bigPng = Buffer.concat([PNG, Buffer.alloc(1.5 * 1024 * 1024)])
    expect(() => storeImageBytes(bigPng)).toThrow(/Image exceeds the maximum size of 1 MB/)
  })

  it('rejects videos when they are not in allowed_types', () => {
    getConfig().image_host.allowed_types = ['image/png']
    expect(() => storeImageBytes(mp4())).toThrow(ImageValidationError)
  })
})

describe('Range serving', () => {
  it('parses single ranges', () => {
    expect(parseRange(undefined, 100)).toBeNull()
    expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 })
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 })
    expect(parseRange('bytes=-5', 100)).toEqual({ start: 95, end: 99 })
    expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 })
    expect(parseRange('bytes=100-', 100)).toBe('invalid')
    expect(parseRange('bytes=0-1,5-6', 100)).toBeNull()
  })

  it('serves 200 with Accept-Ranges, 206 slices, and 416', async () => {
    const app = Fastify()
    await app.register(imageServingRoutes)
    mkdirSync(join(TMP_DIR, '2026/10/16'), { recursive: true })
    const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i))
    writeFileSync(join(TMP_DIR, '2026/10/16/abc123.mp4'), bytes)

    const full = await app.inject({ method: 'GET', url: '/image/2026/10/16/abc123.mp4' })
    expect(full.statusCode).toBe(200)
    expect(full.headers['accept-ranges']).toBe('bytes')
    expect(full.headers['content-type']).toBe('video/mp4')
    expect(full.rawPayload.length).toBe(256)

    const part = await app.inject({ method: 'GET', url: '/image/2026/10/16/abc123.mp4', headers: { range: 'bytes=10-19' } })
    expect(part.statusCode).toBe(206)
    expect(part.headers['content-range']).toBe('bytes 10-19/256')
    expect([...part.rawPayload]).toEqual(Array.from({ length: 10 }, (_, i) => i + 10))

    const bad = await app.inject({ method: 'GET', url: '/image/2026/10/16/abc123.mp4', headers: { range: 'bytes=300-' } })
    expect(bad.statusCode).toBe(416)
    expect((await app.inject({ method: 'GET', url: '/image/2026/10/16/none.mp4' })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: '/image/..%2F..%2Fetc%2Fpasswd' })).statusCode).toBeGreaterThanOrEqual(400)
  })
})

describe('remote media download', () => {
  const publicDns = async () => ['93.184.216.34']
  const ok = (body: Buffer, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers })

  it('classifies private addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true)
    }
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false)
  })

  it('refuses non-http schemes, private literals, and hosts resolving to private addresses without fetching', async () => {
    let calls = 0
    const fetchFn = (async () => { calls++; return ok(PNG) }) as any
    await expect(fetchRemoteMedia('file:///etc/passwd', { fetchFn, resolve: publicDns })).rejects.toBeInstanceOf(RemoteUrlNotAllowedError)
    await expect(fetchRemoteMedia('http://127.0.0.1:3000/api/health', { fetchFn, resolve: publicDns })).rejects.toBeInstanceOf(RemoteUrlNotAllowedError)
    await expect(fetchRemoteMedia('http://[::1]/x.png', { fetchFn, resolve: publicDns })).rejects.toBeInstanceOf(RemoteUrlNotAllowedError)
    await expect(fetchRemoteMedia('https://internal.example/x.png', { fetchFn, resolve: async () => ['10.0.0.5'] })).rejects.toBeInstanceOf(RemoteUrlNotAllowedError)
    expect(calls).toBe(0)
  })

  it('rechecks every redirect hop', async () => {
    const fetchFn = (async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } })) as any
    await expect(fetchRemoteMedia('https://cdn.example/x.png', { fetchFn, resolve: publicDns })).rejects.toBeInstanceOf(RemoteUrlNotAllowedError)
  })

  it('follows a public redirect, returns the bytes and file name, and enforces the size cap', async () => {
    const fetchFn = (async (url: URL) => url.pathname === '/old'
      ? new Response(null, { status: 301, headers: { location: '/media/clip%20one.mp4' } })
      : ok(mp4())) as any
    const got = await fetchRemoteMedia('https://cdn.example/old', { fetchFn, resolve: publicDns })
    expect(sniffMime(got.buf)).toBe('video/mp4')
    expect(got.filename).toBe('clip one.mp4')

    const huge = (async () => ok(Buffer.alloc(3 * 1024 * 1024))) as any
    await expect(fetchRemoteMedia('https://cdn.example/big.mp4', { fetchFn: huge, resolve: publicDns })).rejects.toBeInstanceOf(RemoteFetchError)
    const declared = (async () => ok(Buffer.alloc(10), { 'content-length': String(50 * 1024 * 1024) })) as any
    await expect(fetchRemoteMedia('https://cdn.example/big.mp4', { fetchFn: declared, resolve: publicDns })).rejects.toThrow(/exceeds/)
    const missing = (async () => new Response('nope', { status: 404 })) as any
    await expect(fetchRemoteMedia('https://cdn.example/x.png', { fetchFn: missing, resolve: publicDns })).rejects.toThrow(/HTTP 404/)
  })
})

describe('POST /external-api/v1/images', () => {
  let app: FastifyInstance
  let user: any = null
  beforeEach(async () => {
    const now = new Date().toISOString()
    const u = db.insert(schema.users).values({ username: 'agent-owner', password_hash: 'x', role: 'user', created_at: now }).returning().get()
    user = { id: u.id, username: u.username, role: 'user' }
    app = Fastify()
    app.addHook('onRequest', async (request) => { ;(request as any).user = user })
    await app.register(externalImageRoutes)
  })

  it('stores a raw PNG body for the token user and returns Markdown', async () => {
    const res = await app.inject({ method: 'POST', url: '/external-api/v1/images?filename=fig2.png&alt=Figure%202', headers: { 'content-type': 'image/png' }, payload: PNG })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toMatchObject({ mime: 'image/png', kind: 'image', width: 1, height: 1, deduped: false })
    expect(body.markdown).toBe(`![Figure 2](${body.url})`)
    expect(db.select().from(schema.images).get()).toMatchObject({ uploaded_by: user.id, original_name: 'fig2.png' })
    const again = await app.inject({ method: 'POST', url: '/external-api/v1/images', headers: { 'content-type': 'application/octet-stream' }, payload: PNG })
    expect(again.statusCode).toBe(200)
    expect(again.json().deduped).toBe(true)
  })

  it('accepts a raw video body', async () => {
    const res = await app.inject({ method: 'POST', url: '/external-api/v1/images', headers: { 'content-type': 'video/mp4' }, payload: mp4() })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ kind: 'video', mime: 'video/mp4' })
  })

  it('rejects bad input, private URLs and missing users', async () => {
    expect((await app.inject({ method: 'POST', url: '/external-api/v1/images' })).statusCode).toBe(400)
    const bad = await app.inject({ method: 'POST', url: '/external-api/v1/images', headers: { 'content-type': 'application/octet-stream' }, payload: Buffer.from('not media') })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().error.code).toBe('INVALID_MEDIA')
    const priv = await app.inject({ method: 'POST', url: '/external-api/v1/images?url=' + encodeURIComponent('http://127.0.0.1:3000/api/health') })
    expect(priv.statusCode).toBe(422)
    expect(priv.json().error.code).toBe('URL_NOT_ALLOWED')
    user = null
    expect((await app.inject({ method: 'POST', url: '/external-api/v1/images', headers: { 'content-type': 'image/png' }, payload: PNG })).statusCode).toBe(401)
    expect(db.select().from(schema.images).all()).toHaveLength(0)
  })
})

describe('MCP get_skill and upload_image url', () => {
  const viewer = { id: 1, role: 'user' as const }

  it('lists bundled skills and returns one by name', async () => {
    const list = await callAgentTool('get_skill', {}, { viewer } as any)
    expect(list.isError).toBe(false)
    const names = JSON.parse(list.text).skills.map((s: any) => s.name)
    expect(names).toContain('blog-import')
    expect(names).toContain('s2-literature-search')
    const one = JSON.parse((await callAgentTool('get_skill', { name: 'blog-import' }, { viewer } as any)).text)
    expect(one.text).toContain('external-api/v1/images')
    expect((await callAgentTool('get_skill', { name: '../secrets' }, { viewer } as any)).isError).toBe(true)
    expect((await callAgentTool('get_skill', { name: 'nope' }, { viewer } as any)).isError).toBe(true)
  })

  it('upload_image refuses private URLs and requires exactly one source', async () => {
    const priv = await callAgentTool('upload_image', { url: 'http://10.0.0.1/x.png' }, { viewer, token_kind: 'personal' } as any)
    expect(priv.isError).toBe(true)
    expect(priv.text).toMatch(/private or local/)
    expect((await callAgentTool('upload_image', { url: 'https://a.example/x.png', data: 'AA==' }, { viewer, token_kind: 'personal' } as any)).isError).toBe(true)
  })
})
