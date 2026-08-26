export class RateLimiter {
  private lastExecution = 0

  constructor(private intervalMs: number) {}

  async waitIfNeeded(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw this.abortError()
    if (this.intervalMs <= 0) return
    const now = Date.now()
    const elapsed = now - this.lastExecution
    if (elapsed < this.intervalMs) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }, this.intervalMs - elapsed)
        const onAbort = () => {
          clearTimeout(timer)
          reject(this.abortError())
        }
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    }
    if (signal?.aborted) throw this.abortError()
    this.lastExecution = Date.now()
  }

  private abortError(): Error {
    const error = new Error('Service execution cancelled')
    error.name = 'AbortError'
    return error
  }
}
