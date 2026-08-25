import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ModelConfig } from '@paperland/shared'
import type { ModelInvokeOptions, ModelProvider } from './types.js'
import { createAbortError, throwIfAborted } from './types.js'

const DEFAULT_TIMEOUT_SECONDS = 120
const STDERR_TAIL_LIMIT = 4000

function codexEnv(config: ModelConfig): Record<string, string | undefined> {
  return config.codex_home
    ? { ...process.env, CODEX_HOME: config.codex_home }
    : process.env
}

function withEphemeralAndStdin(shell: string): string {
  const ephemeral = /(^|\s)--ephemeral(?:\s|$)/.test(shell) ? '' : ' --ephemeral'
  return `${shell}${ephemeral} -`
}

async function invokeExec(prompt: string, config: ModelConfig, options: ModelInvokeOptions): Promise<string> {
  throwIfAborted(options.signal)
  if (!config.shell) {
    throw new Error('Codex stream:false model missing "shell" config')
  }

  const proc = Bun.spawn(['bash', '-c', withEphemeralAndStdin(config.shell)], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: new TextEncoder().encode(prompt),
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

async function invokeAppServer(prompt: string, config: ModelConfig, options: ModelInvokeOptions): Promise<string> {
  throwIfAborted(options.signal)
  if (!config.cli_path || !config.codex_home || !config.model_id) {
    throw new Error('Codex stream:true model requires cli_path, codex_home, and model_id')
  }

  const ownsWorkingDir = !config.working_dir
  const workingDir = config.working_dir || mkdtempSync(join(tmpdir(), 'paperland-codex-'))
  const proc = Bun.spawn([config.cli_path, 'app-server'], {
    cwd: workingDir,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: codexEnv(config),
  })

  const input = proc.stdin as any
  const send = (message: unknown) => {
    input.write(`${JSON.stringify(message)}\n`)
    input.flush?.()
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
      if (message?.error && message?.id != null) {
        throw new Error(`Codex app-server error: ${message.error.message || JSON.stringify(message.error)}`)
      }

      if (message.id === 0) {
        send({ method: 'initialized', params: {} })
        send({
          method: 'thread/start',
          id: 1,
          params: {
            model: config.model_id,
            cwd: workingDir,
            approvalPolicy: 'never',
            sandbox: 'read-only',
            ephemeral: true,
          },
        })
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
            input: [{ type: 'text', text: prompt }],
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
    try { input.end?.() } catch {}
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

  invoke(prompt, config, options = {}) {
    return config.stream === true
      ? invokeAppServer(prompt, config, options)
      : invokeExec(prompt, config, options)
  },
}
