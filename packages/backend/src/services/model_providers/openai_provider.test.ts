import { afterEach, describe, expect, test } from 'bun:test'
import type { ModelConfig } from '@paperland/shared'
import { openAIProvider, SSEDataParser } from './openai_provider.js'

const config: ModelConfig = {
  name: 'stream-model',
  type: 'openai_api',
  endpoint: 'https://example.test/v1',
  api_key_env: 'PAPERLAND_OPENAI_STREAM_TEST_KEY',
  stream: true,
}

const originalFetch = globalThis.fetch
const previousKey = process.env.PAPERLAND_OPENAI_STREAM_TEST_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (previousKey === undefined) delete process.env.PAPERLAND_OPENAI_STREAM_TEST_KEY
  else process.env.PAPERLAND_OPENAI_STREAM_TEST_KEY = previousKey
})

function streamingResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('OpenAIProvider streaming', () => {
  test('SSE parser handles CRLF, split boundaries, comments, and multi-line data', () => {
    const parser = new SSEDataParser()
    expect(parser.push(': keepalive\r\ndata: first\r\ndata: sec')).toEqual([])
    expect(parser.push('ond\r\n\r\ndata: third\n\n')).toEqual(['first\nsecond', 'third'])
    expect(parser.finish()).toEqual([])
  })

  test('forwards ordered deltas and returns their authoritative concatenation', async () => {
    process.env.PAPERLAND_OPENAI_STREAM_TEST_KEY = 'test-key'
    let requestBody: any
    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return streamingResponse([
        'data: {"choices":[{"delta":{"content":"第一段"}}]}\n\n',
        'data: {"choices":[{"delta":{}}]}\n\ndata: {"choices":[{"delta":{"content":"第二',
        '段"}}]}\r\n\r\ndata: [DONE]\r\n\r\n',
      ])
    }) as typeof fetch
    const deltas: string[] = []
    const result = await openAIProvider.invoke('translate', config, { onChunk: (delta) => { deltas.push(delta) } })
    expect(deltas).toEqual(['第一段', '第二段'])
    expect(result).toBe('第一段第二段')
    expect(requestBody.stream).toBe(true)
  })

  test('supports final-string callers, HTTP errors, and pre-abort', async () => {
    process.env.PAPERLAND_OPENAI_STREAM_TEST_KEY = 'test-key'
    globalThis.fetch = (async () => streamingResponse([
      'data: {"choices":[{"delta":{"content":"final"}}]}\n\n',
      'data: [DONE]\n\n',
    ])) as typeof fetch
    await expect(openAIProvider.invoke('translate', config)).resolves.toBe('final')

    globalThis.fetch = (async () => new Response('bad gateway', { status: 502 })) as typeof fetch
    await expect(openAIProvider.invoke('translate', config)).rejects.toThrow('OpenAI API error 502')

    const controller = new AbortController()
    controller.abort()
    await expect(openAIProvider.invoke('translate', config, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
