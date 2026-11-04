import type { FastifyInstance, FastifyReply } from 'fastify'
import { ImageValidationError, maxMediaBytes, mediaUploadResult, storeImageBytes } from '../services/image_store.js'
import { fetchRemoteMedia, RemoteFetchError, RemoteUrlNotAllowedError } from '../services/remote_media.js'

/** Map upload / download errors to HTTP; returns false for errors the caller should rethrow. */
export function sendMediaError(reply: FastifyReply, err: unknown): boolean {
  if (err instanceof RemoteUrlNotAllowedError) {
    reply.code(422).send({ error: { code: 'URL_NOT_ALLOWED', message: err.message } })
  } else if (err instanceof RemoteFetchError) {
    reply.code(422).send({ error: { code: 'DOWNLOAD_FAILED', message: err.message } })
  } else if (err instanceof ImageValidationError) {
    reply.code(400).send({ error: { code: 'INVALID_MEDIA', message: err.message } })
  } else {
    return false
  }
  return true
}

/**
 * POST /external-api/v1/images — upload for external agents without base64: the raw file as the
 * body (`--data-binary @file`, any image/video or octet-stream Content-Type), or `?url=` to have
 * the server download it. Same validation, dedup and ownership as POST /api/images.
 */
export async function externalImageRoutes(app: FastifyInstance): Promise<void> {
  const bodyLimit = maxMediaBytes() + 1024 * 1024
  // Scoped to this plugin: raw bodies for media types only.
  app.addContentTypeParser(['application/octet-stream', /^image\//, /^video\//], { parseAs: 'buffer', bodyLimit },
    (_req, body, done) => done(null, body))

  app.post<{ Querystring: { url?: string; filename?: string; alt?: string } }>(
    '/external-api/v1/images', { bodyLimit }, async (request, reply) => {
      const userId = request.user?.id
      if (userId == null) {
        reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token has no associated user' } })
        return
      }
      const { url, filename, alt } = request.query
      const body = request.body
      try {
        let buf: Buffer
        let name = filename ?? null
        if (url) {
          if (Buffer.isBuffer(body) && body.length > 0) {
            reply.code(400).send({ error: { code: 'INVALID_REQUEST', message: 'Send either a file body or ?url=, not both' } })
            return
          }
          const remote = await fetchRemoteMedia(url)
          buf = remote.buf
          name = name ?? remote.filename
        } else if (Buffer.isBuffer(body) && body.length > 0) {
          buf = body
        } else {
          reply.code(400).send({ error: { code: 'INVALID_REQUEST', message: 'Send the file as the request body (image/*, video/* or application/octet-stream) or pass ?url=' } })
          return
        }
        const stored = storeImageBytes(buf, { originalName: name, userId })
        reply.code(stored.deduped ? 200 : 201)
        return mediaUploadResult(stored, alt ?? '')
      } catch (err) {
        if (sendMediaError(reply, err)) return
        throw err
      }
    },
  )
}
