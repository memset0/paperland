import type { ModelConfig } from '@paperland/shared'

export interface ModelInvokeOptions {
  onChunk?: (delta: string) => void | Promise<void>
  signal?: AbortSignal
}

export interface ModelCapabilities {
  streaming: boolean
}

/** One part of the user message: text, or an image file on local disk (the built-in image host). */
export type ModelInputPart =
  | { type: 'text'; text: string }
  | { type: 'image'; path: string; mime: string }

/** Structured model input: an optional system prompt plus one user message made of ordered parts. */
export interface ModelInput {
  system?: string
  user: ModelInputPart[]
  /** Allow the provider's native web search when it has one (Codex only). */
  web_search?: boolean
}

export interface ModelProvider {
  capabilities(config: ModelConfig): ModelCapabilities
  /** A plain string is treated as a single-text user message. */
  invoke(input: string | ModelInput, config: ModelConfig, options?: ModelInvokeOptions): Promise<string>
}

/** Wrap a plain prompt string as a single-text user message. */
export function toModelInput(input: string | ModelInput): ModelInput {
  return typeof input === 'string' ? { user: [{ type: 'text', text: input }] } : input
}

/** All text parts joined in order (images omitted). */
export function userText(input: ModelInput): string {
  return input.user.filter((part) => part.type === 'text').map((part) => (part as { text: string }).text).join('\n\n')
}

export function createAbortError(message = 'Model invocation cancelled'): Error {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError()
}
