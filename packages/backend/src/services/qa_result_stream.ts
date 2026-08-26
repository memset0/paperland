export type QAResultStreamEvent =
  | { event: 'start'; result: any }
  | { event: 'delta'; result_id: number; delta: string; answer_length: number; first_chunk_at: string | null; thinking_duration_ms: number | null }
  | { event: 'done'; result: any }
  | { event: 'error'; result: any }

export type QAResultStreamSubscriber = (event: QAResultStreamEvent) => void

class QAResultStreamBroker {
  private subscribers = new Map<number, Set<QAResultStreamSubscriber>>()

  subscribe(resultId: number, subscriber: QAResultStreamSubscriber): () => void {
    const current = this.subscribers.get(resultId) ?? new Set()
    current.add(subscriber)
    this.subscribers.set(resultId, current)
    return () => {
      const listeners = this.subscribers.get(resultId)
      if (!listeners) return
      listeners.delete(subscriber)
      if (listeners.size === 0) this.subscribers.delete(resultId)
    }
  }

  publish(resultId: number, event: QAResultStreamEvent): void {
    const listeners = this.subscribers.get(resultId)
    if (!listeners) return
    for (const subscriber of [...listeners]) subscriber(event)
    if (event.event === 'done' || event.event === 'error') this.subscribers.delete(resultId)
  }

  subscriberCount(resultId: number): number {
    return this.subscribers.get(resultId)?.size ?? 0
  }

  clear(): void {
    this.subscribers.clear()
  }
}

export const qaResultStreamBroker = new QAResultStreamBroker()
