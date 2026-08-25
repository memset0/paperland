import type { ModelConfig } from '@paperland/shared'
import type { ModelInvokeOptions, ModelProvider } from './types.js'
import { throwIfAborted } from './types.js'

export class SSEDataParser {
  private buffer = ''

  push(chunk: string): string[] {
    this.buffer += chunk
    const data: string[] = []

    while (true) {
      const match = /\r\n\r\n|\n\n|\r\r/.exec(this.buffer)
      if (!match || match.index == null) break
      const frame = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      const parsed = this.parseFrame(frame)
      if (parsed != null) data.push(parsed)
    }

    return data
  }

  finish(): string[] {
    const frame = this.buffer
    this.buffer = ''
    const parsed = this.parseFrame(frame)
    return parsed == null ? [] : [parsed]
  }

  private parseFrame(frame: string): string | null {
    const lines: string[] = []
    for (const line of frame.split(/\r\n|\n|\r/)) {
      if (line.startsWith(':') || !line.startsWith('data:')) continue
      const value = line.slice(5)
      lines.push(value.startsWith(' ') ? value.slice(1) : value)
    }
    return lines.length > 0 ? lines.join('\n') : null
  }
}

async function responseError(response: Response): Promise<Error> {
  const body = await response.text().catch(() => '')
  return new Error(`OpenAI API error ${response.status}: ${body}`)
}

async function invokeJson(prompt: string, config: ModelConfig, options: ModelInvokeOptions): Promise<string> {
  throwIfAborted(options.signal)
  const apiKey = process.env[config.api_key_env || 'OPENAI_API_KEY']
  if (!apiKey) throw new Error(`API key not found in env: ${config.api_key_env}`)

  const endpoint = config.endpoint || 'https://api.openai.com/v1'
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.name,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
    }),
    signal: options.signal,
  })

  if (!response.ok) throw await responseError(response)
  const data = await response.json() as any
  return data.choices?.[0]?.message?.content || ''
}

async function invokeStream(prompt: string, config: ModelConfig, options: ModelInvokeOptions): Promise<string> {
  throwIfAborted(options.signal)
  const apiKey = process.env[config.api_key_env || 'OPENAI_API_KEY']
  if (!apiKey) throw new Error(`API key not found in env: ${config.api_key_env}`)

  const endpoint = config.endpoint || 'https://api.openai.com/v1'
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.name,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      stream: true,
    }),
    signal: options.signal,
  })

  if (!response.ok) throw await responseError(response)
  if (!response.body) throw new Error('OpenAI streaming response has no body')

  const parser = new SSEDataParser()
  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let fullText = ''

  const consume = async (raw: string) => {
    if (raw.trim() === '[DONE]') return
    let event: any
    try {
      event = JSON.parse(raw)
    } catch {
      throw new Error('OpenAI streaming response contained invalid JSON')
    }
    const delta = event.choices?.[0]?.delta?.content
    if (typeof delta !== 'string' || delta.length === 0) return
    fullText += delta
    await options.onChunk?.(delta)
  }

  try {
    while (true) {
      throwIfAborted(options.signal)
      const { done, value } = await reader.read()
      if (done) break
      for (const raw of parser.push(decoder.decode(value, { stream: true }))) {
        await consume(raw)
      }
    }
    for (const raw of parser.push(decoder.decode())) await consume(raw)
    for (const raw of parser.finish()) await consume(raw)
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }

  return fullText
}

export const openAIProvider: ModelProvider = {
  capabilities(config) {
    return { streaming: config.stream === true }
  },

  invoke(prompt, config, options = {}) {
    return config.stream === true
      ? invokeStream(prompt, config, options)
      : invokeJson(prompt, config, options)
  },
}
