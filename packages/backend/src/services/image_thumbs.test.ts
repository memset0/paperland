import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import Fastify from 'fastify'
import { resolve, join } from 'path'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { setDatabaseForTesting, schema } from '../db/index.js'
import { loadConfig, getConfig } from '../config.js'
import { storeImage } from './image_store.js'
import { imageThumb, resetImageThumbsForTesting, thumbDir } from './image_thumbs.js'
import { imageServingRoutes } from '../api/image_serving.js'

const TMP = resolve(import.meta.dir, '../../../../', '.image-thumb-test')
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const LOG = join(TMP, 'ffmpeg.log')

/** Fake ffmpeg: logs each run and writes a tiny "webp" to the last argument (or fails). */
function fakeFfmpeg(fail = false): string {
  const path = join(TMP, fail ? 'ffmpeg-fail' : 'ffmpeg')
  writeFileSync(path, `#!/bin/sh\necho run >> "${LOG}"\n${fail ? 'exit 1' : 'for last; do :; done\nprintf RIFFxxxxWEBP > "$last"'}\n`)
  chmodSync(path, 0o755)
  return path
}

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  loadConfig()
  getConfig().image_host.dir = join(TMP, 'store')
  getConfig().image_host.allowed_types = ['image/png']
  getConfig().image_host.ffmpeg_path = fakeFfmpeg()
  const db = drizzle(new Database(':memory:'), { schema })
  migrate(db, { migrationsFolder: resolve(import.meta.dir, '../db/migrations') })
  setDatabaseForTesting(db)
  resetImageThumbsForTesting()
})
afterAll(() => { if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true }) })

const runs = () => existsSync(LOG) ? readFileSync(LOG, 'utf8').trim().split('\n').length : 0

describe('image thumbnails', () => {
  it('generates once, caches on disk, and serves WebP with immutable caching', async () => {
    const { row } = storeImage(PNG_1x1)
    const app = Fastify(); app.register(imageServingRoutes)
    const [a, b] = await Promise.all([app.inject(`/image-thumb/${row.hash}.webp`), app.inject(`/image-thumb/${row.hash}.webp`)])
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)
    expect(a.headers['content-type']).toBe('image/webp')
    expect(a.headers['cache-control']).toContain('immutable')
    expect(a.body).toBe('RIFFxxxxWEBP')
    expect(runs()).toBe(1) // concurrent requests share one generation
    expect(existsSync(join(thumbDir(), `${row.hash}.webp`))).toBe(true)
    await app.inject(`/image-thumb/${row.hash}.webp`)
    expect(runs()).toBe(1) // served from the disk cache
  })

  it('redirects to the original when generation fails and 404s unknown or malformed names', async () => {
    getConfig().image_host.ffmpeg_path = fakeFfmpeg(true)
    const { row } = storeImage(PNG_1x1)
    const app = Fastify(); app.register(imageServingRoutes)
    const res = await app.inject(`/image-thumb/${row.hash}.webp`)
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe(`/image/${row.path}`)
    expect((await imageThumb('ffffff')).kind).toBe('missing')
    expect((await app.inject('/image-thumb/ffffff.webp')).statusCode).toBe(404)
    expect((await app.inject('/image-thumb/..%2Fx.webp')).statusCode).toBe(404)
    expect((await app.inject('/image-thumb/abc.png')).statusCode).toBe(404)
  })
})
