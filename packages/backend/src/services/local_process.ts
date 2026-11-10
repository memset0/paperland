import { basename } from 'node:path'

/** Bounded local subprocess I/O; never invokes a shell or inherits Git repository hooks. */
export async function localProcess(command: string, args: string[], options: {
  input?: Uint8Array | string
  timeout_ms: number
  max_bytes: number
  env?: Record<string, string | undefined>
  cwd?: string
  allowed_codes?: number[]
}): Promise<{ output: Buffer; error: string; code: number }> {
  const proc = Bun.spawn([command, ...args], {
    stdin: options.input === undefined ? 'ignore' : 'pipe', stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, ...options.env },
    cwd: options.cwd,
  })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; proc.kill(9) }, options.timeout_ms)
  async function read(stream: ReadableStream<Uint8Array>, cap: number): Promise<Buffer> {
    const chunks: Uint8Array[] = []; let bytes = 0
    for await (const chunk of stream) {
      bytes += chunk.byteLength
      if (bytes > cap) { proc.kill(9); throw new Error(`${basename(command)} output exceeded its limit`) }
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }
  try {
    if (options.input !== undefined && proc.stdin && typeof proc.stdin !== 'number') {
      proc.stdin.write(options.input)
      proc.stdin.end()
    }
    const results = await Promise.allSettled([read(proc.stdout, options.max_bytes), read(proc.stderr, 65536), proc.exited])
    if (timedOut) throw new Error(`${basename(command)} timed out`)
    for (const result of results) if (result.status === 'rejected') throw result.reason
    const [stdout, stderr, exit] = results as [PromiseFulfilledResult<Buffer>, PromiseFulfilledResult<Buffer>, PromiseFulfilledResult<number>]
    const error = stderr.value.toString('utf8')
    if (!(options.allowed_codes ?? [0]).includes(exit.value)) throw new Error(`${basename(command)} failed: ${error.slice(0, 2000).trim() || `exit ${exit.value}`}`)
    return { output: stdout.value, error, code: exit.value }
  } finally { clearTimeout(timer) }
}
