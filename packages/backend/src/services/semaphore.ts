export class Semaphore {
  private current = 0
  private queue: Array<{
    resolve: () => void
    reject: (error: Error) => void
    signal?: AbortSignal
    onAbort?: () => void
  }> = []

  constructor(private max: number) {}

  async acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw this.abortError()
    if (this.current < this.max) {
      this.current++
      return
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: (typeof this.queue)[number] = { resolve, reject, signal }
      waiter.onAbort = () => {
        const index = this.queue.indexOf(waiter)
        if (index >= 0) this.queue.splice(index, 1)
        reject(this.abortError())
      }
      signal?.addEventListener('abort', waiter.onAbort, { once: true })
      this.queue.push(waiter)
    })
  }

  release(): void {
    this.current--
    const next = this.queue.shift()
    if (next) {
      if (next.onAbort) next.signal?.removeEventListener('abort', next.onAbort)
      this.current++
      next.resolve()
    }
  }

  private abortError(): Error {
    const error = new Error('Service execution cancelled')
    error.name = 'AbortError'
    return error
  }

  get pending(): number {
    return this.queue.length
  }

  get running(): number {
    return this.current
  }
}
