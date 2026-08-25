import type { ModelConfig } from '@paperland/shared'

export interface ModelInvokeOptions {
  onChunk?: (delta: string) => void | Promise<void>
  signal?: AbortSignal
}

export interface ModelCapabilities {
  streaming: boolean
}

export interface ModelProvider {
  capabilities(config: ModelConfig): ModelCapabilities
  invoke(prompt: string, config: ModelConfig, options?: ModelInvokeOptions): Promise<string>
}

export function createAbortError(message = 'Model invocation cancelled'): Error {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError()
}
