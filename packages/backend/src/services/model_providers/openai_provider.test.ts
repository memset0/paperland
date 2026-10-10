import { afterEach, describe, expect, test } from 'bun:test'
import type { ModelConfig } from '@paperland/shared'
import { chatMessages, openAIProvider, SSEDataParser } from './openai_provider.js'

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

  test('requests and reports streaming usage from the final chunk', async () => {
    process.env.PAPERLAND_OPENAI_STREAM_TEST_KEY = 'test-key'
    let requestBody: any
    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return streamingResponse([
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":50,"completion_tokens":7,"total_tokens":57,"prompt_tokens_details":{"cached_tokens":40},"completion_tokens_details":{"reasoning_tokens":2}}}\n\n',
        'data: [DONE]\n\n',
      ])
    }) as typeof fetch
    const reports: unknown[] = []
    await expect(openAIProvider.invoke('q', config, { onUsage: (u) => { reports.push(u) } })).resolves.toBe('hi')
    expect(requestBody.stream_options).toEqual({ include_usage: true })
    expect(reports).toEqual([{ input_tokens: 50, cached_input_tokens: 40, output_tokens: 7, reasoning_tokens: 2, total_tokens: 57 }])
  })

  test('reports JSON response usage and stays silent without usage', async () => {
    process.env.PAPERLAND_OPENAI_STREAM_TEST_KEY = 'test-key'
    const jsonConfig = { ...config, stream: false }
    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } })) as typeof fetch
    const reports: unknown[] = []
    await expect(openAIProvider.invoke('q', jsonConfig, { onUsage: (u) => { reports.push(u) } })).resolves.toBe('x')
    expect(reports).toEqual([{ input_tokens: 10, cached_input_tokens: 0, output_tokens: 2, reasoning_tokens: 0, total_tokens: 12 }])

    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: 'y' } }] })) as typeof fetch
    const none: unknown[] = []
    await openAIProvider.invoke('q', jsonConfig, { onUsage: (u) => { none.push(u) } })
    expect(none).toEqual([])
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

describe('chatMessages', () => {
  test('sends a real system message and keeps text-only user content as a string', () => {
    expect(chatMessages({ system: 'rules', user: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] })).toEqual([
      { role: 'system', content: 'rules' },
      { role: 'user', content: 'a\n\nb' },
    ])
  })

  test('embeds local images as base64 data URLs in order', () => {
    const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'paperland-openai-img-'))
    const file = require('path').join(dir, 'x.png')
    require('fs').writeFileSync(file, Buffer.from([1, 2, 3]))
    const messages = chatMessages({ user: [{ type: 'text', text: 'see' }, { type: 'image', path: file, mime: 'image/png' }] })
    expect(messages).toEqual([{ role: 'user', content: [
      { type: 'text', text: 'see' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AQID' } },
    ] }])
  })
})
