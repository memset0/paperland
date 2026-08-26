import type {
  QAResult,
  QAResultStreamDelta,
  QAResultStreamStart,
  QAResultStreamTerminal,
} from '@paperland/shared'
import { consumeNamedEventStream } from './named-event-stream'

export interface QAResultStreamCallbacks {
  onStart?: (start: QAResultStreamStart) => void | Promise<void>
  onDelta?: (delta: QAResultStreamDelta) => void | Promise<void>
}

export async function consumeQAResultStream(
  body: ReadableStream<Uint8Array>,
  callbacks: QAResultStreamCallbacks = {},
): Promise<QAResult> {
  let terminal: QAResult | null = null
  const pendingDeltas: Promise<void>[] = []
  await consumeNamedEventStream(body, async (event) => {
    let payload: any
    try {
      payload = JSON.parse(event.data)
    } catch {
      throw new Error(`Invalid QA result stream event: ${event.event}`)
    }
    if (event.event === 'start') {
      await callbacks.onStart?.(payload as QAResultStreamStart)
    } else if (event.event === 'delta') {
      const delta = payload as QAResultStreamDelta
      if (typeof delta.delta === 'string' && delta.delta.length > 0) {
        pendingDeltas.push(Promise.resolve(callbacks.onDelta?.(delta)).then(() => {}))
      }
    } else if (event.event === 'done' || event.event === 'error') {
      await Promise.all(pendingDeltas)
      terminal = (payload as QAResultStreamTerminal).result
    }
  })
  if (!terminal) throw new Error('QA result stream ended before a terminal event')
  return terminal
}
