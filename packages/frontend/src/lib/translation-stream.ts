import type {
  TranslateResponse,
  TranslationStreamDelta,
  TranslationStreamError,
  TranslationStreamStart,
} from '@paperland/shared'
import { consumeNamedEventStream } from './named-event-stream'

export interface TranslationStreamCallbacks {
  onStart?: (start: TranslationStreamStart) => void | Promise<void>
  onDelta?: (delta: string) => void | Promise<void>
}

export async function consumeTranslationStream(
  body: ReadableStream<Uint8Array>,
  callbacks: TranslationStreamCallbacks = {},
): Promise<TranslateResponse> {
  let completed: TranslateResponse | null = null

  const consume = async (event: { event: string; data: string }) => {
    let payload: any
    try {
      payload = JSON.parse(event.data)
    } catch {
      throw new Error(`Invalid translation stream event: ${event.event}`)
    }
    if (event.event === 'start') {
      await callbacks.onStart?.(payload as TranslationStreamStart)
    } else if (event.event === 'delta') {
      const delta = (payload as TranslationStreamDelta).delta
      if (typeof delta === 'string' && delta.length > 0) await callbacks.onDelta?.(delta)
    } else if (event.event === 'done') {
      completed = payload as TranslateResponse
    } else if (event.event === 'error') {
      const streamError = payload as TranslationStreamError
      const error = new Error(streamError.error?.message || 'Translation failed')
      ;(error as Error & { code?: string }).code = streamError.error?.code
      throw error
    }
  }

  await consumeNamedEventStream(body, consume)
  if (!completed) throw new Error('Translation stream ended before done')
  return completed
}
