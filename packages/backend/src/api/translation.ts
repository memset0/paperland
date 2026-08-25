import type { FastifyInstance } from 'fastify'
import { once } from 'events'
import { requireUser } from '../auth/guards.js'
import { translateText, getCachedTranslation, peekTranslation } from '../services/translation_service.js'

function responseBody(t: Awaited<ReturnType<typeof translateText>>) {
  return {
    source_hash: t.source_hash,
    source_text: t.source_text,
    translated_text: t.translated_text,
    source_lang: t.source_lang,
    target_lang: t.target_lang,
    model_name: t.model_name,
    cached: t.cached,
  }
}

function streamError(error: unknown): { error: { code: string; message: string } } {
  const err = error instanceof Error ? error : new Error(String(error))
  const code = err.name === 'AbortError'
    ? 'TRANSLATION_CANCELLED'
    : /timed out/i.test(err.message)
      ? 'TRANSLATION_TIMEOUT'
      : 'TRANSLATION_FAILED'
  return { error: { code, message: err.message } }
}

export async function translationRoutes(app: FastifyInstance): Promise<void> {
  // Translate a piece of text (English→Chinese), cache-first. `force: true` bypasses the cache and
  // overwrites the stored result (re-translate). `cache_only: true` is a peek — return the cached
  // translation if any (cached:true) or `translated_text:null` (cached:false) WITHOUT calling the AI
  // model and WITHOUT a 404, so the frontend can decide whether to auto-expand. Login required; the
  // cache itself is shared by all users.
  app.post<{ Body: { text?: string; force?: boolean; cache_only?: boolean } }>(
    '/api/translate',
    { preHandler: requireUser },
    async (request, reply) => {
      const text = typeof request.body?.text === 'string' ? request.body.text : ''
      if (!text.trim()) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'text is required' } })
      }

      if (request.body?.cache_only) {
        const row = peekTranslation(text)
        return {
          source_hash: row?.source_hash ?? null,
          source_text: row?.source_text ?? null,
          translated_text: row?.translated_text ?? null,
          source_lang: row?.source_lang ?? 'en',
          target_lang: row?.target_lang ?? 'zh',
          model_name: row?.model_name ?? null,
          cached: !!row,
        }
      }

      const t = await translateText(text, { force: !!request.body?.force })
      return responseBody(t)
    }
  )

  app.post<{ Body: { text?: string; force?: boolean } }>(
    '/api/translate/stream',
    { preHandler: requireUser },
    async (request, reply) => {
      const text = typeof request.body?.text === 'string' ? request.body.text : ''
      if (!text.trim()) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'text is required' } })
      }

      const raw = reply.raw
      raw.statusCode = 200
      raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      raw.setHeader('Cache-Control', 'no-cache, no-transform')
      raw.setHeader('Connection', 'keep-alive')
      raw.setHeader('X-Accel-Buffering', 'no')
      reply.hijack()

      const controller = new AbortController()
      let terminal = false
      const abort = () => {
        if (!terminal) controller.abort()
      }
      request.raw.once('aborted', abort)
      raw.once('close', abort)

      const writeEvent = async (event: string, data: unknown) => {
        if (raw.destroyed || raw.writableEnded) {
          const error = new Error('Translation client disconnected')
          error.name = 'AbortError'
          throw error
        }
        if (!raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) {
          await once(raw, 'drain')
        }
      }

      const heartbeat = setInterval(() => {
        if (!terminal && !raw.destroyed && !raw.writableEnded) raw.write(': heartbeat\n\n')
      }, 15_000)
      heartbeat.unref?.()

      try {
        const result = await translateText(text, {
          force: !!request.body?.force,
          signal: controller.signal,
          onStart: (start) => writeEvent('start', start),
          onChunk: (delta) => writeEvent('delta', { delta }),
        })
        await writeEvent('done', responseBody(result))
        terminal = true
      } catch (error) {
        if (!raw.destroyed && !raw.writableEnded) {
          try {
            await writeEvent('error', streamError(error))
            terminal = true
          } catch {
            // The client disconnected before the terminal event could be written.
          }
        }
      } finally {
        clearInterval(heartbeat)
        request.raw.removeListener('aborted', abort)
        raw.removeListener('close', abort)
        if (!raw.destroyed && !raw.writableEnded) raw.end()
      }
    },
  )

  // Look up a cached translation by source hash, without calling the AI model. 404 when absent.
  app.get<{ Params: { hash: string }; Querystring: { target_lang?: string } }>(
    '/api/translations/:hash',
    { preHandler: requireUser },
    async (request, reply) => {
      const targetLang = request.query.target_lang || 'zh'
      const row = getCachedTranslation(request.params.hash, targetLang)
      if (!row) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'No cached translation' } })
      }
      return { data: row }
    }
  )
}
