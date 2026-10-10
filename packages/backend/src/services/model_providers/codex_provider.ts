import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ModelConfig } from '@paperland/shared'
import type { ModelInput, ModelInvokeOptions, ModelProvider, ModelToolCallEvent } from './types.js'
import { createAbortError, throwIfAborted, toModelInput, userText } from './types.js'

const DEFAULT_TIMEOUT_SECONDS = 120
const STDERR_TAIL_LIMIT = 4000

function codexEnv(config: ModelConfig): Record<string, string | undefined> {
  return config.codex_home
    ? { ...process.env, CODEX_HOME: config.codex_home }
    : process.env
}

/** Env var that carries an MCP server's bearer token to the app-server (never put in thread config). */
export function mcpTokenEnvVar(serverName: string): string {
  return `PAPERLAND_MCP_TOKEN_${serverName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
}

/**
 * `thread/start` config overrides: native web search and the MCP servers attached to this call
 * (Streamable HTTP; the bearer token is read from the env var named by `bearer_token_env_var`).
 */
export function threadConfig(input: ModelInput): Record<string, unknown> | undefined {
  const config: Record<string, unknown> = {}
  if (input.web_search) config.web_search = 'live'
  if (input.mcp_servers?.length) {
    config.mcp_servers = Object.fromEntries(input.mcp_servers.map((server) => [
      server.name,
      { url: server.url, bearer_token_env_var: mcpTokenEnvVar(server.name) },
    ]))
  }
  return Object.keys(config).length ? config : undefined
}

/** Tool-call progress for an app-server item event, or null for items that are not tool calls. */
export function toolCallEvent(method: string, item: any): ModelToolCallEvent | null {
  let server: string
  let tool: string
  if (item?.type === 'mcpToolCall') {
    server = String(item.server ?? '')
    tool = String(item.tool ?? '')
  } else if (item?.type === 'webSearch') {
    server = 'web'
    tool = 'web_search'
  } else {
    return null
  }
  const status = method === 'item/started' ? 'started' : (item.status === 'failed' || item.error) ? 'failed' : 'completed'
  return { server, tool, status }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Exec arguments for a structured input: the system prompt as `-c developer_instructions=<TOML string>`
 * (a JSON string literal is a valid TOML basic string), web search via `-c web_search="live"`, and each
 * image as `--image <path>`. The user text stays on stdin (`-`), since `--image` takes multiple values.
 */
export function execArgs(input: ModelInput): string {
  const args: string[] = []
  if (input.system) args.push('-c', shellQuote(`developer_instructions=${JSON.stringify(input.system)}`))
  if (input.web_search) args.push('-c', shellQuote('web_search="live"'))
  for (const part of input.user) {
    if (part.type === 'image') args.push('--image', shellQuote(part.path))
  }
  return args.length > 0 ? ` ${args.join(' ')}` : ''
}

function withEphemeralAndStdin(shell: string, extraArgs = ''): string {
  const ephemeral = /(^|\s)--ephemeral(?:\s|$)/.test(shell) ? '' : ' --ephemeral'
  return `${shell}${extraArgs}${ephemeral} -`
}

/** app-server `turn/start` input items: text parts and local image files, in order. */
export function appServerInput(input: ModelInput): unknown[] {
  return input.user.map((part) => part.type === 'text'
    ? { type: 'text', text: part.text, text_elements: [] }
    : { type: 'localImage', path: part.path })
}

async function invokeExec(input: ModelInput, config: ModelConfig, options: ModelInvokeOptions): Promise<string> {
  throwIfAborted(options.signal)
  if (!config.shell) {
    throw new Error('Codex stream:false model missing "shell" config')
  }

  const proc = Bun.spawn(['bash', '-c', withEphemeralAndStdin(config.shell, execArgs(input))], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: new TextEncoder().encode(userText(input)),
    env: codexEnv(config),
  })

  const timeoutSeconds = config.timeout || DEFAULT_TIMEOUT_SECONDS
  let timeout: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      proc.kill()
      reject(new Error(`Codex CLI timed out after ${timeoutSeconds}s`))
    }, timeoutSeconds * 1000)
  })

  const abortPromise = new Promise<never>((_, reject) => {
    abortHandler = () => {
      proc.kill()
      reject(createAbortError())
    }
    options.signal?.addEventListener('abort', abortHandler, { once: true })
  })

  try {
    const [output, stderr, exitCode] = await Promise.race([
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]),
      timeoutPromise,
      abortPromise,
    ]) as [string, string, number]

    if (exitCode !== 0) {
      throw new Error(`Codex CLI failed (exit ${exitCode}): ${stderr.slice(-500)}`)
    }
    return output.trim()
  } finally {
    if (timeout) clearTimeout(timeout)
    if (abortHandler) options.signal?.removeEventListener('abort', abortHandler)
    await proc.exited.catch(() => {})
  }
}

async function readStderrTail(stream: ReadableStream<Uint8Array>, update: (tail: string) => void): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let tail = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      tail = (tail + decoder.decode(value, { stream: true })).slice(-STDERR_TAIL_LIMIT)
      update(tail)
    }
    tail = (tail + decoder.decode()).slice(-STDERR_TAIL_LIMIT)
    update(tail)
  } finally {
    reader.releaseLock()
  }
}

async function* readJsonLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      while (true) {
        const newline = buffer.indexOf('\n')
        if (newline < 0) break
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) yield JSON.parse(line)
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) yield JSON.parse(buffer.trim())
  } finally {
    reader.releaseLock()
  }
}

async function invokeAppServer(input: ModelInput, config: ModelConfig, options: ModelInvokeOptions): Promise<string> {
  throwIfAborted(options.signal)
  if (!config.cli_path || !config.codex_home || !config.model_id) {
    throw new Error('Codex stream:true model requires cli_path, codex_home, and model_id')
  }

  const ownsWorkingDir = !config.working_dir
  const workingDir = config.working_dir || mkdtempSync(join(tmpdir(), 'paperland-codex-'))
  const env = { ...codexEnv(config) }
  for (const server of input.mcp_servers ?? []) env[mcpTokenEnvVar(server.name)] = server.bearer_token
  const proc = Bun.spawn([config.cli_path, 'app-server'], {
    cwd: workingDir,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env,
  })

  const stdin = proc.stdin as any
  const send = (message: unknown) => {
    stdin.write(`${JSON.stringify(message)}\n`)
    stdin.flush?.()
  }

  let stderrTail = ''
  const stderrTask = readStderrTail(proc.stderr, (tail) => { stderrTail = tail }).catch(() => {})
  const timeoutSeconds = config.timeout || DEFAULT_TIMEOUT_SECONDS
  let timeout: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined
  let threadId = ''
  let turnId = ''
  let finalItemId = ''
  let finalText = ''

  const SKILL_ROOTS_REQUEST_ID = 10
  const overrides = threadConfig(input)
  const startThread = () => send({
    method: 'thread/start',
    id: 1,
    params: {
      model: config.model_id,
      cwd: workingDir,
      approvalPolicy: 'never',
      sandbox: 'read-only',
      ephemeral: true,
      ...(input.system ? { developerInstructions: input.system } : {}),
      ...(overrides ? { config: overrides } : {}),
    },
  })

  const protocolPromise = (async () => {
    send({
      method: 'initialize',
      id: 0,
      params: {
        clientInfo: {
          name: 'paperland_model_provider',
          title: 'Paperland Model Provider',
          version: '1.0.0',
        },
      },
    })

    for await (const message of readJsonLines(proc.stdout)) {
      if (message.id === SKILL_ROOTS_REQUEST_ID) {
        // Extra skill roots are best effort: without them the round still runs, just without skills.
        if (message.error) console.warn(`[codex] skills/extraRoots/set failed: ${message.error.message || JSON.stringify(message.error)}`)
        startThread()
        continue
      }

      if (message?.error && message?.id != null) {
        throw new Error(`Codex app-server error: ${message.error.message || JSON.stringify(message.error)}`)
      }

      if (message.id === 0) {
        send({ method: 'initialized', params: {} })
        if (input.skill_roots?.length) {
          // Process-scoped (not persisted to CODEX_HOME); must land before the thread starts.
          send({ method: 'skills/extraRoots/set', id: SKILL_ROOTS_REQUEST_ID, params: { extraRoots: input.skill_roots } })
        } else {
          startThread()
        }
        continue
      }

      if (message.id === 1) {
        const thread = message.result?.thread
        if (!thread?.id) throw new Error('Codex app-server did not return a thread id')
        if (thread.ephemeral !== true) {
          throw new Error('Codex app-server refused an ephemeral thread')
        }
        threadId = thread.id
        send({
          method: 'turn/start',
          id: 2,
          params: {
            threadId,
            input: appServerInput(input),
            model: config.model_id,
            ...(config.reasoning_effort ? { effort: config.reasoning_effort } : {}),
          },
        })
        continue
      }

      if (message.id === 2 && message.result?.turn?.id) {
        turnId = message.result.turn.id
        continue
      }

      if (message.method === 'turn/started' && message.params?.turn?.id) {
        turnId = message.params.turn.id
        continue
      }

      if (message.method === 'item/started' || message.method === 'item/completed') {
        const toolEvent = toolCallEvent(message.method, message.params?.item)
        if (toolEvent) {
          try { options.onToolCall?.(toolEvent) } catch {}
        }
      }

      if (message.method === 'item/started') {
        const item = message.params?.item
        if (item?.type === 'agentMessage' && item.phase === 'final_answer') {
          finalItemId = item.id
        }
        continue
      }

      if (message.method === 'item/agentMessage/delta') {
        const params = message.params
        if (params?.itemId === finalItemId && typeof params.delta === 'string' && params.delta.length > 0) {
          await options.onChunk?.(params.delta)
        }
        continue
      }

      if (message.method === 'item/completed') {
        const item = message.params?.item
        if (item?.type === 'agentMessage' && item.id === finalItemId && item.phase === 'final_answer') {
          finalText = typeof item.text === 'string' ? item.text : ''
        }
        continue
      }

      if (message.method === 'turn/completed') {
        const turn = message.params?.turn
        if (turn?.status !== 'completed') {
          throw new Error(`Codex turn ${turn?.status || 'failed'}: ${turn?.error?.message || 'unknown error'}`)
        }
        if (!finalText.trim()) throw new Error('Codex app-server returned no final answer')
        return finalText.trim()
      }
    }

    throw new Error(`Codex app-server exited before completion: ${stderrTail}`)
  })()

  const unexpectedExit = proc.exited.then((code) => {
    throw new Error(`Codex app-server exited early (${code}): ${stderrTail}`)
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      proc.kill()
      reject(new Error(`Codex app-server timed out after ${timeoutSeconds}s`))
    }, timeoutSeconds * 1000)
  })

  const abortPromise = new Promise<never>((_, reject) => {
    abortHandler = () => {
      try {
        if (threadId && turnId) {
          send({ method: 'turn/interrupt', id: 3, params: { threadId, turnId } })
        }
      } catch {
        // The process may already be closing; kill below is authoritative.
      }
      reject(createAbortError())
    }
    options.signal?.addEventListener('abort', abortHandler, { once: true })
  })

  try {
    return await Promise.race([protocolPromise, unexpectedExit, timeoutPromise, abortPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
    if (abortHandler) options.signal?.removeEventListener('abort', abortHandler)
    try { stdin.end?.() } catch {}
    if (options.signal?.aborted && threadId && turnId) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    proc.kill()
    await proc.exited.catch(() => {})
    await stderrTask
    if (ownsWorkingDir) rmSync(workingDir, { recursive: true, force: true })
  }
}

export const codexProvider: ModelProvider = {
  capabilities(config) {
    return { streaming: config.stream === true }
  },

  invoke(input, config, options = {}) {
    const structured = toModelInput(input)
    return config.stream === true
      ? invokeAppServer(structured, config, options)
      : invokeExec(structured, config, options)
  },
}
