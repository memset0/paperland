import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'
import { localProcess } from './local_process.js'
import { Semaphore } from './semaphore.js'
import { imageAbsPath, isVideoMime } from './image_store.js'

const THUMB_TIMEOUT_MS = 15_000
const THUMB_MAX_BYTES = 8 * 1024 * 1024
let limiter: Semaphore | undefined, limiterSize = 0
const inflight = new Map<string, Promise<string | null>>()

export type ThumbResult = { kind: 'thumb'; path: string } | { kind: 'original'; path: string } | { kind: 'missing' }

export function thumbDir(): string {
  return join(resolve(process.cwd(), getConfig().image_host.dir), '.thumbs')
}

function thumbLimiter(): Semaphore {
  const n = getConfig().image_host.thumb_concurrency
  if (!limiter || limiterSize !== n) { limiter = new Semaphore(n); limiterSize = n }
  return limiter
}

/** Test hook: forget the semaphore so a changed config takes effect. */
export function resetImageThumbsForTesting(): void { limiter = undefined; inflight.clear() }

async function render(src: string, out: string, video: boolean): Promise<void> {
  const cfg = getConfig().image_host, size = cfg.thumb_size
  const scale = `scale='min(${size},iw)':'min(${size},ih)':force_original_aspect_ratio=decrease`
  const args = (seek: boolean) => ['-hide_banner', '-loglevel', 'error', '-y', ...(seek ? ['-ss', '0.5'] : []), '-i', src, '-frames:v', '1', '-vf', scale, '-c:v', 'libwebp', '-quality', '75', '-f', 'webp', out]
  try {
    await localProcess(cfg.ffmpeg_path, args(video), { timeout_ms: THUMB_TIMEOUT_MS, max_bytes: THUMB_MAX_BYTES })
    if (!existsSync(out)) throw new Error('no output')
  } catch (error) {
    if (!video) throw error
    // Very short videos have no frame at 0.5 s: retry with the first frame.
    await localProcess(cfg.ffmpeg_path, args(false), { timeout_ms: THUMB_TIMEOUT_MS, max_bytes: THUMB_MAX_BYTES })
    if (!existsSync(out)) throw new Error('no output')
  }
}

async function generate(hash: string, src: string, video: boolean): Promise<string | null> {
  const dir = thumbDir(), final = join(dir, `${hash}.webp`)
  if (existsSync(final)) return final
  const semaphore = thumbLimiter()
  await semaphore.acquire(AbortSignal.timeout(THUMB_TIMEOUT_MS * 4))
  const tmp = join(dir, `.${hash}.${randomBytes(4).toString('hex')}.webp`)
  try {
    if (existsSync(final)) return final
    mkdirSync(dir, { recursive: true })
    await render(src, tmp, video)
    renameSync(tmp, final) // atomic: readers never see a partial file
    return final
  } catch {
    return null
  } finally {
    semaphore.release()
    try { rmSync(tmp, { force: true }) } catch {}
  }
}

/**
 * Resolve the grid thumbnail for a stored image/video hash: the cached WebP (generated on first
 * request with ffmpeg, bounded by a semaphore and timeout), the original file when generation fails,
 * or `missing` for an unknown hash.
 */
export async function imageThumb(hash: string): Promise<ThumbResult> {
  const row = getDatabase().select().from(schema.images).where(eq(schema.images.hash, hash)).get()
  if (!row) return { kind: 'missing' }
  const cached = join(thumbDir(), `${hash}.webp`)
  if (existsSync(cached)) return { kind: 'thumb', path: cached }
  const src = imageAbsPath(row.path)
  if (!existsSync(src)) return { kind: 'missing' }
  let job = inflight.get(hash)
  if (!job) {
    job = generate(hash, src, isVideoMime(row.mime)).finally(() => inflight.delete(hash))
    inflight.set(hash, job)
  }
  const path = await job
  return path ? { kind: 'thumb', path } : { kind: 'original', path: row.path }
}
