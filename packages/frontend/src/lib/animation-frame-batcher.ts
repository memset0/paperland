export type NextFrame = () => Promise<void>

function browserFrame(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()))
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export class AnimationFrameBatcher<T> {
  private queued: T[] = []
  private scheduled: Promise<void> | null = null

  constructor(private readonly nextFrame: NextFrame = browserFrame) {}

  push(item: T, flush: (items: T[]) => void): Promise<void> {
    this.queued.push(item)
    if (!this.scheduled) {
      this.scheduled = this.nextFrame().then(() => {
        const items = this.queued
        this.queued = []
        this.scheduled = null
        if (items.length > 0) flush(items)
      })
    }
    return this.scheduled
  }

  cancel(): void {
    this.queued = []
  }
}
