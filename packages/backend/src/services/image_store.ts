import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { eq } from 'drizzle-orm'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'

type ImageRow = typeof schema.images.$inferSelect

/** Thrown for client-correctable upload problems (bad/oversized/disallowed image) → HTTP 400. */
export class ImageValidationError extends Error {}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

/** Map a stored file extension back to a Content-Type for the public serving route. */
export function mimeForExt(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] || 'application/octet-stream'
}

/** Sniff the real MIME type from magic bytes (don't trust the client). Null if unrecognized. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif' // "GIF"
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** Best-effort image dimensions from header bytes; {null,null} when undetectable. */
function sniffDimensions(buf: Buffer, mime: string): { width: number | null; height: number | null } {
  try {
    if (mime === 'image/png' && buf.length >= 24) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    if (mime === 'image/gif' && buf.length >= 10) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
    }
    if (mime === 'image/jpeg') {
      let off = 2
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue }
        const marker = buf[off + 1]
        // SOF segments carry the frame dimensions (excluding DHT/DAC/DRI markers).
        const isSOF = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
          || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)
        if (isSOF) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) }
        }
        off += 2 + buf.readUInt16BE(off + 2)
      }
    }
    if (mime === 'image/webp' && buf.length >= 30) {
      const fmt = buf.toString('ascii', 12, 16)
      if (fmt === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
      }
      if (fmt === 'VP8L') {
        const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24]
        return {
          width: 1 + (((b1 & 0x3f) << 8) | b0),
          height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
        }
      }
      if (fmt === 'VP8X') {
        return {
          width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
          height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
        }
      }
    }
  } catch {
    // fall through to undetectable
  }
  return { width: null, height: null }
}

export interface StoreResult {
  row: ImageRow
  deduped: boolean
}

/**
 * Decode + validate + store an image, content-addressed by the SHA-256 of its bytes.
 * `input` may be a bare base64 string or a `data:` URL. Identical content dedupes to the
 * existing row/file/URL (preserving its original date path). Throws ImageValidationError
 * for bad/oversized/disallowed input.
 */
export function storeImage(
  input: string,
  opts: { originalName?: string | null; userId?: number | null } = {},
): StoreResult {
  const cfg = getConfig().image_host

  // Strip a data: URL prefix (e.g. "data:image/png;base64,") if present.
  const comma = input.indexOf(',')
  const base64 = input.startsWith('data:') && comma !== -1 ? input.slice(comma + 1) : input
  const buf = Buffer.from(base64, 'base64')
  if (buf.length === 0) throw new ImageValidationError('Empty or invalid image data')

  const maxBytes = cfg.max_size_mb * 1024 * 1024
  if (buf.length > maxBytes) {
    throw new ImageValidationError(`Image exceeds the maximum size of ${cfg.max_size_mb} MB`)
  }

  const mime = sniffMime(buf)
  if (!mime) throw new ImageValidationError('Unrecognized image format')
  if (!cfg.allowed_types.includes(mime)) {
    throw new ImageValidationError(`Image type ${mime} is not allowed`)
  }

  // Short content hash: first 6 hex chars of the SHA-256 (kept short for tidy URLs).
  // This is the file name + DB primary key + dedup key. At personal-tool scale the 24-bit
  // space is ample; an exact-content match still dedupes to the existing row below.
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 6)
  const db = getDatabase()

  const existing = db.select().from(schema.images).where(eq(schema.images.hash, hash)).get()
  if (existing) return { row: existing, deduped: true }

  const ext = MIME_EXT[mime] ?? 'bin'
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const relPath = `${yyyy}/${mm}/${dd}/${hash}.${ext}`
  const absPath = resolve(process.cwd(), cfg.dir, relPath)

  // Write the file (idempotent: skip if the content already exists on disk).
  if (!existsSync(absPath)) {
    mkdirSync(dirname(absPath), { recursive: true })
    writeFileSync(absPath, buf)
  }

  const { width, height } = sniffDimensions(buf, mime)
  try {
    const row = db.insert(schema.images).values({
      hash, ext, mime, size: buf.length, width, height,
      path: relPath, original_name: opts.originalName ?? null,
      uploaded_by: opts.userId ?? null, created_at: now.toISOString(),
    }).returning().get()
    return { row, deduped: false }
  } catch {
    // PK race: another writer inserted the same hash — return the winning row.
    const winner = db.select().from(schema.images).where(eq(schema.images.hash, hash)).get()
    if (winner) return { row: winner, deduped: true }
    throw new Error('Failed to persist image')
  }
}

/** Resolve a stored image's absolute path on disk from its relative `path` column. */
export function imageAbsPath(relPath: string): string {
  return resolve(process.cwd(), getConfig().image_host.dir, relPath)
}
