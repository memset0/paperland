import { describe, expect, test } from 'bun:test'
import { consumeTranslationStream } from './translation-stream'

function body(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

describe('consumeTranslationStream', () => {
  test('reports start/deltas and returns authoritative done', async () => {
    const starts: any[] = []
    const deltas: string[] = []
    const result = await consumeTranslationStream(body([
      'event: start\ndata: {"source_hash":"hash","cached":false,"model_name":"model","streaming":true}\n\n',
      'event: delta\ndata: {"delta":"one"}\n\nevent: del',
      'ta\ndata: {"delta":"two"}\r\n\r\nevent: done\r\ndata: {"source_hash":"hash","source_text":"source","translated_text":"onetwo","source_lang":"en","target_lang":"zh","model_name":"model","cached":false}\r\n\r\n',
    ]), {
      onStart: (start) => { starts.push(start) },
      onDelta: (delta) => { deltas.push(delta) },
    })
    expect(starts).toHaveLength(1)
    expect(starts[0]).toMatchObject({ streaming: true, cached: false })
    expect(deltas).toEqual(['one', 'two'])
    expect(result.translated_text).toBe('onetwo')
  })

  test('raises typed stream errors and rejects streams without done', async () => {
    try {
      await consumeTranslationStream(body([
        'event: error\ndata: {"error":{"code":"TRANSLATION_FAILED","message":"failed"}}\n\n',
      ]))
      throw new Error('expected rejection')
    } catch (error) {
      expect(error).toMatchObject({ message: 'failed', code: 'TRANSLATION_FAILED' })
    }
    await expect(consumeTranslationStream(body([
      'event: start\ndata: {"source_hash":"hash","cached":false,"model_name":"model","streaming":true}\n\n',
    ]))).rejects.toThrow('ended before done')
  })

  test('final-only done completes immediately without invoking delta presentation', async () => {
    let deltaCalls = 0
    const result = await consumeTranslationStream(body([
      'event: start\ndata: {"source_hash":"hash","cached":true,"model_name":"model","streaming":false}\n\n',
      'event: done\ndata: {"source_hash":"hash","source_text":"source","translated_text":"cached","source_lang":"en","target_lang":"zh","model_name":"model","cached":true}\n\n',
    ]), { onDelta: () => { deltaCalls++ } })
    expect(deltaCalls).toBe(0)
    expect(result).toMatchObject({ translated_text: 'cached', cached: true })
  })
})
