export class RateLimiter {
  private lastExecution = 0

  constructor(private intervalMs: number) {}

  async waitIfNeeded(): Promise<void> {
    if (this.intervalMs <= 0) return
    const now = Date.now()
    const elapsed = now - this.lastExecution
    if (elapsed < this.intervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.intervalMs - elapsed))
    }
    this.lastExecution = Date.now()
  }
}
