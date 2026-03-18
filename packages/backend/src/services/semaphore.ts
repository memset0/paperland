export class Semaphore {
  private current = 0
  private queue: (() => void)[] = []

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++
        resolve()
      })
    })
  }

  release(): void {
    this.current--
    const next = this.queue.shift()
    if (next) next()
  }

  get pending(): number {
    return this.queue.length
  }

  get running(): number {
    return this.current
  }
}
