import type { ModelConfig } from '@paperland/shared'

/** A tool call the agent started or finished (MCP tool or native web search). */
export interface ModelToolCallEvent {
  /** MCP server name, or `web` for native web search. */
  server: string
  tool: string
  status: 'started' | 'completed' | 'failed'
}

/** Token usage of one invocation, summed over every model request it made. */
export interface ModelUsage {
  /** Includes cached input. */
  input_tokens: number
  cached_input_tokens: number
  /** Includes reasoning. */
  output_tokens: number
  reasoning_tokens: number
  total_tokens: number
}

export interface ModelInvokeOptions {
  onChunk?: (delta: string) => void | Promise<void>
  /** Called at most once with the invocation's token usage, when the provider reports it (also for failed or cancelled runs). */
  onUsage?: (usage: ModelUsage) => void
  /** Tool-call progress (Codex app-server only). */
  onToolCall?: (event: ModelToolCallEvent) => void
  signal?: AbortSignal
}

/** An MCP server (Streamable HTTP) the agent may use for this call, with its bearer token. */
export interface ModelMcpServer {
  name: string
  url: string
  bearer_token: string
  /** Only these tools are exposed to the agent (all when absent). */
  enabled_tools?: string[]
  /** Non-read-only tools allowed to run without approval (the run uses `approvalPolicy: never`). */
  approved_tools?: string[]
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
  /** MCP servers to attach for this call (Codex app-server only). */
  mcp_servers?: ModelMcpServer[]
  /** Extra skill root directories (absolute) for this call (Codex app-server only). */
  skill_roots?: string[]
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
