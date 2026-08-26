import { describe, expect, test } from 'bun:test'
import { consumeQAResultStream } from './qa-result-stream'

function body(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

const result = {
  id: 7, qa_entry_id: 2, prompt: 'q', answer: '', model_name: 'm',
  completed_at: '2026-08-26T00:00:00Z', execution_id: 9, content_hash: null,
  status: 'awaiting_output', error: null, requested_by_user_id: 1,
  streaming_capable: true, created_at: '2026-08-26T00:00:00Z',
  started_at: '2026-08-26T00:00:00Z', first_chunk_at: null, finished_at: null,
  updated_at: '2026-08-26T00:00:00Z', thinking_duration_ms: 1000, can_cancel: true,
}

describe('consumeQAResultStream', () => {
  test('handles fragmented frames and waits for ordered delta callbacks before done', async () => {
    const order: string[] = []
    const terminal = await consumeQAResultStream(body([
      `event: start\ndata: ${JSON.stringify({ result, streaming_capable: true, thinking_duration_ms: 1000 })}\n\n`,
      'event: delta\ndata: {"result_id":7,"delta":"one","answer_length":3,"first_chunk_at":"2026-08-26T00:00:01Z","thinking_duration_ms":1000}\n\nevent: del',
      'ta\ndata: {"result_id":7,"delta":"two","answer_length":6,"first_chunk_at":"2026-08-26T00:00:01Z","thinking_duration_ms":1000}\r\n\r\n',
      `event: done\r\ndata: ${JSON.stringify({ result: { ...result, status: 'done', answer: 'onetwo', finished_at: '2026-08-26T00:00:02Z' } })}\r\n\r\n`,
    ]), {
      onStart: () => { order.push('start') },
      onDelta: async (delta) => { order.push(delta.delta); await Promise.resolve() },
    })
    expect(order).toEqual(['start', 'one', 'two'])
    expect(terminal).toMatchObject({ status: 'done', answer: 'onetwo' })
  })

  test('returns durable failed Result and rejects a stream without terminal state', async () => {
    const failed = await consumeQAResultStream(body([
      `event: start\ndata: ${JSON.stringify({ result, streaming_capable: true, thinking_duration_ms: 1000 })}\n\n`,
      `event: error\ndata: ${JSON.stringify({ result: { ...result, status: 'failed', answer: 'partial', error: 'boom' }, error: { code: 'QA_FAILED', message: 'boom' } })}\n\n`,
    ]))
    expect(failed).toMatchObject({ status: 'failed', answer: 'partial', error: 'boom' })
    await expect(consumeQAResultStream(body([
      `event: start\ndata: ${JSON.stringify({ result, streaming_capable: true, thinking_duration_ms: 1000 })}\n\n`,
    ]))).rejects.toThrow('before a terminal event')
  })

  test('propagates AbortError from a fetch body cancelled by AbortSignal', async () => {
    const controller = new AbortController()
    let streamController!: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        streamController = value
        const encoder = new TextEncoder()
        value.enqueue(encoder.encode(`event: start\ndata: ${JSON.stringify({ result, streaming_capable: true, thinking_duration_ms: 1000 })}\n\n`))
      },
    })
    controller.signal.addEventListener('abort', () => {
      const error = new Error('cancelled observer')
      error.name = 'AbortError'
      streamController.error(error)
    }, { once: true })
    const consuming = consumeQAResultStream(stream)
    controller.abort()
    await expect(consuming).rejects.toMatchObject({ name: 'AbortError' })
  })
})
